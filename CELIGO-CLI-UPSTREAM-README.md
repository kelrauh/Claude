# Celigo CLI

[![CI](https://github.com/celigo/celigo-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/celigo/celigo-cli/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/%40celigo%2Fceligo-cli)](https://www.npmjs.com/package/@celigo/celigo-cli) [![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

The Celigo CLI is the command-line interface for [Celigo integrator.io](https://www.celigo.com). Manage integrations, flows, connections, and 30+ resource types from your terminal.

## Install

```bash
npm install -g @celigo/celigo-cli
```

Requires Node.js 22+.

The CLI checks npm for a newer version at most once every four hours. When one is available
it announces itself on stderr and installs the update in the background (the equivalent of
`npm install -g @celigo/celigo-cli@<latest>`), which applies from your next command. It never
runs in CI. `celigo config set auto_update false` keeps the check but only prints the upgrade
hint; `CELIGO_NO_UPDATE=1` disables checking entirely.

When the CLI cannot update itself, it says so instead of silently staying on the old version:
if the installed package directory is not writable by your user (the standard macOS and Linux
Node installers leave it owned by root), the CLI prints the exact
`sudo npm install -g @celigo/celigo-cli@<latest>` command to run instead, and if a background
install fails for any other reason, the next check reports that the update did not apply and
retries.

## Setup

Get a token from integrator.io: **Resources** (left nav) > **API tokens**. Two token types work — the CLI sends either as a bearer token:

- **Personal access token (PAT)** — any user (including manage and monitor roles) can generate one. It inherits your own account permissions, with no scopes to configure, and expires after 90 days by default.
- **API token** — account-level, with configurable access (full or custom scopes). Requires an account admin or owner.

```bash
# Create a profile with your token
celigo profile add <name> --api-token <token>

# EU users
celigo profile add <name> --api-token <token> --api-base-url https://api.eu.integrator.io
```

You can also pass credentials via `CELIGO_API_TOKEN` / `--token`. Priority: CLI flag > env var > active profile.

### Agent skills

Celigo's AI-assistant skills are maintained in the public [`celigo/ai`](https://github.com/celigo/ai) repository and installed through the official [skills CLI](https://skills.sh). The CLI does not modify agent configuration during npm installation.

Because AI agents driving the CLI are its main use case, the CLI installs the skills for you: on first use, and at most once every 24 hours after that, a detached background process checks whether `celigo/ai` has moved since the last install and, if it has, announces itself on stderr and runs the equivalent of `celigo skills install --global --all -y`. Days on which the skills are already current cost nothing and print nothing. The check and the install both happen in the background, so they never block or fail a command — if git, npm, or GitHub is unreachable the CLI installs anyway and retries no sooner than the next day. It is skipped in CI and during `celigo skills`/`celigo config` invocations. Opt out either way:

```bash
export CELIGO_NO_SKILLS_INSTALL=1                 # per environment
celigo config set skills_auto_install false       # persistent, machine-wide
```

To keep some skills and drop others, name the ones you do not want. Deleting their files is not enough on its own: the background install has no way to tell a deliberate deletion from a half-finished install, so it would put them back the next time `celigo/ai` changed. This setting is the durable record, and the background install then installs everything except those skills:

```bash
celigo config set skills_auto_install_exclude writing-sql,building-b2b
celigo config set skills_auto_install_exclude ""   # clear it; the skills return on the next check
```

Excluding a skill does not delete it — remove the files once (the names are the folders `celigo skills list` reports) and the setting keeps them from coming back. Explicit `celigo skills install` commands ignore the setting, so `--all` still means all.

Manual management remains available:

```bash
celigo skills install                 # choose skills and detected agents interactively
celigo skills install --global --all  # install every Celigo skill for the current user
celigo skills list                    # list installed skills
celigo skills update building-flows   # update named installed skills
celigo skills update --all-installed  # explicitly update every installed skill
```

`celigo skills` delegates to a pinned release of the official `skills` package through `npx`; skill content still comes directly from `celigo/ai`. Installation and updates therefore require access to npm and GitHub. Updating every skill—including non-Celigo skills—requires the explicit `--all-installed` flag; the automatic background install only ever touches the Celigo skills from `celigo/ai`.

### Multiple accounts

```bash
celigo profile add <name> --api-token <token>
celigo profile use <name>                   # switch active profile
celigo profile list                         # show all profiles
celigo --profile <name> flows list          # one-off override without switching
```

### Permission modes

Each profile runs in one of three modes. Default is `full`.

| Mode | Allows |
|---|---|
| `read` | GET requests only. All mutations blocked at the HTTP client. |
| `operate` | Read + operational actions (run flows, retry/resolve errors, enable debug, invoke, ping, cancel jobs, etc.). Cannot create/delete resources or restructure flows. `set` limited to `disabled`, `debugUntil`, `debugDate`, `schedule`, `autoResolveAt`, `logging.debugUntil`. |
| `full` | No gates. |

```bash
celigo profile add prod --api-token <token> --mode read
celigo config set mode operate              # change the active profile's mode
```

See `celigo <resource> --help` or [developer.celigo.com/cli](https://developer.celigo.com/cli) for every command and its mode.

## Global options

```
--token <token>      API bearer token (overrides config/env)
--base-url <url>     API base URL (default: https://api.integrator.io)
--profile <name>     Use a named config profile instead of the active one
--format <fmt>       json (default) or table
--jq <expr>          Transform JSON output with a jq expression (bundled)
--verbose            Log every HTTP request to stderr
```

`list` commands return lean rows by default — `_id`, `name`, and the table columns, projected
server-side where the API supports it and trimmed client-side where it doesn't. Use
`--fields all` for complete documents (`celigo config set list_fields all` makes that the
profile default) or `--fields <a,b,c>` for a custom set; the standard `list` verb also takes
`--limit <n>` to cap rows (hand-rolled lists such as `ai-agents`, `notifications`, and
`stacks` take `--fields` only). A projected row can carry a key you didn't name: `_id` and
`name` always ride along, as does any field the command filters on internally. Field
selection resolves in order — `--fields`, then `--jq` (which implies complete documents),
then `list_fields`, then the built-in default — so `--jq` on its own gets complete documents,
but `--jq` alongside an explicit `--fields` still projects, and the expression then sees
`null` for anything it wasn't given. `get` and `account snapshot` are never projected.

## Examples

```bash
# Explore your account
celigo account snapshot
celigo account search "shopify"

# Build a flow (bottom-up: connection → export → import → flow)
celigo connections create < connection.json
celigo exports create < export.json
celigo imports create < import.json
celigo flows create < flow.json

# Modify resources (prefer `set` over `update` — `set` is safe GET+modify+PUT)
celigo flows set <flowId> disabled=false
celigo exports replace-connection <exportId> <newConnectionId>

# Investigate errors
celigo flows error-summary <flowId>
celigo flows error-analysis <flowId> <exportOrImportId>

# Run and monitor
celigo flows run <flowId> -y
celigo jobs current
```

## Commands

Run `celigo --help` to list the command groups, or `celigo <resource> --help` for a group's commands, arguments, and options. The full per-resource reference lives at **[developer.celigo.com/cli](https://developer.celigo.com/cli)**.

### Documentation

In-repo guides: [command reference](docs/command-reference.md) (every group, command, and permission mode), [examples](docs/examples.md) (common workflows), and [CI setup](docs/ci-setup.md) (running the CLI in pipelines).

### Command groups

| Group | Purpose |
|---|---|
| `ai-agents` | Manage AI agents (LLM-powered import steps). |
| `async-helpers` | Manage async helpers (polling configs for long-running API operations). |
| `guardrails` | Manage guardrails (PII detection, content moderation, AI safety checks). |
| `on-premise-agents` | Manage on-premise agents (OPA). |
| `apis` | Manage API endpoints (builder and script modes). |
| `edi-profiles` | Manage EDI document profiles for trading partners. |
| `environments` | Manage the environments on your account. |
| `file-definitions` | Manage file format definitions (CSV, EDI, fixed-width, etc.). |
| `iclients` | Manage OAuth2 iClients (app registrations for OAuth flows). |
| `lookup-caches` | Manage lookup caches (in-memory key-value stores for enrichment and deduplication). |
| `tags` | Manage tags for organizing resources. |
| `tools` | Manage tools (reusable building blocks callable from flows, APIs, agents, and MCP servers). |
| `mcp-servers` | Manage MCP servers that expose tools and APIs as MCP endpoints. |
| `integrations` | Manage integrations (containers for flows, connections, and resources). |
| `flows` | Manage flows (data pipelines connecting exports to imports). |
| `connections` | Manage connections (credentials and configuration for external systems). |
| `exports` | Manage exports (data sources that read from external systems). |
| `imports` | Manage imports (data destinations that write to external systems). |
| `scripts` | Manage scripts (JavaScript hooks: preSavePage, preMap, postMap, postSubmit, etc.). |
| `stacks` | Manage stacks (server/Lambda runtimes for custom code). |
| `users` | Manage account users and access levels. |
| `jobs` | Manage flow execution jobs (status, files, diagnostics, cancellation). |
| `audit` | View audit logs. |
| `subscriptions` | View subscription and usage information. |
| `notifications` | Manage notification subscriptions (integrations, flows, connections). |
| `account` | Account-wide operations: snapshot, search, dependencies, lint, stats. |
| `edi-transactions` | Query EDI transaction logs from the B2B Manager dashboard. |
| `http-connectors` | Browse and manage HTTP connector definitions. |
| `trading-partner-connectors` | Browse trading partner connector definitions; write verbs manage definitions. |
| `metadata` | Query metadata via a live connection (NetSuite, Salesforce, RDBMS). |
| `processors` | Stateless parsers & generators: convert raw CSV/XML/EDI to JSON and back — validate parsing rules and EDI files without creating resources. |
| `templates` | Browse, preview, manage, and install integration templates. |
| `connectors` | Manage connectors (installable integration applications). |
| `state` | Manage state key-value stores. |
| `syncs` / `sync-jobs` | Manage and run syncs (Celigo Data Ingestion replication pipelines), track usage and drift events, and inspect or cancel the jobs they produce. |
| `datasets` | Choose and inspect the tables/objects a sync replicates, and discover what a connection offers. |
| `recycle-bin` | Browse, restore, and purge soft-deleted resources. |
| `storage` | Manage files and folders in Celigo Storage. |
| `mcp-oauth-providers` | Manage MCP OAuth providers. |
| `event-reports` | Manage event reports: list, get, create, signed URLs, cancel. |
| `profile` / `config` / `skills` | Manage local profiles and configuration; install agent skills. Never hit the Celigo API (except `profile whoami`). |

Most resources support the same six verbs — `list`, `get <id>`, `create`, `update <id>`, `set <id> key=value`, and `delete <id>`. Exceptions: `environments` excludes `delete`; `users` excludes `create` (use `invite`). Body input for `create`/`update` (and other body-taking commands like `invoke` and `lookup-caches put-data`) is JSON piped via stdin, or read with `-f, --file <path>` (`-` also means stdin). `set` takes dot/bracket paths (`http.relativeURI=/new`, `pageGenerators[0]._exportId=abc`), parses each value as JSON first (so `null` removes a field, `true`/`false` are booleans), and can load one field from a file with `set <id> <field>=file://<path>`. **Prefer `set` over `update`** — `update` is a full PUT replace that erases any field you omit.

Two read-only helpers exist on most resources: `<resource> dependencies <id>` (alias `used-by`) lists what depends on a record — server-computed and authoritative, so an empty result means it's safe to delete — and `<resource> audit <id>` shows its change history (who changed what, when, and from which source).

### Mode enforcement

`read` is enforced at the HTTP client (throws before the network call); `operate` is enforced at the CLI layer (throws before the action runs); `full` has no gates. Profile, config, and skills commands never hit the Celigo API and are never mode-gated.

In `operate` mode, `set` accepts only these fields: `disabled`, `debugUntil`, `debugDate`, `schedule`, `autoResolveAt`, `logging.debugUntil`. Any other assignment fails before the GET — switch to `full` to modify other fields.

### Connections: `set` is credential-safe, `update` is not

`connections set` applies only whitelisted fields (`name`, `debugDate`, `debugUntil`) via an atomic PATCH that never re-sends encrypted fields. Any other field errors out rather than falling back to GET + modify + PUT, which would overwrite real credentials that the API masks as `"******"`. `connections update` (a full PUT) refuses payloads containing those masked placeholders — pass `--force` to submit anyway, or replace the masked values with real credentials (or `""` to clear) first. The same protection applies to `iclients`.

### Profile management

Not mode-gated — these manage local credential sets. Only `whoami` hits the Celigo API.

| Command | Args / options | Notes |
|---|---|---|
| `profile list` | | Show all profiles (marks the active one). |
| `profile show [name]` | | Show a profile's config (tokens redacted). Defaults to the active profile. |
| `profile whoami` | | Resolve the active token to its user (`GET /v1/tokenInfo`). |
| `profile add <name>` | `--api-token`, `--api-base-url`, `--default-format`, `--mode` | Create a profile. |
| `profile use <name>` | | Switch the active profile. |
| `profile delete <name>` | | Delete a profile. Cannot delete the active profile. |
| `profile rename <old> <new>` | | Rename a profile. |

### Configuration (active profile)

Not mode-gated. Combine with `--profile <name>` to write to a non-active profile.

| Command | Args / options | Notes |
|---|---|---|
| `config show` | | Show all config for the active profile (tokens redacted). |
| `config get <key>` | | Read a single key. |
| `config set <key> <value>` | | Write a key. |

Keys: `api_token`, `base_url`, `default_format` (`json` \| `table`), `mode` (`read` \| `operate` \| `full`).

---

## OPA vs AI agents

Two different things share the word "agent" in the Celigo platform:

- **On-premise agents (OPA)** — gateway processes that bridge private networks to integrator.io. Manage with `celigo on-premise-agents`.
- **AI agents** — LLM-powered import steps (`adaptorType: AiAgentImport`). Manage with `celigo ai-agents`.

## Development

```bash
git clone https://github.com/celigo/celigo-cli.git
cd celigo-cli
npm ci
npm run verify   # lint → typecheck → test → build → package check
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the architecture orientation, coding conventions,
and release process.

## Contributing and support

See [CONTRIBUTING.md](CONTRIBUTING.md) to develop or propose changes,
[SUPPORT.md](SUPPORT.md) for support channels, and [SECURITY.md](SECURITY.md) to report
vulnerabilities privately. Project participation follows [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
