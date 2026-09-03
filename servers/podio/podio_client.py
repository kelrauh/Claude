"""Podio REST client, with either account-wide or per-app authentication.

Two OAuth flows are supported, and they answer different needs:

* **User auth** (``grant_type=refresh_token``) -- account-wide.  One browser
  login, run once via ``podio_auth.py``, yields a refresh token that is then
  used headlessly forever.  Every app the account can see is reachable, so
  cross-app questions and org/space browsing work.
* **App auth** (``grant_type=app``) -- one token per Podio app, no browser at
  all, but scoped: a token for one app can read nothing else.

When a refresh token is configured it is used for everything, and app tokens
are ignored: one credential is simpler than twenty-three, and only the
account-wide token can follow a relationship into another app.  App auth
remains the fallback when no refresh token is present.

See https://developers.podio.com/authentication
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx

DEFAULT_API_BASE = "https://api.podio.com"
DEFAULT_TOKEN_FILE = ".podio-token.json"

# Refresh a little before Podio actually expires the token (8h by default) so a
# long-running call never starts with a token that dies mid-flight.
TOKEN_EXPIRY_MARGIN_SECONDS = 300

# The scope key for the account-wide token, as opposed to "app:<alias>".
USER_SCOPE = "user"

# Values that mean "not filled in yet" rather than a real token.
_TOKEN_PLACEHOLDERS = frozenset({"your-app-token", "app-token", "todo", "changeme"})


def should_retry_as_form(response: httpx.Response) -> bool:
    """Whether a token response looks like the body encoding was the problem.

    ``/oauth/token/v2`` takes a JSON body -- posting form-encoded fields gets
    ``Invalid value null (null): must be object``, since Podio parses the body as
    JSON and finds none.  Older deployments accept only form encoding, so a
    rejection that names the body is retried the other way before giving up.
    """
    if response.status_code not in (400, 415):
        return False
    return "must be object" in response.text or response.status_code == 415


class PodioError(RuntimeError):
    """An error surfaced by the Podio API or by our configuration of it."""


class PodioConfigError(PodioError):
    """The server is missing credentials or was pointed at an unknown app."""


@dataclass(frozen=True)
class AppCredentials:
    """One entry from the app catalogue. ``app_token`` may be empty."""

    alias: str
    app_id: str
    app_token: str = ""

    @property
    def has_token(self) -> bool:
        return not _token_unset(self.app_token)


@dataclass
class _Token:
    access_token: str
    expires_at: float
    refresh_token: str | None = None

    @property
    def expired(self) -> bool:
        return time.time() >= self.expires_at - TOKEN_EXPIRY_MARGIN_SECONDS


def _token_unset(app_token: str) -> bool:
    """Whether a token is blank or an unedited placeholder."""
    return not app_token or app_token in _TOKEN_PLACEHOLDERS or app_token.startswith("<")


class RefreshTokenStore:
    """Holds the account-wide refresh token, surviving Podio's rotation of it.

    Podio issues a new refresh token every time one is redeemed, so a token kept
    only in an environment variable works exactly once per session and then goes
    stale.  Persisting each new value is what makes user auth survive a restart.
    """

    def __init__(self, path: Path | None, seed: str | None = None) -> None:
        self.path = path
        self._cached = seed or None
        self._warned = False

    def load(self) -> str | None:
        if self.path and self.path.exists():
            try:
                stored = json.loads(self.path.read_text(encoding="utf-8")).get("refresh_token")
            except (OSError, ValueError, AttributeError) as exc:
                raise PodioConfigError(f"Cannot read token file {self.path}: {exc}") from exc
            if stored:
                return stored
        return self._cached

    def save(self, refresh_token: str) -> None:
        self._cached = refresh_token
        if not self.path:
            if not self._warned:
                print(
                    "podio-mcp: PODIO_REFRESH_TOKEN rotated but no PODIO_TOKEN_FILE is set, so "
                    "the new value cannot be persisted; re-run podio_auth.py after this session.",
                    file=sys.stderr,
                )
                self._warned = True
            return
        payload = json.dumps({"refresh_token": refresh_token}, indent=2) + "\n"
        temporary = self.path.with_suffix(self.path.suffix + ".tmp")
        temporary.write_text(payload, encoding="utf-8")
        temporary.chmod(0o600)
        temporary.replace(self.path)

    @property
    def available(self) -> bool:
        try:
            return bool(self.load())
        except PodioConfigError:
            return False


@dataclass
class PodioConfig:
    client_id: str
    client_secret: str
    # The app catalogue: every alias we know an app_id for, whether or not it
    # carries an app token.
    apps: dict[str, AppCredentials] = field(default_factory=dict)
    tokens: RefreshTokenStore = field(default_factory=lambda: RefreshTokenStore(None))
    api_base: str = DEFAULT_API_BASE

    @property
    def user_auth(self) -> bool:
        """Whether account-wide auth is configured."""
        return self.tokens.available

    @property
    def app_authed(self) -> list[str]:
        return sorted(alias for alias, app in self.apps.items() if app.has_token)

    @property
    def unconfigured(self) -> list[str]:
        """Aliases with no app token -- unreachable unless user auth is on."""
        return sorted(alias for alias, app in self.apps.items() if not app.has_token)

    def reachable(self, alias: str) -> bool:
        app = self.apps.get(alias)
        return bool(app and (self.user_auth or app.has_token))

    def resolve(self, app: str) -> tuple[str, str]:
        """Map an alias or a numeric app id to ``(app_id, scope)``.

        User auth is preferred wherever it is available: it is one credential
        instead of many, and it is the only one that can follow a relationship
        field into another app.
        """
        key = str(app).strip()
        known = self.apps.get(key)

        if known is None and key.isdigit():
            if self.user_auth:
                return key, USER_SCOPE
            raise PodioConfigError(
                f"App id {key} can only be used with account-wide auth, which is not configured. "
                "Run podio_auth.py, or add this app under an alias with its own app token."
            )

        if known is None:
            catalogue = ", ".join(sorted(self.apps)) or "<none>"
            raise PodioConfigError(f"Unknown app {key!r}. Known apps: {catalogue}.")

        if self.user_auth:
            return known.app_id, USER_SCOPE
        if known.has_token:
            return known.app_id, f"app:{key}"
        raise PodioConfigError(
            f"App {key!r} (id {known.app_id}) has no app_token and account-wide auth is not "
            "configured, so it cannot be reached. Either run podio_auth.py once for access to "
            "every app, or add this app's token from Podio > the app > Developer."
        )

    def scope_for(self, app: str | None) -> str:
        """The scope to call with, when only the credential matters.

        Item-level endpoints address the item directly, so under account-wide
        auth no app needs naming at all; app auth still needs to know which
        app's token to use.
        """
        if app is None or str(app).strip() == "":
            if self.user_auth:
                return USER_SCOPE
            raise PodioConfigError(
                "An 'app' is required: app tokens are per app, so the server cannot tell which "
                "token to use. Run podio_auth.py for account-wide access to drop this argument."
            )
        return self.resolve(app)[1]

    def app_credentials(self, alias: str) -> AppCredentials:
        try:
            return self.apps[alias]
        except KeyError:
            raise PodioConfigError(f"Unknown app {alias!r}.") from None


def parse_apps(spec: str) -> dict[str, AppCredentials]:
    """Parse a ``PODIO_APPS`` value or the contents of ``PODIO_APPS_FILE``.

    Two shapes are accepted, because they suit different places:

    * compact, for a single env var in ``.mcp.json``::

          deals=123456789:a1b2c3,leads=987654321:d4e5f6

    * JSON, for a file listing many apps::

          {"deals": {"app_id": "123456789", "app_token": "a1b2c3"}}

    In the JSON form ``app_token`` may be empty or omitted, which records the app
    without an app-auth token: such an app is reachable under account-wide auth,
    and reported as unconfigured otherwise.  Keys starting with an underscore are
    ignored, so a template can carry a ``_comment``.
    """
    spec = spec.strip()
    if not spec:
        return {}

    if spec.startswith("{"):
        try:
            raw = json.loads(spec)
        except json.JSONDecodeError as exc:
            raise PodioConfigError(f"App list is not valid JSON: {exc}") from exc
        apps: dict[str, AppCredentials] = {}
        for alias, entry in raw.items():
            if alias.startswith("_"):
                continue
            if not isinstance(entry, dict) or "app_id" not in entry:
                raise PodioConfigError(f"App {alias!r} must be an object with an 'app_id'.")
            apps[alias] = AppCredentials(
                alias, str(entry["app_id"]), str(entry.get("app_token") or "").strip()
            )
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
            spec = Path(apps_file).read_text(encoding="utf-8")
        except OSError as exc:
            raise PodioConfigError(f"Cannot read PODIO_APPS_FILE {apps_file!r}: {exc}") from exc

    token_file = env.get("PODIO_TOKEN_FILE", DEFAULT_TOKEN_FILE).strip()
    tokens = RefreshTokenStore(
        Path(token_file) if token_file else None,
        seed=env.get("PODIO_REFRESH_TOKEN", "").strip() or None,
    )

    config = PodioConfig(
        client_id=client_id,
        client_secret=client_secret,
        apps=parse_apps(spec),
        tokens=tokens,
        api_base=env.get("PODIO_API_BASE", DEFAULT_API_BASE).rstrip("/"),
    )

    if not config.user_auth and not config.app_authed:
        listed = (
            f" {len(config.unconfigured)} app(s) are listed without a token."
            if config.unconfigured
            else ""
        )
        raise PodioConfigError(
            "No usable Podio credentials. Either run 'uv run --script servers/podio/podio_auth.py' "
            "once for account-wide access, or set PODIO_APPS to at least one "
            f"'alias=app_id:app_token' entry (Podio > your app > Developer).{listed}"
        )

    return config


class PodioClient:
    """Authenticated access to the Podio REST API."""

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

    def _lock(self, scope: str) -> asyncio.Lock:
        return self._locks.setdefault(scope, asyncio.Lock())

    async def _token_request(self, payload: dict[str, str]) -> _Token:
        url = f"{self._config.api_base}/oauth/token/v2"
        body = {
            **payload,
            "client_id": self._config.client_id,
            "client_secret": self._config.client_secret,
        }
        response = await self._http.post(url, json=body)
        if should_retry_as_form(response):
            response = await self._http.post(url, data=body)
        if response.status_code >= 400:
            raise PodioError(f"Podio authentication failed: {_describe_error(response)}")
        body = response.json()
        return _Token(
            access_token=body["access_token"],
            expires_at=time.time() + float(body.get("expires_in", 3600)),
            refresh_token=body.get("refresh_token"),
        )

    async def _authenticate(self, scope: str) -> _Token:
        """Mint a token from the credential the scope names."""
        if scope == USER_SCOPE:
            refresh_token = self._config.tokens.load()
            if not refresh_token:
                raise PodioConfigError(
                    "Account-wide auth is not set up. Run "
                    "'uv run --script servers/podio/podio_auth.py' to authorize once."
                )
            token = await self._token_request(
                {"grant_type": "refresh_token", "refresh_token": refresh_token}
            )
            if token.refresh_token:
                # Podio rotates the refresh token on every redemption; losing the
                # new one would mean re-authorizing in a browser.
                self._config.tokens.save(token.refresh_token)
            return token

        credentials = self._config.app_credentials(scope.removeprefix("app:"))
        return await self._token_request(
            {
                "grant_type": "app",
                "app_id": credentials.app_id,
                "app_token": credentials.app_token,
            }
        )

    async def _access_token(self, scope: str, *, force: bool = False) -> str:
        async with self._lock(scope):
            token = self._tokens.get(scope)
            if token and not token.expired and not force:
                return token.access_token

            if scope != USER_SCOPE and token and token.refresh_token and not force:
                try:
                    token = await self._token_request(
                        {"grant_type": "refresh_token", "refresh_token": token.refresh_token}
                    )
                except PodioError:
                    token = None  # fall through to a fresh app auth

            if token is None or token.expired or force:
                token = await self._authenticate(scope)

            self._tokens[scope] = token
            return token.access_token

    # -- requests -------------------------------------------------------

    async def request(
        self,
        scope: str,
        method: str,
        path: str,
        *,
        json_body: Any | None = None,
        params: dict[str, Any] | None = None,
    ) -> Any:
        """Call a Podio endpoint with the token for ``scope``.

        A 401 is retried once against a freshly minted token: Podio can revoke a
        token before its stated expiry, and re-authenticating is cheap.
        """
        url = f"{self._config.api_base}{path}"
        for attempt in (0, 1):
            token = await self._access_token(scope, force=attempt == 1)
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

    async def request_user(self, method: str, path: str, **kwargs: Any) -> Any:
        """Call an endpoint that only account-wide auth can reach."""
        if not self._config.user_auth:
            raise PodioConfigError(
                f"{path} needs account-wide access, which app tokens cannot provide. "
                "Run 'uv run --script servers/podio/podio_auth.py' to authorize once."
            )
        return await self.request(USER_SCOPE, method, path, **kwargs)


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
    if response.status_code in (420, 429):
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
