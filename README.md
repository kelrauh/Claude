# celigo-cli-fork

An internal fork of [`@celigo/celigo-cli`](https://developer.celigo.com/cli) (MIT licensed), the
command-line interface for Celigo's integrator.io platform. This repo is the base for extending
and customizing the CLI beyond what the published package supports.

## Provenance

The upstream `@celigo/celigo-cli` package ships as a single pre-built, type-erased bundle
(`dist/index.js`) — no separate TypeScript source is published, and the upstream GitHub
repository referenced in its `package.json` was not reachable from this environment. `bin/celigo.js`
in this repo is that shipped bundle (version `2026.8.6`), taken as the starting point for the fork
under the terms of its MIT license (see `LICENSE`). The original package README is preserved as
`CELIGO-CLI-UPSTREAM-README.md` for reference.

Because the bundle is a single file rather than clean per-module source, treat it as a legacy
baseline: pull individual commands out into `src/commands/*.js` as you touch them, rather than
trying to re-split the whole file up front.

## Usage

```bash
npm install
node bin/celigo.js --version
node bin/celigo.js --help

export CELIGO_API_TOKEN="<your token>"
node bin/celigo.js flows list --format table
```

Or link it globally for a `celigo` command:

```bash
npm link
celigo --version
```

## Command surface

Config/profiles, account-wide resources (connections, exports, imports, integrations, scripts,
stacks, tools, MCP servers, AI agents, guardrails, EDI, on-premise agents, storage, etc.), flows,
jobs, users, audit logs, and more — run `celigo --help` for the full list.
