from __future__ import annotations

import json
import sys
from pathlib import Path

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from podio_client import (  # noqa: E402
    PodioClient,
    PodioConfig,
    PodioConfigError,
    PodioError,
    load_config,
    parse_apps,
)
from podio_client import _Token  # noqa: E402

BASE_ENV = {
    "PODIO_CLIENT_ID": "cid",
    "PODIO_CLIENT_SECRET": "secret",
    "PODIO_APPS": "deals=123:tok",
}


def make_config(**overrides) -> PodioConfig:
    config = load_config(dict(BASE_ENV))
    for key, value in overrides.items():
        setattr(config, key, value)
    return config


class Recorder:
    """A stand-in Podio, recording requests and replaying queued responses."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.requests: list[httpx.Request] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        status, body = self.responses.pop(0)
        return httpx.Response(status, json=body)

    def client(self) -> PodioClient:
        transport = httpx.MockTransport(self.handler)
        return PodioClient(make_config(), httpx.AsyncClient(transport=transport))


TOKEN = (200, {"access_token": "tok-1", "expires_in": 28800, "refresh_token": "refresh-1"})


# -- config parsing ----------------------------------------------------


def test_parse_apps_compact_form():
    apps = parse_apps(" deals=123:abc , leads=456:def ")
    assert set(apps) == {"deals", "leads"}
    assert apps["deals"].app_id == "123"
    assert apps["leads"].app_token == "def"


def test_parse_apps_json_form_coerces_numeric_app_id():
    apps = parse_apps(json.dumps({"deals": {"app_id": 123, "app_token": "abc"}}))
    assert apps["deals"].app_id == "123"


@pytest.mark.parametrize("spec", ["deals", "deals=123", "=123:abc", "deals=:abc"])
def test_parse_apps_rejects_malformed_entries(spec):
    with pytest.raises(PodioConfigError):
        parse_apps(spec)


def test_parse_apps_rejects_json_entry_missing_token():
    with pytest.raises(PodioConfigError, match="app_token"):
        parse_apps(json.dumps({"deals": {"app_id": 123}}))


def test_load_config_requires_credentials():
    with pytest.raises(PodioConfigError, match="PODIO_CLIENT_ID"):
        load_config({"PODIO_APPS": "deals=1:2"})


def test_load_config_requires_at_least_one_app():
    with pytest.raises(PodioConfigError, match="No Podio apps are usable"):
        load_config({"PODIO_CLIENT_ID": "a", "PODIO_CLIENT_SECRET": "b"})


def test_load_config_reads_apps_file(tmp_path):
    path = tmp_path / "apps.json"
    path.write_text(json.dumps({"deals": {"app_id": "9", "app_token": "t"}}))
    config = load_config({**BASE_ENV, "PODIO_APPS_FILE": str(path)})
    assert config.apps["deals"].app_id == "9"


def test_blank_json_token_records_the_app_as_unconfigured():
    spec = json.dumps(
        {
            "_comment": "ignored",
            "deals": {"app_id": "1", "app_token": "real"},
            "labs": {"app_id": "2", "app_token": ""},
            "customers": {"app_id": "3", "app_token": "your-app-token"},
        }
    )
    config = load_config({**BASE_ENV, "PODIO_APPS": spec})
    assert set(config.apps) == {"deals"}
    assert config.unconfigured == ["customers", "labs"]


def test_all_tokens_blank_is_a_config_error_naming_the_count():
    spec = json.dumps({"labs": {"app_id": "2", "app_token": ""}})
    with pytest.raises(PodioConfigError, match="1 app\\(s\\) are listed but have no token"):
        load_config({**BASE_ENV, "PODIO_APPS": spec})


def test_unconfigured_alias_gets_a_token_specific_error():
    spec = json.dumps(
        {"deals": {"app_id": "1", "app_token": "real"}, "labs": {"app_id": "2", "app_token": ""}}
    )
    config = load_config({**BASE_ENV, "PODIO_APPS": spec})
    with pytest.raises(PodioConfigError, match="has no app_token"):
        config.credentials_for("labs")


def test_compact_form_still_requires_a_token():
    with pytest.raises(PodioConfigError, match="Malformed"):
        parse_apps("deals=123:")


def test_credentials_for_unknown_alias_lists_known_ones():
    with pytest.raises(PodioConfigError, match="Configured apps: deals"):
        make_config().credentials_for("nope")


# -- authentication ----------------------------------------------------


@pytest.mark.asyncio
async def test_app_auth_sends_grant_and_caches_token():
    recorder = Recorder([TOKEN, (200, {"item_id": 1}), (200, {"item_id": 2})])
    client = recorder.client()

    await client.request("deals", "GET", "/item/1")
    await client.request("deals", "GET", "/item/2")

    auth = recorder.requests[0]
    assert auth.url.path == "/oauth/token/v2"
    body = dict(pair.split("=") for pair in auth.content.decode().split("&"))
    assert body["grant_type"] == "app"
    assert body["app_id"] == "123"
    assert body["client_secret"] == "secret"

    # One token fetch, then two API calls carrying it.
    assert len(recorder.requests) == 3
    assert recorder.requests[1].headers["Authorization"] == "OAuth2 tok-1"


@pytest.mark.asyncio
async def test_expired_token_is_refreshed_with_refresh_token():
    recorder = Recorder(
        [TOKEN, (200, {"ok": 1}), (200, {"access_token": "tok-2", "expires_in": 28800}), (200, {"ok": 2})]
    )
    client = recorder.client()
    await client.request("deals", "GET", "/item/1")

    client._tokens["deals"].expires_at = 0
    await client.request("deals", "GET", "/item/2")

    refresh_body = recorder.requests[2].content.decode()
    assert "grant_type=refresh_token" in refresh_body
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
    # A cached token that has gone stale but still carries a refresh token.
    client._tokens["deals"] = _Token("stale", expires_at=0, refresh_token="refresh-1")

    await client.request("deals", "GET", "/item/1")

    assert "grant_type=refresh_token" in recorder.requests[0].content.decode()
    assert "grant_type=app" in recorder.requests[1].content.decode()
    assert recorder.requests[2].headers["Authorization"] == "OAuth2 tok-3"


@pytest.mark.asyncio
async def test_unauthorized_response_is_retried_once_with_a_new_token():
    recorder = Recorder(
        [TOKEN, (401, {"error": "invalid_token"}), (200, {"access_token": "tok-2", "expires_in": 28800}), (200, {"ok": 1})]
    )
    client = recorder.client()
    assert await client.request("deals", "GET", "/item/1") == {"ok": 1}
    assert len(recorder.requests) == 4


@pytest.mark.asyncio
async def test_persistent_unauthorized_surfaces_as_error():
    recorder = Recorder([TOKEN, (401, {"error": "invalid_token"}), TOKEN, (401, {"error": "invalid_token"})])
    client = recorder.client()
    with pytest.raises(PodioError, match="401"):
        await client.request("deals", "GET", "/item/1")


@pytest.mark.asyncio
async def test_auth_failure_message_includes_podio_description():
    recorder = Recorder([(401, {"error": "invalid_client", "error_description": "Invalid client"})])
    client = recorder.client()
    with pytest.raises(PodioError, match="Invalid client"):
        await client.request("deals", "GET", "/item/1")


# -- response handling -------------------------------------------------


@pytest.mark.asyncio
async def test_rate_limit_status_is_reported_clearly():
    recorder = Recorder([TOKEN, (420, {"error": "rate_limit"})])
    client = recorder.client()
    with pytest.raises(PodioError, match="rate limit"):
        await client.request("deals", "GET", "/item/1")


@pytest.mark.asyncio
async def test_empty_body_becomes_none():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/oauth/token/v2":
            return httpx.Response(200, json=TOKEN[1])
        return httpx.Response(204)

    client = PodioClient(make_config(), httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    assert await client.request("deals", "DELETE", "/item/1") is None


@pytest.mark.asyncio
async def test_api_error_includes_podio_error_detail():
    recorder = Recorder([TOKEN, (404, {"error": "not_found", "error_description": "No item"})])
    client = recorder.client()
    with pytest.raises(PodioError, match="No item"):
        await client.request("deals", "GET", "/item/1")
