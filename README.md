# MCP servers

Shared MCP server configuration for this repo (`.mcp.json`). Claude Code picks
these up automatically when a session starts in this directory.

| Server | Transport | URL | Auth |
| --- | --- | --- | --- |
| `celigo` | Streamable HTTP | `https://api.integrator.io/celigo-mcp` | OAuth |
| `podio` | Streamable HTTP | `https://mcp.podio.com/mcp` | OAuth (Podio account) |

## Podio

Podio's own hosted MCP server exposes ~22 read and write tools over Podio
organizations, workspaces, apps and items — no Podio API key or self-hosted
bridge required, the server ships with shared default credentials and you
authorize it with your normal Podio login.

First-time setup, in an **interactive** session:

```
claude mcp list       # confirm `podio` is picked up from .mcp.json
/mcp                  # select `podio` -> Authenticate, then complete the
                      # browser OAuth flow with your Podio account
```

The OAuth flow needs a browser, so it can't be completed from a non-interactive
or remote session; authorize once locally and the token is reused afterwards.

Docs: https://docs.sharefile.com/en-us/podio/using-podio/general-features/podio-mcp-server.html
