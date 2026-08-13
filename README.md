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

Because the bundle is a single file rather than clean per-module source, the layout is:

- `src/lib/core.js` — the shared framework the upstream bundle built every command on: config,
  auth/profiles, the HTTP client, output formatting/projection, help text, and the generic
  resource-CRUD factory (`makeResourceGroup`) that most commands are built from.
- `src/commands/*.js` — individual commands pulled out of the bundle as thin modules that import
  what they need from `core.js`. Only `users.js` has been pulled out so far; the rest of the
  commands (flows, connections, exports, etc.) still live inline in `bin/celigo.js` and can be
  extracted the same way as they're touched.
- `bin/celigo.js` — the CLI entry point: everything not yet pulled into `src/commands/`, plus the
  final `program` wiring.

Every extraction so far has been verified against the original bundle (`--help` output for every
command diffs byte-identical, and error paths like missing-token match too) — see git history for
the extraction methodology if you're pulling out another command.

Two behavioral changes from upstream, both in `src/lib/core.js`:
- `autoUpdate()` is disabled (early return). Upstream's version would periodically shell out to
  `npm install -g @celigo/celigo-cli@latest` — reinstalling the *original* package over this fork,
  which is actively wrong for a fork. Worth designing a real auto-update story later if this fork
  needs one, pointed at wherever this package actually gets published/distributed.
- The `pkg.json` path used to read the CLI's own version was relative to the entry file's location
  (one directory up) — fixed to account for `core.js` now living two directories deep
  (`src/lib/`) instead of one (`bin/`, upstream's `dist/`).

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
