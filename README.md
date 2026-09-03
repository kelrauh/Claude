# MCP servers

MCP server configuration for this repo (`.mcp.json`). Claude Code picks these up
automatically when a session starts in this directory.

| Server | Transport | Auth |
| --- | --- | --- |
| `celigo` | Streamable HTTP, `https://api.integrator.io/celigo-mcp` | OAuth (browser) |
| `podio` | stdio, `servers/podio/podio_mcp.py` | Podio OAuth refresh token, or per-app tokens |

## Podio

`servers/podio/` is an MCP server over the [Podio REST API](https://developers.podio.com/),
with two authentication modes.

| | Account-wide (recommended) | Per-app tokens |
| --- | --- | --- |
| Setup | One browser login, once | One token per app, forever |
| Reach | Every app the account can see | Only apps you tokenized |
| Cross-app questions | Yes | No |
| Org/space tools | Yes | No |
| Address apps by | Alias or bare app_id | Alias only |

When a refresh token is present it is used for everything and app tokens are
ignored — one credential beats twenty-three, and only the account-wide token can
follow a relationship field into another app. Per-app
[app auth](https://developers.podio.com/authentication/app_auth) stays available
for setups that must never see a browser.

Podio also runs a hosted server at `https://mcp.podio.com/mcp`. It is a drop-in
alternative (`{"type": "http", "url": "..."}`) with account-wide scope, but you
get its tool design rather than one shaped around these apps.

### Setup

1. Create an API key at <https://podio.com/settings/api>; note the **Client ID**
   and **Client Secret**. Podio only redirects back to the domain registered
   against the key, which decides how step 3 runs:

   * domain `localhost` → the default loopback flow, fully automatic;
   * any other domain (e.g. `claude.ai`) → the same flow, but you paste the
     redirect URL back into the terminal.

   Registering a second key for `localhost` keeps an existing key untouched;
   changing a key's domain would break anything already using it.
2. Copy `.env.example` to `.env`, fill in the client ID and secret, and load it:

   ```sh
   cp .env.example .env       # then edit it
   set -a; . ./.env; set +a
   ```

3. Authorize once. A browser opens; approve, and the refresh token lands in
   `.podio-token.json` (mode 0600, gitignored):

   ```sh
   # key registered to localhost
   uv run --script servers/podio/podio_auth.py

   # key registered to another domain, e.g. claude.ai
   uv run --script servers/podio/podio_auth.py \
       --redirect-uri https://claude.ai/podio-callback
   ```

   In the second form Podio sends the browser to that URL with the code in the
   address bar. The page itself does not need to exist — an error page is fine.
   Copy the whole address and paste it at the prompt; the helper checks the
   `state` parameter matches before using the code.

4. Start Claude Code from this directory and check `/mcp` shows **podio**.

That is the whole setup — no app tokens, and every app in the org is reachable
by alias or by bare app id.

<details>
<summary>Per-app tokens instead (no browser)</summary>

Get each app's **App ID** and **App Token** from Podio → the app → wrench menu →
**Developer**, then either list them inline:

```
PODIO_APPS=service_calls=16205569:the-token
```

or, for many apps, copy `servers/podio/apps.template.json` (it already carries
all 23 Imaging app IDs) to `apps.json`, paste in the tokens you need, and set
`PODIO_APPS_FILE=servers/podio/apps.json`. Apps left with an empty token are
skipped at startup and reported by `podio_list_apps` as `unconfigured`.
</details>

This install targets Modular Devices (org `1110222`) → Imaging (space
`4686720`). The 23 apps in that space and their IDs are listed in
`servers/podio/apps.template.json`, which doubles as the alias map: under
account-wide auth the aliases work with no tokens filled in at all.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PODIO_CLIENT_ID` | yes | API key client ID |
| `PODIO_CLIENT_SECRET` | yes | API key client secret |
| `PODIO_TOKEN_FILE` | no | Refresh token path, default `.podio-token.json` |
| `PODIO_REFRESH_TOKEN` | no | Refresh token inline, instead of a file |
| `PODIO_APPS` | no | `alias=app_id:app_token`, comma-separated |
| `PODIO_APPS_FILE` | no | Path to a JSON app list, instead of `PODIO_APPS` |
| `PODIO_REDIRECT_URI` | no | Default redirect URI for `podio_auth.py` |
| `PODIO_API_BASE` | no | API base URL, default `https://api.podio.com` |

Podio rotates the refresh token every time it is redeemed, so the new value is
written back to `PODIO_TOKEN_FILE` after each refresh. Setting
`PODIO_REFRESH_TOKEN` alone works for one session and then goes stale; the
server warns on stderr when it cannot persist a rotation.

The server exits with an error at startup if no usable credential is present, so
a misconfiguration shows up in `claude mcp list` rather than mid-task.

### Tools

| Tool | Does | Needs account-wide auth |
| --- | --- | --- |
| `podio_list_apps` | List reachable aliases and the active auth mode | |
| `podio_get_app_schema` | Field external_ids, types, required flags, options | |
| `podio_find_items` | Filter/sort items, optionally through a saved view | |
| `podio_get_item` | One item by id | |
| `podio_search_app` | Full-text search within an app | |
| `podio_list_views` | Saved views and their ids | |
| `podio_create_item` | Create an item | |
| `podio_update_item` | Update fields on an item | |
| `podio_delete_item` | Delete an item (destructive) | |
| `podio_list_comments` | Comments on an item | |
| `podio_add_comment` | Comment on an item | |
| `podio_list_orgs` | Organizations and their spaces | yes |
| `podio_list_space_apps` | Every app in a space, with ids and aliases | yes |
| `podio_search_space` | Full-text search across every app in a space | yes |

Items come back flattened to `{external_id: value}` rather than Podio's nested
field envelopes — a typical item drops from kilobytes of JSON to a few lines.
Pass `raw=true` to `podio_find_items` or `podio_get_item` for the full payload.

Start with `podio_get_app_schema`: `filters` and `fields` arguments are keyed by
field external_id, and category fields want option ids from that schema. Under
account-wide auth the item tools take `item_id` alone — no `app` needed, since
the item id already identifies it.

### Development

```sh
uv venv .venv
uv pip install --python .venv/bin/python mcp httpx pytest pytest-asyncio
.venv/bin/python -m pytest servers/podio/tests -q
```

The suite covers config parsing, scope resolution across both auth modes, the
token cache and its refresh/rotation/retry paths, item flattening, and
end-to-end runs of the stdio server against a stub Podio API in each mode. No
test touches the real API.
