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

Podio only redirects back to the domain registered against the API key, so the
flow comes in two shapes:

* **Loopback** (default) -- needs the key's domain set to ``localhost``.  A
  throwaway web server catches the redirect and the code never leaves the
  machine.
* **Paste-back** -- for a key registered to any other domain, e.g. ``claude.ai``.
  Podio redirects the browser to a URL on that domain that need not exist; the
  authorization code is in the address bar, and you paste that URL back here::

      uv run --script servers/podio/podio_auth.py \\
          --redirect-uri https://claude.ai/podio-callback

  Non-loopback redirect URIs switch to this mode automatically.

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
LOOPBACK_HOSTS = frozenset({"localhost", "127.0.0.1", "[::1]", "::1"})
DEFAULT_API_BASE = "https://api.podio.com"
DEFAULT_TOKEN_FILE = ".podio-token.json"
CALLBACK_PATH = "/podio-callback"

PAGE = """<!doctype html><meta charset="utf-8"><title>Podio</title>
<body style="font:16px system-ui;margin:4rem auto;max-width:32rem">
<h1>{heading}</h1><p>{detail}</p></body>"""


def is_loopback(redirect_uri: str) -> bool:
    """Whether we can catch this redirect ourselves with a local web server."""
    return (urlparse(redirect_uri).hostname or "") in LOOPBACK_HOSTS


def extract_code(pasted: str, expected_state: str) -> str:
    """Pull the authorization code out of a pasted redirect URL.

    Accepts the whole URL or just its query string, since people copy both.
    """
    pasted = pasted.strip().strip('"').strip("'")
    if not pasted:
        raise SystemExit("Nothing pasted.")

    parsed = urlparse(pasted)
    query = parse_qs(parsed.query or (pasted if "=" in pasted else ""))
    values = {key: v[0] for key, v in query.items()}

    if not values:
        raise SystemExit(
            "That URL has no query string. Copy the address bar exactly as it is after the "
            "redirect -- it should contain '?code=...'."
        )
    if values.get("state") != expected_state:
        raise SystemExit(
            "State mismatch -- discarding this response rather than trusting it. "
            "Re-run and paste the URL from this attempt's redirect."
        )
    code = values.get("code")
    if not code:
        detail = values.get("error_description") or values.get("error") or "no code in the URL"
        raise SystemExit(f"Authorization failed: {detail}")
    return code


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


def authorize(
    client_id: str,
    client_secret: str,
    redirect_uri: str,
    api_base: str,
    timeout: int,
) -> str:
    """Run the browser flow and return the refresh token."""
    state = secrets.token_urlsafe(24)
    url = f"{AUTHORIZE_URL}?" + urlencode(
        {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "state": state,
        }
    )

    print(f"Open this URL to authorize (it should open automatically):\n\n  {url}\n")
    try:
        webbrowser.open(url)
    except Exception:  # a headless box has no browser; the printed URL still works
        pass

    if is_loopback(redirect_uri):
        code = _await_redirect(redirect_uri, state, timeout)
    else:
        print(
            f"Podio will send your browser to {redirect_uri} with the code in the address bar.\n"
            "That page does not need to exist -- an error page is fine, the URL is what matters."
        )
        code = extract_code(input("\nPaste the full URL you landed on:\n> "), state)

    response = httpx.post(
        f"{api_base}/oauth/token/v2",
        data={
            "grant_type": "authorization_code",
            "code": code,
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


def _await_redirect(redirect_uri: str, state: str, timeout: int) -> str:
    """Serve the redirect target locally and wait for Podio to hit it."""
    port = urlparse(redirect_uri).port or 80
    server = HTTPServer(("127.0.0.1", port), _Callback)
    threading.Thread(target=server.serve_forever, daemon=True).start()

    print(f"Waiting up to {timeout}s for the redirect back to {redirect_uri} ...")
    try:
        if not _Callback.done.wait(timeout):
            raise SystemExit("Timed out waiting for authorization.")
    finally:
        server.shutdown()

    query = _Callback.result
    if query.get("state") != state:
        raise SystemExit("State mismatch -- discarding this response rather than trusting it.")
    if "code" not in query:
        detail = query.get("error_description") or query.get("error") or "no code returned"
        raise SystemExit(f"Authorization failed: {detail}")
    return query["code"]


def write_token(path: Path, refresh_token: str) -> None:
    payload = json.dumps({"refresh_token": refresh_token}, indent=2) + "\n"
    path.write_text(payload, encoding="utf-8")
    path.chmod(0o600)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--redirect-uri",
        default=os.environ.get("PODIO_REDIRECT_URI", "").strip() or None,
        help=(
            "Redirect URI registered with the API key. Defaults to "
            f"http://localhost:8080{CALLBACK_PATH}. A non-loopback URI (e.g. "
            "https://claude.ai/podio-callback) switches to pasting the URL back."
        ),
    )
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

    redirect_uri = args.redirect_uri or f"http://localhost:{args.port}{CALLBACK_PATH}"
    refresh_token = authorize(
        client_id,
        client_secret,
        redirect_uri,
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
