"""End-to-end check: drive the stdio server against a stub Podio API.

This exercises the parts unit tests cannot -- that the tool schemas are valid,
that the server starts under a real MCP client, and that a tool call makes the
Podio requests we expect and returns flattened results.
"""

from __future__ import annotations

import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pytest
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

SERVER = Path(__file__).resolve().parents[1] / "podio_mcp.py"

APP = {
    "app_id": 123,
    "config": {"name": "Deals", "item_name": "Deal"},
    "fields": [
        {
            "field_id": 1,
            "external_id": "title",
            "type": "text",
            "status": "active",
            "config": {"label": "Title", "required": True},
        }
    ],
}

ITEMS = {
    "total": 2,
    "filtered": 1,
    "items": [
        {
            "item_id": 55,
            "app_item_id": 3,
            "title": "Acme",
            "fields": [
                {"external_id": "title", "field_id": 1, "type": "text", "values": [{"value": "Acme"}]},
                {
                    "external_id": "status",
                    "field_id": 2,
                    "type": "category",
                    "values": [{"value": {"id": 1, "text": "Open", "color": "abc"}}],
                },
            ],
        }
    ],
}


class StubPodio(BaseHTTPRequestHandler):
    calls: list[tuple[str, str]] = []

    def log_message(self, *args):  # keep pytest output clean
        pass

    def _reply(self, payload):
        body = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        StubPodio.calls.append(("POST", self.path))
        self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if self.path == "/oauth/token/v2":
            self._reply({"access_token": "tok", "expires_in": 28800})
        else:
            self._reply(ITEMS)

    def do_GET(self):
        StubPodio.calls.append(("GET", self.path))
        self._reply(APP)


@pytest.fixture
def stub_podio():
    StubPodio.calls = []
    server = HTTPServer(("127.0.0.1", 0), StubPodio)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_port}"
    server.shutdown()


@pytest.fixture
def session_params(stub_podio):
    return StdioServerParameters(
        command=sys.executable,
        args=[str(SERVER)],
        env={
            "PATH": "/usr/bin:/bin",
            "PODIO_CLIENT_ID": "cid",
            "PODIO_CLIENT_SECRET": "secret",
            "PODIO_APPS": "deals=123:apptoken",
            "PODIO_API_BASE": stub_podio,
        },
    )


@pytest.mark.asyncio
async def test_tools_are_advertised_with_schemas(session_params):
    async with stdio_client(session_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = (await session.list_tools()).tools

    names = {tool.name for tool in tools}
    assert {"podio_list_apps", "podio_find_items", "podio_create_item", "podio_delete_item"} <= names
    find = next(tool for tool in tools if tool.name == "podio_find_items")
    assert "app" in find.input_schema["properties"]
    assert find.input_schema["required"] == ["app"]
    delete = next(tool for tool in tools if tool.name == "podio_delete_item")
    assert delete.annotations.destructive_hint is True


@pytest.mark.asyncio
async def test_list_apps_reports_configured_aliases(session_params):
    async with stdio_client(session_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool("podio_list_apps", {})

    assert result.structured_content["apps"] == [{"alias": "deals", "app_id": "123"}]


@pytest.mark.asyncio
async def test_find_items_authenticates_then_filters_and_flattens(session_params):
    async with stdio_client(session_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(
                "podio_find_items", {"app": "deals", "filters": {"status": [1]}, "limit": 5}
            )

    assert StubPodio.calls == [
        ("POST", "/oauth/token/v2"),
        ("POST", "/item/app/123/filter/"),
    ]
    payload = result.structured_content
    assert payload["total"] == 2
    assert payload["items"][0]["fields"] == {"title": "Acme", "status": {"id": 1, "text": "Open"}}


@pytest.mark.asyncio
async def test_unknown_app_alias_is_a_tool_error(session_params):
    async with stdio_client(session_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool("podio_get_app_schema", {"app": "nope"})

    assert result.is_error
    assert "Configured apps: deals" in result.content[0].text


@pytest.mark.asyncio
async def test_missing_credentials_fail_at_startup(stub_podio):
    params = StdioServerParameters(
        command=sys.executable,
        args=[str(SERVER)],
        env={"PATH": "/usr/bin:/bin", "PODIO_APPS": "deals=1:2"},
    )
    with pytest.raises(Exception):
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
