from __future__ import annotations

import json
import sys
from pathlib import Path

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from podio_client import (  # noqa: E402
    USER_SCOPE,
    PodioClient,
    PodioConfigError,
    PodioError,
    RefreshTokenStore,
    _Token,
    load_config,
    parse_apps,
)

# PODIO_TOKEN_FILE is blanked so a stray token file in the working directory
# cannot silently flip these cases into account-wide auth.
BASE_ENV = {
    "PODIO_CLIENT_ID": "cid",
    "PODIO_CLIENT_SECRET": "secret",
    "PODIO_APPS": "deals=123:tok",
    "PODIO_TOKEN_FILE": "",
}

TOKEN = (200, {"access_token": "tok-1", "expires_in": 28800, "refresh_token": "refresh-1"})


def make_config(**env):
    return load_config({**BASE_ENV, **env})


class Recorder:
    """A stand-in Podio, recording requests and replaying queued responses."""

    def __init__(self, responses, **env):
        self.responses = list(responses)
        self.requests: list[httpx.Request] = []
        self.config = make_config(**env)

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        status, body = self.responses.pop(0)
        return httpx.Response(status, json=body)

    def client(self) -> PodioClient:
        return PodioClient(self.config, httpx.AsyncClient(transport=httpx.MockTransport(self.handler)))

    def form(self, index: int) -> dict[str, str]:
        """The token body of request ``index``, however it was encoded."""
        raw = self.requests[index].content.decode()
        if raw.startswith("{"):
            return json.loads(raw)
        return dict(pair.split("=", 1) for pair in raw.split("&"))


# -- config parsing ----------------------------------------------------


def test_parse_apps_compact_form():
    apps = parse_apps(" deals=123:abc , leads=456:def ")
    assert set(apps) == {"deals", "leads"}
    assert apps["deals"].app_id == "123"
    assert apps["leads"].app_token == "def"


def test_parse_apps_json_form_coerces_numeric_app_id():
    apps = parse_apps(json.dumps({"deals": {"app_id": 123, "app_token": "abc"}}))
    assert apps["deals"].app_id == "123"


@pytest.mark.parametrize("spec", ["deals", "deals=123", "=123:abc", "deals=:abc", "deals=123:"])
def test_parse_apps_rejects_malformed_compact_entries(spec):
    with pytest.raises(PodioConfigError):
        parse_apps(spec)


def test_parse_apps_json_entry_needs_an_app_id():
    with pytest.raises(PodioConfigError, match="app_id"):
        parse_apps(json.dumps({"deals": {"app_token": "abc"}}))


def test_parse_apps_json_token_is_optional_and_comments_are_skipped():
    apps = parse_apps(json.dumps({"_comment": "hi", "deals": {"app_id": "1"}}))
    assert set(apps) == {"deals"}
    assert apps["deals"].has_token is False


def test_load_config_requires_credentials():
    with pytest.raises(PodioConfigError, match="PODIO_CLIENT_ID"):
        load_config({"PODIO_APPS": "deals=1:2"})


def test_load_config_requires_some_usable_credential():
    with pytest.raises(PodioConfigError, match="No usable Podio credentials"):
        load_config({"PODIO_CLIENT_ID": "a", "PODIO_CLIENT_SECRET": "b", "PODIO_TOKEN_FILE": ""})


def test_all_tokens_blank_is_a_config_error_naming_the_count():
    spec = json.dumps({"labs": {"app_id": "2"}})
    with pytest.raises(PodioConfigError, match=r"1 app\(s\) are listed without a token"):
        load_config({**BASE_ENV, "PODIO_APPS": spec})


def test_load_config_reads_apps_file(tmp_path):
    path = tmp_path / "apps.json"
    path.write_text(json.dumps({"deals": {"app_id": "9", "app_token": "t"}}))
    assert make_config(PODIO_APPS_FILE=str(path)).apps["deals"].app_id == "9"


def test_token_less_apps_are_reported_as_unconfigured():
    spec = json.dumps({"deals": {"app_id": "1", "app_token": "real"}, "labs": {"app_id": "2"}})
    config = make_config(PODIO_APPS=spec)
    assert config.app_authed == ["deals"]
    assert config.unconfigured == ["labs"]
    assert config.reachable("labs") is False


# -- scope resolution --------------------------------------------------


def test_alias_with_a_token_resolves_to_app_scope():
    assert make_config().resolve("deals") == ("123", "app:deals")


def test_unknown_alias_lists_the_known_ones():
    with pytest.raises(PodioConfigError, match="Known apps: deals"):
        make_config().resolve("nope")


def test_token_less_alias_explains_both_ways_to_fix_it():
    spec = json.dumps({"deals": {"app_id": "1", "app_token": "real"}, "labs": {"app_id": "2"}})
    with pytest.raises(PodioConfigError, match="podio_auth.py"):
        make_config(PODIO_APPS=spec).resolve("labs")


def test_numeric_app_id_needs_account_wide_auth():
    with pytest.raises(PodioConfigError, match="account-wide auth"):
        make_config().resolve("999")


def test_scope_for_requires_an_app_under_app_auth():
    with pytest.raises(PodioConfigError, match="'app' is required"):
        make_config().scope_for(None)


def test_account_wide_auth_resolves_everything_to_the_user_scope():
    spec = json.dumps({"deals": {"app_id": "1", "app_token": "real"}, "labs": {"app_id": "2"}})
    config = make_config(PODIO_APPS=spec, PODIO_REFRESH_TOKEN="r")
    # Preferred even where an app token exists: one credential, and only this
    # one can follow a relationship into another app.
    assert config.resolve("deals") == ("1", USER_SCOPE)
    assert config.resolve("labs") == ("2", USER_SCOPE)
    assert config.resolve("99999") == ("99999", USER_SCOPE)
    assert config.scope_for(None) == USER_SCOPE
    assert config.reachable("labs") is True
    assert config.unconfigured == ["labs"]


def test_account_wide_auth_alone_needs_no_apps():
    config = load_config(
        {"PODIO_CLIENT_ID": "a", "PODIO_CLIENT_SECRET": "b", "PODIO_REFRESH_TOKEN": "r", "PODIO_TOKEN_FILE": ""}
    )
    assert config.user_auth is True
    assert config.apps == {}


# -- the refresh token store -------------------------------------------


def test_token_store_prefers_the_file_over_the_seed(tmp_path):
    path = tmp_path / "t.json"
    path.write_text(json.dumps({"refresh_token": "from-file"}))
    assert RefreshTokenStore(path, seed="from-env").load() == "from-file"


def test_token_store_falls_back_to_the_seed_when_no_file_exists(tmp_path):
    assert RefreshTokenStore(tmp_path / "missing.json", seed="from-env").load() == "from-env"


def test_token_store_save_is_readable_only_by_the_owner(tmp_path):
    path = tmp_path / "t.json"
    store = RefreshTokenStore(path)
    store.save("rotated")
    assert store.load() == "rotated"
    assert path.stat().st_mode & 0o777 == 0o600


def test_token_store_without_a_path_keeps_the_value_in_memory(capsys):
    store = RefreshTokenStore(None, seed="first")
    store.save("second")
    assert store.load() == "second"
    assert "cannot be persisted" in capsys.readouterr().err


def test_token_store_reports_a_corrupt_file(tmp_path):
    path = tmp_path / "t.json"
    path.write_text("not json")
    with pytest.raises(PodioConfigError, match="Cannot read token file"):
        RefreshTokenStore(path).load()


# -- app authentication ------------------------------------------------


@pytest.mark.asyncio
async def test_app_auth_sends_grant_and_caches_token():
    recorder = Recorder([TOKEN, (200, {"item_id": 1}), (200, {"item_id": 2})])
    client = recorder.client()

    await client.request("app:deals", "GET", "/item/1")
    await client.request("app:deals", "GET", "/item/2")

    assert recorder.requests[0].url.path == "/oauth/token/v2"
    body = recorder.form(0)
    assert body["grant_type"] == "app"
    assert body["app_id"] == "123"
    assert body["client_secret"] == "secret"

    # One token fetch, then two API calls carrying it.
    assert len(recorder.requests) == 3
    assert recorder.requests[1].headers["Authorization"] == "OAuth2 tok-1"


@pytest.mark.asyncio
async def test_expired_app_token_is_refreshed():
    recorder = Recorder(
        [TOKEN, (200, {"ok": 1}), (200, {"access_token": "tok-2", "expires_in": 28800}), (200, {"ok": 2})]
    )
    client = recorder.client()
    await client.request("app:deals", "GET", "/item/1")

    client._tokens["app:deals"].expires_at = 0
    await client.request("app:deals", "GET", "/item/2")

    assert recorder.form(2)["grant_type"] == "refresh_token"
    assert recorder.requests[3].headers["Authorization"] == "OAuth2 tok-2"


@pytest.mark.asyncio
async def test_failed_refresh_falls_back_to_app_auth():
    recorder = Recorder(
        [
            (400, {"error": "invalid_grant"}),
            (200, {"access_token": "tok-3", "expires_in": 28800}),
            (200, {"ok": 1}),
        ]
    )
    client = recorder.client()
    client._tokens["app:deals"] = _Token("stale", expires_at=0, refresh_token="refresh-1")

    await client.request("app:deals", "GET", "/item/1")

    assert recorder.form(0)["grant_type"] == "refresh_token"
    assert recorder.form(1)["grant_type"] == "app"
    assert recorder.requests[2].headers["Authorization"] == "OAuth2 tok-3"


# -- user authentication -----------------------------------------------


@pytest.mark.asyncio
async def test_user_auth_redeems_the_stored_refresh_token(tmp_path):
    path = tmp_path / "t.json"
    path.write_text(json.dumps({"refresh_token": "stored"}))
    recorder = Recorder(
        [(200, {"access_token": "u-1", "expires_in": 28800, "refresh_token": "rotated"}), (200, {"ok": 1})],
        PODIO_TOKEN_FILE=str(path),
    )
    client = recorder.client()

    await client.request(USER_SCOPE, "GET", "/org/")

    body = recorder.form(0)
    assert body["grant_type"] == "refresh_token"
    assert body["refresh_token"] == "stored"
    assert recorder.requests[1].headers["Authorization"] == "OAuth2 u-1"
    # The rotated token is persisted; missing it would mean re-authorizing.
    assert json.loads(path.read_text())["refresh_token"] == "rotated"


@pytest.mark.asyncio
async def test_user_scope_without_a_refresh_token_says_how_to_set_it_up():
    recorder = Recorder([])
    client = recorder.client()
    with pytest.raises(PodioConfigError, match="podio_auth.py"):
        await client.request(USER_SCOPE, "GET", "/org/")


@pytest.mark.asyncio
async def test_account_wide_endpoints_refuse_app_only_setups():
    recorder = Recorder([])
    client = recorder.client()
    with pytest.raises(PodioConfigError, match="account-wide access"):
        await client.request_user("GET", "/org/")
    assert recorder.requests == []


@pytest.mark.asyncio
async def test_account_wide_endpoints_run_under_user_auth(tmp_path):
    path = tmp_path / "t.json"
    path.write_text(json.dumps({"refresh_token": "stored"}))
    recorder = Recorder(
        [(200, {"access_token": "u-1", "expires_in": 28800}), (200, [{"org_id": 1}])],
        PODIO_TOKEN_FILE=str(path),
    )
    assert await recorder.client().request_user("GET", "/org/") == [{"org_id": 1}]


# -- response handling -------------------------------------------------


@pytest.mark.asyncio
async def test_unauthorized_response_is_retried_once_with_a_new_token():
    recorder = Recorder(
        [TOKEN, (401, {"error": "invalid_token"}), (200, {"access_token": "tok-2", "expires_in": 28800}), (200, {"ok": 1})]
    )
    assert await recorder.client().request("app:deals", "GET", "/item/1") == {"ok": 1}
    assert len(recorder.requests) == 4


@pytest.mark.asyncio
async def test_persistent_unauthorized_surfaces_as_error():
    recorder = Recorder([TOKEN, (401, {"error": "invalid_token"}), TOKEN, (401, {"error": "invalid_token"})])
    with pytest.raises(PodioError, match="401"):
        await recorder.client().request("app:deals", "GET", "/item/1")


@pytest.mark.asyncio
async def test_auth_failure_message_includes_podio_description():
    recorder = Recorder([(401, {"error": "invalid_client", "error_description": "Invalid client"})])
    with pytest.raises(PodioError, match="Invalid client"):
        await recorder.client().request("app:deals", "GET", "/item/1")


@pytest.mark.asyncio
async def test_rate_limit_status_is_reported_clearly():
    recorder = Recorder([TOKEN, (420, {"error": "rate_limit"})])
    with pytest.raises(PodioError, match="rate limit"):
        await recorder.client().request("app:deals", "GET", "/item/1")


@pytest.mark.asyncio
async def test_empty_body_becomes_none():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/oauth/token/v2":
            return httpx.Response(200, json=TOKEN[1])
        return httpx.Response(204)

    client = PodioClient(make_config(), httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    assert await client.request("app:deals", "DELETE", "/item/1") is None


@pytest.mark.asyncio
async def test_api_error_includes_podio_error_detail():
    recorder = Recorder([TOKEN, (404, {"error": "not_found", "error_description": "No item"})])
    with pytest.raises(PodioError, match="No item"):
        await recorder.client().request("app:deals", "GET", "/item/1")


# -- token body encoding -----------------------------------------------


@pytest.mark.asyncio
async def test_token_bodies_are_sent_as_json():
    """Podio's /oauth/token/v2 rejects a form-encoded body outright."""
    recorder = Recorder([TOKEN, (200, {"ok": 1})])
    await recorder.client().request("app:deals", "GET", "/item/1")

    request = recorder.requests[0]
    assert request.headers["content-type"].startswith("application/json")
    assert json.loads(request.content.decode())["grant_type"] == "app"


@pytest.mark.asyncio
async def test_a_body_rejection_is_retried_form_encoded():
    recorder = Recorder(
        [
            (400, {"error_description": "Invalid value null (null): must be object"}),
            TOKEN[1] and (200, TOKEN[1]),
            (200, {"ok": 1}),
        ]
    )
    assert await recorder.client().request("app:deals", "GET", "/item/1") == {"ok": 1}

    assert recorder.requests[0].headers["content-type"].startswith("application/json")
    assert recorder.requests[1].headers["content-type"].startswith(
        "application/x-www-form-urlencoded"
    )
    assert recorder.form(1)["grant_type"] == "app"


@pytest.mark.asyncio
async def test_an_unrelated_400_is_not_retried():
    recorder = Recorder([(400, {"error": "invalid_client", "error_description": "Invalid client"})])
    with pytest.raises(PodioError, match="Invalid client"):
        await recorder.client().request("app:deals", "GET", "/item/1")
    assert len(recorder.requests) == 1


# -- .env fallback -----------------------------------------------------


def test_dotenv_supplies_values_the_environment_lacks(tmp_path):
    path = tmp_path / ".env"
    path.write_text(
        "# a comment\n"
        "\n"
        "PODIO_CLIENT_ID=from-file\n"
        'PODIO_CLIENT_SECRET="quoted-secret"\n'
        "PODIO_APPS=deals=1:tok\n"
        "not-an-assignment\n"
    )
    config = load_config({"PODIO_TOKEN_FILE": ""}, dotenv=path)
    assert config.client_id == "from-file"
    assert config.client_secret == "quoted-secret"
    assert config.apps["deals"].app_id == "1"


def test_real_environment_wins_over_the_file(tmp_path):
    path = tmp_path / ".env"
    path.write_text("PODIO_CLIENT_ID=from-file\nPODIO_CLIENT_SECRET=s\nPODIO_APPS=deals=1:t\n")
    config = load_config({"PODIO_CLIENT_ID": "from-env", "PODIO_TOKEN_FILE": ""}, dotenv=path)
    assert config.client_id == "from-env"


def test_empty_environment_values_do_not_blank_the_file(tmp_path):
    # .mcp.json passes unset variables through as empty strings.
    path = tmp_path / ".env"
    path.write_text("PODIO_CLIENT_ID=from-file\nPODIO_CLIENT_SECRET=s\nPODIO_APPS=deals=1:t\n")
    config = load_config({"PODIO_CLIENT_ID": "", "PODIO_APPS": "", "PODIO_TOKEN_FILE": ""}, dotenv=path)
    assert config.client_id == "from-file"
    assert config.apps["deals"].app_id == "1"


def test_a_missing_dotenv_is_not_an_error(tmp_path):
    with pytest.raises(PodioConfigError, match="PODIO_CLIENT_ID"):
        load_config({"PODIO_TOKEN_FILE": ""}, dotenv=tmp_path / "absent")
