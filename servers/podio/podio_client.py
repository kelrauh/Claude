"""Podio REST client using the app-authentication OAuth flow.

App auth (``grant_type=app``) trades a client ID/secret plus a per-app
``app_id``/``app_token`` pair for an access token scoped to that single Podio
app.  It needs no browser and no user password, which makes it the right fit
for a headless MCP server -- at the cost of being scoped: every call has to
name which configured app it is for.

See https://developers.podio.com/authentication/app_auth
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

DEFAULT_API_BASE = "https://api.podio.com"

# Values that mean "not filled in yet" rather than a real token.
_TOKEN_PLACEHOLDERS = frozenset({"your-app-token", "app-token", "todo", "changeme"})

# Refresh a little before Podio actually expires the token (8h by default) so a
# long-running call never starts with a token that dies mid-flight.
TOKEN_EXPIRY_MARGIN_SECONDS = 300


class PodioError(RuntimeError):
    """An error surfaced by the Podio API or by our configuration of it."""


class PodioConfigError(PodioError):
    """The server is missing credentials or was pointed at an unknown app."""


@dataclass(frozen=True)
class AppCredentials:
    """The per-app half of the app-auth credential pair."""

    alias: str
    app_id: str
    app_token: str


@dataclass
class _Token:
    access_token: str
    expires_at: float
    refresh_token: str | None = None

    @property
    def expired(self) -> bool:
        return time.time() >= self.expires_at - TOKEN_EXPIRY_MARGIN_SECONDS


@dataclass
class PodioConfig:
    client_id: str
    client_secret: str
    apps: dict[str, AppCredentials] = field(default_factory=dict)
    # Aliases listed with no app token yet -- known to exist, but not reachable.
    # Kept separate so the error for one can say that, rather than "unknown app".
    unconfigured: list[str] = field(default_factory=list)
    api_base: str = DEFAULT_API_BASE

    def credentials_for(self, alias: str) -> AppCredentials:
        try:
            return self.apps[alias]
        except KeyError:
            pass
        known = ", ".join(sorted(self.apps)) or "<none configured>"
        if alias in self.unconfigured:
            raise PodioConfigError(
                f"App {alias!r} is listed but has no app_token, so it cannot be reached. "
                f"Add its token (Podio > the app > Developer). Configured apps: {known}."
            )
        raise PodioConfigError(
            f"Unknown app {alias!r}. Configured apps: {known}. "
            "Add it to PODIO_APPS or PODIO_APPS_FILE."
        )


def parse_apps(spec: str) -> dict[str, AppCredentials]:
    """Parse the ``PODIO_APPS`` value.

    Two shapes are accepted, because they suit different places:

    * compact, for a single env var in ``.mcp.json``::

          deals=123456789:a1b2c3,leads=987654321:d4e5f6

    * JSON, for a file listing many apps::

          {"deals": {"app_id": "123456789", "app_token": "a1b2c3"}}

    In the JSON form an ``app_token`` may be left empty, which records the app
    without making it reachable: that is what lets a generated template list
    every app in an org while only the ones you use get a token.  Keys starting
    with an underscore are ignored, so a template can carry a ``_comment``.
    """
    spec = spec.strip()
    if not spec:
        return {}

    if spec.startswith("{"):
        try:
            raw = json.loads(spec)
        except json.JSONDecodeError as exc:
            raise PodioConfigError(f"PODIO_APPS is not valid JSON: {exc}") from exc
        apps: dict[str, AppCredentials] = {}
        for alias, entry in raw.items():
            if alias.startswith("_"):
                continue
            if not isinstance(entry, dict) or "app_id" not in entry or "app_token" not in entry:
                raise PodioConfigError(
                    f"App {alias!r} must be an object with 'app_id' and 'app_token'."
                )
            apps[alias] = AppCredentials(alias, str(entry["app_id"]), str(entry["app_token"]).strip())
        return apps

    apps = {}
    for chunk in spec.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        alias, sep, pair = chunk.partition("=")
        app_id, colon, app_token = pair.partition(":")
        if not (sep and colon and alias.strip() and app_id.strip() and app_token.strip()):
            raise PodioConfigError(
                f"Malformed app entry {chunk!r}; expected 'alias=app_id:app_token'."
            )
        alias = alias.strip()
        apps[alias] = AppCredentials(alias, app_id.strip(), app_token.strip())
    return apps


def _token_unset(app_token: str) -> bool:
    """Whether an app token is a blank or an unedited placeholder."""
    return not app_token or app_token in _TOKEN_PLACEHOLDERS or app_token.startswith("<")


def load_config(env: dict[str, str] | None = None) -> PodioConfig:
    """Build the server config from the environment."""
    env = os.environ if env is None else env

    client_id = env.get("PODIO_CLIENT_ID", "").strip()
    client_secret = env.get("PODIO_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        raise PodioConfigError(
            "PODIO_CLIENT_ID and PODIO_CLIENT_SECRET must be set. "
            "Create an API key at https://podio.com/settings/api"
        )

    spec = env.get("PODIO_APPS", "")
    apps_file = env.get("PODIO_APPS_FILE", "").strip()
    if apps_file:
        try:
            with open(apps_file, encoding="utf-8") as handle:
                spec = handle.read()
        except OSError as exc:
            raise PodioConfigError(f"Cannot read PODIO_APPS_FILE {apps_file!r}: {exc}") from exc

    parsed = parse_apps(spec)
    apps = {alias: creds for alias, creds in parsed.items() if not _token_unset(creds.app_token)}
    unconfigured = sorted(alias for alias in parsed if alias not in apps)

    if not apps:
        listed = f" {len(unconfigured)} app(s) are listed but have no token." if unconfigured else ""
        raise PodioConfigError(
            "No Podio apps are usable. Set PODIO_APPS (or PODIO_APPS_FILE) to at least one "
            "'alias=app_id:app_token' entry -- find the app_id and app_token under "
            f"Podio > your app > Developer.{listed}"
        )

    return PodioConfig(
        client_id=client_id,
        client_secret=client_secret,
        apps=apps,
        unconfigured=unconfigured,
        api_base=env.get("PODIO_API_BASE", DEFAULT_API_BASE).rstrip("/"),
    )


class PodioClient:
    """Authenticated, app-scoped access to the Podio REST API."""

    def __init__(self, config: PodioConfig, http: httpx.AsyncClient | None = None) -> None:
        self._config = config
        self._http = http or httpx.AsyncClient(timeout=30.0)
        self._tokens: dict[str, _Token] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    @property
    def config(self) -> PodioConfig:
        return self._config

    async def aclose(self) -> None:
        await self._http.aclose()

    # -- authentication -------------------------------------------------

    def _lock(self, alias: str) -> asyncio.Lock:
        return self._locks.setdefault(alias, asyncio.Lock())

    async def _token_request(self, payload: dict[str, str]) -> _Token:
        response = await self._http.post(
            f"{self._config.api_base}/oauth/token/v2",
            data={
                **payload,
                "client_id": self._config.client_id,
                "client_secret": self._config.client_secret,
            },
        )
        if response.status_code >= 400:
            raise PodioError(f"Podio authentication failed: {_describe_error(response)}")
        body = response.json()
        return _Token(
            access_token=body["access_token"],
            expires_at=time.time() + float(body.get("expires_in", 3600)),
            refresh_token=body.get("refresh_token"),
        )

    async def _access_token(self, alias: str, *, force: bool = False) -> str:
        credentials = self._config.credentials_for(alias)
        async with self._lock(alias):
            token = self._tokens.get(alias)
            if token and not token.expired and not force:
                return token.access_token

            if token and token.refresh_token and not force:
                try:
                    token = await self._token_request(
                        {"grant_type": "refresh_token", "refresh_token": token.refresh_token}
                    )
                except PodioError:
                    token = None  # fall through to a fresh app auth

            if token is None or token.expired or force:
                token = await self._token_request(
                    {
                        "grant_type": "app",
                        "app_id": credentials.app_id,
                        "app_token": credentials.app_token,
                    }
                )

            self._tokens[alias] = token
            return token.access_token

    # -- requests -------------------------------------------------------

    async def request(
        self,
        alias: str,
        method: str,
        path: str,
        *,
        json_body: Any | None = None,
        params: dict[str, Any] | None = None,
    ) -> Any:
        """Call a Podio endpoint with the token for ``alias``.

        A 401 is retried once against a freshly minted token: Podio can revoke a
        token before its stated expiry, and re-authenticating is cheap.
        """
        url = f"{self._config.api_base}{path}"
        for attempt in (0, 1):
            token = await self._access_token(alias, force=attempt == 1)
            response = await self._http.request(
                method,
                url,
                json=json_body,
                params=params,
                headers={"Authorization": f"OAuth2 {token}"},
            )
            if response.status_code == 401 and attempt == 0:
                continue
            return _unwrap(response)
        raise AssertionError("unreachable")


def _describe_error(response: httpx.Response) -> str:
    """Turn a Podio error body into one readable line."""
    try:
        body = response.json()
    except ValueError:
        text = response.text.strip()
        return f"HTTP {response.status_code} {text[:300]}" if text else f"HTTP {response.status_code}"

    if not isinstance(body, dict):
        return f"HTTP {response.status_code} {body}"

    parts = [f"HTTP {response.status_code}"]
    for key in ("error", "error_description", "error_detail"):
        value = body.get(key)
        if isinstance(value, str) and value:
            parts.append(value)
    if len(parts) == 1:
        parts.append(json.dumps(body)[:300])
    return " ".join(parts)


def _unwrap(response: httpx.Response) -> Any:
    if response.status_code == 429 or response.status_code == 420:
        raise PodioError(
            f"Podio rate limit reached: {_describe_error(response)}. "
            "Podio allows 1000 calls/hour (250 for rate-limited endpoints); retry later."
        )
    if response.status_code >= 400:
        raise PodioError(_describe_error(response))
    if response.status_code == 204 or not response.content:
        return None
    try:
        return response.json()
    except ValueError:
        return response.text
