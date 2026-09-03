# MCP servers

MCP server configuration for this repo (`.mcp.json`). Claude Code picks these up
automatically when a session starts in this directory.

| Server | Transport | Auth |
| --- | --- | --- |
| `celigo` | Streamable HTTP, `https://api.integrator.io/celigo-mcp` | OAuth (browser) |
| `podio` | stdio, `servers/podio/podio_mcp.py` | Podio app auth (headless) |

## Podio

`servers/podio/` is a small MCP server over the [Podio REST API](https://developers.podio.com/).
It uses Podio's [app-authentication flow](https://developers.podio.com/authentication/app_auth):
a client ID/secret plus a per-app `app_id`/`app_token` are exchanged for an
access token, with no browser step and no account password. That makes it usable
from headless and remote sessions, at the cost of being **scoped per app** —
every tool takes an `app` alias, and a token for one app cannot read another.

Podio also runs a hosted server at `https://mcp.podio.com/mcp` with account-wide
scope. It is a drop-in alternative (`{"type": "http", "url": "..."}`), but its
OAuth flow needs an interactive browser login, so it can't be authorized from a
remote session.

### Scope

App auth is per app, so the only ID the server needs is an **App ID** and its
matching app token. Organization and space IDs are not part of the flow, and a
token for one app grants nothing anywhere else in the org — there is no way to
list the other apps in a space or read across the organization with it. To reach
a second app, add a second alias with that app's own token.

This install targets Modular Devices (org `1110222`) → Imaging (space
`4686720`). All 23 apps in that space are listed with their IDs in
`servers/podio/apps.template.json`; each one still needs its own token before it
can be reached.

Because one token per app gets tedious past a handful of apps, the template is
designed to be filled in gradually: copy it to `apps.json`, paste tokens into
only the apps you actually use, and leave the rest blank. Blank-token apps are
skipped at startup and reported by `podio_list_apps` as `unconfigured`, so it is
clear they exist but are not reachable.

```sh
cp servers/podio/apps.template.json servers/podio/apps.json
# paste tokens into the apps you need, then:
echo 'PODIO_APPS_FILE=servers/podio/apps.json' >> .env
```

`apps.json` is gitignored. For one or two apps, the `PODIO_APPS` env var in
`.env.example` is simpler than the file.

### Setup

1. Create an API key at <https://podio.com/settings/api>. Note the **Client ID**
   and **Client Secret**.
2. For each app you want reachable, open it in Podio → wrench menu → **Developer**,
   and note the **App ID** and **App Token**.
3. Copy `.env.example` to `.env`, fill it in, and load it before starting Claude
   Code:

   ```sh
   cp .env.example .env       # then edit it
   set -a; . ./.env; set +a
   claude
   ```

   `.env` is gitignored; `.mcp.json` only references the variable names, so no
   secret is ever committed.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PODIO_CLIENT_ID` | yes | API key client ID |
| `PODIO_CLIENT_SECRET` | yes | API key client secret |
| `PODIO_APPS` | yes* | `alias=app_id:app_token`, comma-separated |
| `PODIO_APPS_FILE` | yes* | Path to a JSON file of apps, instead of `PODIO_APPS` |
| `PODIO_API_BASE` | no | API base URL, default `https://api.podio.com` |

\* exactly one of `PODIO_APPS` / `PODIO_APPS_FILE`.

The server exits with an error at startup if credentials or apps are missing, so
a misconfiguration shows up in `claude mcp list` rather than mid-task.

### Tools

| Tool | Does |
| --- | --- |
| `podio_list_apps` | List configured aliases (no API call) |
| `podio_get_app_schema` | Field external_ids, types, required flags, category options |
| `podio_find_items` | Filter/sort items, optionally through a saved view |
| `podio_get_item` | One item by id |
| `podio_search_app` | Full-text search within an app |
| `podio_list_views` | Saved views and their ids |
| `podio_create_item` | Create an item |
| `podio_update_item` | Update fields on an item |
| `podio_delete_item` | Delete an item (destructive) |
| `podio_list_comments` | Comments on an item |
| `podio_add_comment` | Comment on an item |

Items come back flattened to `{external_id: value}` rather than Podio's nested
field envelopes — a typical item drops from kilobytes of JSON to a few lines.
Pass `raw=true` to `podio_find_items` or `podio_get_item` for the full payload.

Start with `podio_get_app_schema`: `filters` and `fields` arguments are keyed by
field external_id, and category fields want option ids from that schema.

### Development

```sh
uv venv .venv
uv pip install --python .venv/bin/python mcp httpx pytest pytest-asyncio
.venv/bin/python -m pytest servers/podio/tests -q
```

The suite covers config parsing, the token cache and its refresh/retry paths,
item flattening, and an end-to-end run of the stdio server against a stub Podio
API. No test touches the real API.
