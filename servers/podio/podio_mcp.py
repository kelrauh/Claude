#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["mcp>=2.0", "httpx>=0.27"]
# ///
"""An MCP server over the Podio API, authenticated with the app-auth flow.

Every tool takes an ``app`` alias, because app authentication issues a token per
Podio app rather than per user: the aliases are the ones configured in
``PODIO_APPS``.  Run ``podio_list_apps`` first to see them, then
``podio_get_app_schema`` to learn a given app's field external_ids before
filtering or writing.

Required environment:
    PODIO_CLIENT_ID, PODIO_CLIENT_SECRET  -- from https://podio.com/settings/api
    PODIO_APPS                            -- 'alias=app_id:app_token,...'
                                             (or PODIO_APPS_FILE, holding JSON)
"""

from __future__ import annotations

import functools
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from mcp.server.mcpserver import MCPServer  # noqa: E402
from mcp.server.mcpserver.exceptions import ToolError  # noqa: E402
from mcp.types import ToolAnnotations  # noqa: E402

from podio_client import PodioClient, PodioConfigError, PodioError, load_config  # noqa: E402
from podio_items import simplify_app, simplify_item  # noqa: E402

MAX_LIMIT = 500

mcp = MCPServer(
    name="podio",
    version="0.1.0",
    instructions=__doc__,
)

_client: PodioClient | None = None


def client() -> PodioClient:
    global _client
    if _client is None:
        _client = PodioClient(load_config())
    return _client


def surface_errors(func):
    """Report Podio and configuration failures as tool errors the caller can read.

    Anything else stays an unexpected exception, which the SDK reports without
    its message -- that is the right default for a bug, but a rejected filter or
    a missing app token is information the model needs to correct itself.
    """

    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except PodioError as exc:
            raise ToolError(str(exc)) from exc

    return wrapper


def _read_only(idempotent: bool = True) -> ToolAnnotations:
    return ToolAnnotations(readOnlyHint=True, idempotentHint=idempotent, openWorldHint=True)


def _write(destructive: bool = False) -> ToolAnnotations:
    return ToolAnnotations(
        readOnlyHint=False, destructiveHint=destructive, idempotentHint=False, openWorldHint=True
    )


@mcp.tool(
    title="List configured Podio apps",
    description=(
        "List the Podio app aliases this server is configured for. Every other tool takes one "
        "of these aliases as its 'app' argument. Also lists aliases that are known but have no "
        "app token yet -- those exist in Podio but cannot be reached until a token is added. "
        "Makes no API call."
    ),
    annotations=_read_only(),
)
@surface_errors
async def podio_list_apps() -> dict[str, Any]:
    config = client().config
    result: dict[str, Any] = {
        "apps": [
            {"alias": credentials.alias, "app_id": credentials.app_id}
            for credentials in config.apps.values()
        ]
    }
    if config.unconfigured:
        result["unconfigured"] = config.unconfigured
        result["note"] = "Unconfigured apps need an app_token added before they can be used."
    return result


@mcp.tool(
    title="Get app schema",
    description=(
        "Get an app's field schema: each field's external_id, label, type, whether it is "
        "required, and the available options for category fields. Call this before filtering "
        "or writing items -- 'fields' arguments are keyed by external_id."
    ),
    annotations=_read_only(),
)
@surface_errors
async def podio_get_app_schema(app: str) -> dict[str, Any]:
    app_id = client().config.credentials_for(app).app_id
    return simplify_app(await client().request(app, "GET", f"/app/{app_id}"))


@mcp.tool(
    title="Find items",
    description=(
        "Find items in an app, optionally filtered and sorted. 'filters' is keyed by field "
        "external_id: a scalar or list for text and category fields, {'from': ..., 'to': ...} "
        "for number and date ranges, and a list of item_ids for relationship fields. Returns "
        "flattened items; pass raw=true for Podio's full payload."
    ),
    annotations=_read_only(),
)
@surface_errors
async def podio_find_items(
    app: str,
    filters: dict[str, Any] | None = None,
    sort_by: str | None = None,
    sort_desc: bool = True,
    limit: int = 30,
    offset: int = 0,
    view_id: int | None = None,
    raw: bool = False,
) -> dict[str, Any]:
    app_id = client().config.credentials_for(app).app_id
    body: dict[str, Any] = {
        "limit": max(1, min(limit, MAX_LIMIT)),
        "offset": max(0, offset),
        "sort_desc": sort_desc,
        # Saving the filter as the caller's default view would be a surprising
        # side effect of a read.
        "remember": False,
    }
    if filters:
        body["filters"] = filters
    if sort_by:
        body["sort_by"] = sort_by

    path = f"/item/app/{app_id}/filter/"
    if view_id is not None:
        path += f"{view_id}/"

    result = await client().request(app, "POST", path, json_body=body)
    items = result.get("items") or []
    return {
        "total": result.get("total"),
        "filtered": result.get("filtered"),
        "count": len(items),
        "items": items if raw else [simplify_item(item) for item in items],
    }


@mcp.tool(
    title="Get item",
    description=(
        "Get a single item by item_id, including all field values. The item must belong to the "
        "named app -- app-auth tokens cannot read across apps."
    ),
    annotations=_read_only(),
)
@surface_errors
async def podio_get_item(app: str, item_id: int, raw: bool = False) -> dict[str, Any]:
    item = await client().request(app, "GET", f"/item/{item_id}")
    return item if raw else simplify_item(item)


@mcp.tool(
    title="Search app",
    description=(
        "Full-text search within one app. Use this for 'find the item mentioning X' questions; "
        "use podio_find_items when you can express the query as field filters."
    ),
    annotations=_read_only(),
)
@surface_errors
async def podio_search_app(app: str, query: str, limit: int = 20) -> dict[str, Any]:
    app_id = client().config.credentials_for(app).app_id
    results = await client().request(
        app,
        "POST",
        f"/search/app/{app_id}/v2",
        json_body={"query": query, "limit": max(1, min(limit, 100)), "ref_type": "item"},
    )
    hits = results.get("results") if isinstance(results, dict) else results
    return {
        "results": [
            {
                "item_id": hit.get("id"),
                "title": hit.get("title"),
                "snippet": hit.get("snippet"),
                "link": hit.get("link"),
            }
            for hit in hits or []
        ]
    }


@mcp.tool(
    title="List app views",
    description="List an app's saved views, whose ids can be passed to podio_find_items.",
    annotations=_read_only(),
)
@surface_errors
async def podio_list_views(app: str) -> dict[str, Any]:
    app_id = client().config.credentials_for(app).app_id
    views = await client().request(app, "GET", f"/view/app/{app_id}/")
    return {
        "views": [
            {"view_id": view.get("view_id"), "name": view.get("name")} for view in views or []
        ]
    }


@mcp.tool(
    title="Create item",
    description=(
        "Create an item in an app. 'fields' is keyed by field external_id -- check "
        "podio_get_app_schema for the external_ids, required fields and category option ids. "
        "Set silent=true to skip notifications and the stream entry."
    ),
    annotations=_write(),
)
@surface_errors
async def podio_create_item(
    app: str, fields: dict[str, Any], silent: bool = False
) -> dict[str, Any]:
    app_id = client().config.credentials_for(app).app_id
    return await client().request(
        app,
        "POST",
        f"/item/app/{app_id}/",
        json_body={"fields": fields},
        params={"silent": "true"} if silent else None,
    )


@mcp.tool(
    title="Update item",
    description=(
        "Update fields on an existing item. Only the fields you pass are changed; pass an empty "
        "list as a field's value to clear it."
    ),
    annotations=_write(),
)
@surface_errors
async def podio_update_item(
    app: str, item_id: int, fields: dict[str, Any], silent: bool = False
) -> dict[str, Any]:
    result = await client().request(
        app,
        "PUT",
        f"/item/{item_id}",
        json_body={"fields": fields},
        params={"silent": "true"} if silent else None,
    )
    return result or {"item_id": item_id, "status": "updated"}


@mcp.tool(
    title="Delete item",
    description="Permanently delete an item. This cannot be undone from the API.",
    annotations=_write(destructive=True),
)
@surface_errors
async def podio_delete_item(app: str, item_id: int) -> dict[str, Any]:
    await client().request(app, "DELETE", f"/item/{item_id}")
    return {"item_id": item_id, "status": "deleted"}


@mcp.tool(
    title="List comments",
    description="List the comments on an item, oldest first.",
    annotations=_read_only(),
)
@surface_errors
async def podio_list_comments(app: str, item_id: int) -> dict[str, Any]:
    comments = await client().request(app, "GET", f"/comment/item/{item_id}/")
    return {
        "comments": [
            {
                "comment_id": comment.get("comment_id"),
                "value": comment.get("value"),
                "created_on": comment.get("created_on"),
                "created_by": (comment.get("created_by") or {}).get("name"),
            }
            for comment in comments or []
        ]
    }


@mcp.tool(
    title="Add comment",
    description="Add a comment to an item.",
    annotations=_write(),
)
@surface_errors
async def podio_add_comment(app: str, item_id: int, text: str) -> dict[str, Any]:
    return await client().request(
        app, "POST", f"/comment/item/{item_id}/", json_body={"value": text}
    )


def main() -> None:
    try:
        client()
    except PodioConfigError as exc:
        # Fail here rather than on the first tool call: a config mistake should
        # show up when the server is started, not halfway through a task.
        print(f"podio-mcp: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
    mcp.run("stdio")


if __name__ == "__main__":
    main()
