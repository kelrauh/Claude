#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["httpx>=0.27"]
# ///
"""One-time browser authorization for account-wide Podio access.

Runs Podio's server-side OAuth flow against a loopback redirect, then writes the
resulting refresh token to a file the MCP server reads.  This is the only step
that needs a browser; afterwards the server refreshes headlessly.

    uv run --script servers/podio/podio_auth.py

The API key's registered domain must be ``localhost`` for the redirect to be
accepted -- set that at https://podio.com/settings/api, on the key whose client
ID you are using.

See https://developers.podio.com/authentication/server_side
"""

from __future__ import annotations

import argparse
import json
import os
import secrets
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse

import httpx

AUTHORIZE_URL = "https://podio.com/oauth/authorize"
DEFAULT_API_BASE = "https://api.podio.com"
DEFAULT_TOKEN_FILE = ".podio-token.json"
CALLBACK_PATH = "/podio-callback"

PAGE = """<!doctype html><meta charset="utf-8"><title>Podio</title>
<body style="font:16px system-ui;margin:4rem auto;max-width:32rem">
<h1>{heading}</h1><p>{detail}</p></body>"""


class _Callback(BaseHTTPRequestHandler):
    """Catches Podio's redirect and hands the code back to the main thread."""

    result: dict[str, str] = {}
    done = threading.Event()

    def log_message(self, *args):
        pass

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path != CALLBACK_PATH:
            self.send_error(404)
            return

        query = {key: values[0] for key, values in parse_qs(parsed.query).items()}
        _Callback.result = query
        if "code" in query:
            heading, detail = "Authorized", "You can close this tab and return to the terminal."
        else:
            heading = "Authorization failed"
            detail = query.get("error_description") or query.get("error") or "No code returned."

        body = PAGE.format(heading=heading, detail=detail).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        _Callback.done.set()


def authorize(client_id: str, client_secret: str, port: int, api_base: str, timeout: int) -> str:
    """Run the browser flow and return the refresh token."""
    redirect_uri = f"http://localhost:{port}{CALLBACK_PATH}"
    state = secrets.token_urlsafe(24)
    url = f"{AUTHORIZE_URL}?" + urlencode(
        {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "state": state,
        }
    )

    server = HTTPServer(("127.0.0.1", port), _Callback)
    threading.Thread(target=server.serve_forever, daemon=True).start()

    print(f"Open this URL to authorize (it should open automatically):\n\n  {url}\n")
    try:
        webbrowser.open(url)
    except Exception:  # a headless box has no browser; the printed URL still works
        pass

    print(f"Waiting up to {timeout}s for the redirect back to {redirect_uri} ...")
    if not _Callback.done.wait(timeout):
        server.shutdown()
        raise SystemExit("Timed out waiting for authorization.")
    server.shutdown()

    query = _Callback.result
    if query.get("state") != state:
        raise SystemExit("State mismatch -- discarding this response rather than trusting it.")
    if "code" not in query:
        detail = query.get("error_description") or query.get("error") or "no code returned"
        raise SystemExit(f"Authorization failed: {detail}")

    response = httpx.post(
        f"{api_base}/oauth/token/v2",
        data={
            "grant_type": "authorization_code",
            "code": query["code"],
            "redirect_uri": redirect_uri,
            "client_id": client_id,
            "client_secret": client_secret,
        },
        timeout=30.0,
    )
    if response.status_code >= 400:
        raise SystemExit(f"Token exchange failed: HTTP {response.status_code} {response.text[:300]}")

    body = response.json()
    refresh_token = body.get("refresh_token")
    if not refresh_token:
        raise SystemExit("Podio returned no refresh token; cannot run headlessly.")
    return refresh_token


def write_token(path: Path, refresh_token: str) -> None:
    payload = json.dumps({"refresh_token": refresh_token}, indent=2) + "\n"
    path.write_text(payload, encoding="utf-8")
    path.chmod(0o600)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8080, help="loopback port (default 8080)")
    parser.add_argument(
        "--token-file",
        default=os.environ.get("PODIO_TOKEN_FILE", DEFAULT_TOKEN_FILE),
        help=f"where to write the refresh token (default {DEFAULT_TOKEN_FILE})",
    )
    parser.add_argument("--timeout", type=int, default=300, help="seconds to wait (default 300)")
    args = parser.parse_args()

    client_id = os.environ.get("PODIO_CLIENT_ID", "").strip()
    client_secret = os.environ.get("PODIO_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        raise SystemExit(
            "PODIO_CLIENT_ID and PODIO_CLIENT_SECRET must be set.\n"
            "  set -a; . ./.env; set +a"
        )

    refresh_token = authorize(
        client_id,
        client_secret,
        args.port,
        os.environ.get("PODIO_API_BASE", DEFAULT_API_BASE).rstrip("/"),
        args.timeout,
    )

    path = Path(args.token_file)
    write_token(path, refresh_token)
    print(f"\nRefresh token written to {path} (mode 0600).", file=sys.stderr)
    print(
        "Account-wide access is now configured -- every app your Podio account can see is "
        "reachable, and app tokens are no longer needed.",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
