#!/usr/bin/env node

import chalk9 from "chalk";
import { Command as Command22 } from "commander";
import { Command } from "commander";
import { existsSync, readFileSync, writeFileSync, statSync } from "fs";
import { join, resolve } from "path";
import chalk from "chalk";
import { ProxyAgent } from "undici";
import { platform } from "os";
import { randomInt } from "crypto";

import {
  BATCH_SIZE,
  CeligoClient,
  DEFAULT_BASE_URL,
  DEFAULT_MODE,
  FIELDS_OPTION_DESCRIPTION,
  FIELDS_OPTION_FLAGS,
  GLOBAL_SETTING_KEYS,
  HELP,
  VALID_MODES,
  addAuditCommand,
  addCloneCommand,
  addDebugCommands,
  addDebugRequestCommands,
  addDependenciesCommand,
  addKnowledgeHelp,
  addProcessorToBranch,
  addProfile,
  addTestRunCommands,
  addWriteCommands,
  applyAssignments,
  article,
  assertCommandAllowedInMode,
  assertRequiredArgsNonEmpty,
  assertSetFieldsAllowedInMode,
  autoInstallSkills,
  autoUpdate,
  buildUrl,
  collectFlowStepIds,
  confirm,
  confirmThen,
  crud,
  defaultProjection,
  deleteProfile,
  detectProcessorType,
  expandHome,
  extractFieldPaths,
  fetchSignedZip,
  findProcessorList,
  formatOutput,
  getActiveProfile,
  getAndPrint,
  getConfig,
  getGlobalSetting,
  getProxyUrl,
  initUserAgent,
  isJqActive,
  listAndPrint,
  listProfiles,
  loadConfig,
  makeResourceGroup,
  normalizeBaseUrl,
  parseAccountAlias,
  parseBooleanSetting,
  parseIds,
  parseListFields,
  parseMode,
  parsePositiveInt,
  parseSkillNames,
  printJson,
  projectRows,
  promptSecret,
  randomRouterId,
  readBody,
  readStdin,
  redactToken,
  registerAccount,
  registerSkills,
  removeProcessorAndPut,
  removeWithConfirm,
  renameProfile,
  replaceConnection,
  reportCursorList,
  resolveBranch,
  resolveListFields,
  runClone,
  setJqExpression,
  success,
  tryReadStdin,
  useProfile,
  withListProjection,
  withProcessorOptions,
  writeAndReport,
  writeConfig,
  writeFromBody,
  writeGlobalSetting
} from "../src/lib/core.js";

// src/commands/apis.ts
function registerApis(program2, ctx) {
  const group = crud(
    program2,
    "apis",
    "apis",
    ["_id", "name", "type", "disabled", "lastModified"],
    ctx,
    "Manage API endpoints (builder and script modes)."
  );
  addDependenciesCommand(group, ctx, "apis");
  addAuditCommand(group, ctx, "apis");
  group.command("logs <id>").description("Get request logs for an API.").action(async (id) => {
    const data = await ctx.getClient().get(`v1/apis/${id}/logs`);
    formatOutput(data, ctx.getFormat());
  });
  group.command("log-detail <id> <key>").description("Get full request/response detail for an API log entry (key from apis logs).").action(async (id, key) => {
    const data = await ctx.getClient().get(`v1/apis/${id}/logs/${key}`);
    formatOutput(data, ctx.getFormat());
  });
  addDebugRequestCommands(group, ctx, "apis");
  addTestRunCommands(group, ctx, "apis");
  group.command("clone <id>").description(
    "Clone a builder-mode API. Requires --api-version.\nReturns an array of { model, _id } tuples (api + copied export/import resources),\nnot a single resource \u2014 pipe with --jq '.[] | {model, id: ._id}'.\nWith --dry-run, only validates that the target version + method + relativeURI route\nis free (returns { canClone }) and creates nothing."
  ).requiredOption("--api-version <version>", "Version for the cloned API (e.g. v2).").option("--name <name>", "Name for the cloned API.").option("--description <description>", "Description for the cloned API.").option("--environment <environmentId>", "Clone into a target environment.").option("--dry-run", "Validate the clone's route availability without creating anything.").action(
    async (id, opts) => {
      const api = await ctx.getClient().get(`v1/apis/${id}`);
      if (api.type !== "builder") {
        throw new Error("Clone is only supported for builder-mode APIs.");
      }
      if (opts.dryRun) {
        const result2 = await ctx.getClient().post(`v1/apis/${id}/clone/validate`, { version: opts.apiVersion });
        formatOutput(result2, ctx.getFormat());
        return;
      }
      const body = { version: opts.apiVersion };
      if (opts.name) body.name = opts.name;
      if (opts.description) body.description = opts.description;
      if (opts.environment) body.environmentId = opts.environment;
      const result = await ctx.getClient().post(`v1/apis/${id}/clone`, body);
      formatOutput(result, ctx.getFormat());
    }
  );
  group.command("download <id>").description(
    "Download a builder-mode API as a template ZIP file.\nCalls the template endpoint, fetches the signed URL, and saves locally. The zip\ncontains the API plus every resource it references (imports, exports, connections,\nscripts). Script-type APIs cannot be exported.\nDefault filename: <api-name>.zip (or api-<id>.zip)."
  ).option("-o, --output <path>", "Output file path (default: <name>.zip in current directory).").action(async (id, opts) => {
    const api = await ctx.getClient().get(`v1/apis/${id}`);
    if (api.type !== "builder") {
      throw new Error("Download is only supported for builder-mode APIs.");
    }
    await fetchSignedZip(
      ctx,
      `v1/apis/${id}/template`,
      api.name ?? `api-${id}`,
      opts.output
    );
  });
  withProcessorOptions(
    group.command("add-processor <id> <exportOrImportId>").description(
      "Add a page processor to an API.\nAuto-detects whether the ID is an export or import.\nExample: celigo apis add-processor <id> <importId> --router r1"
    )
  ).action(async (id, exportOrImportId, opts) => {
    const client2 = ctx.getClient();
    const api = await client2.get(`v1/apis/${id}`);
    const builder = api.builder;
    if (!builder) {
      throw new Error("API has no builder configuration. Is this a script-mode API?");
    }
    if (!Array.isArray(builder.routers) || builder.routers.length === 0) {
      throw new Error("API builder has no routers.");
    }
    const { type, processor } = await detectProcessorType(client2, exportOrImportId);
    const routers = builder.routers;
    const branch = resolveBranch(routers, opts, "API");
    await addProcessorToBranch({
      client: client2,
      branch,
      processor,
      confirmMsg: `Add ${type} '${exportOrImportId}' to API ${id}, branch '${branch.name || "(default)"}'?`,
      doc: api,
      putEndpoint: `v1/apis/${id}`,
      yes: opts.yes,
      format: ctx.getFormat()
    });
  });
  withProcessorOptions(
    group.command("remove-processor <id> <exportOrImportId>").description("Remove a page processor from an API by its export or import ID.")
  ).action(async (id, exportOrImportId, opts) => {
    const client2 = ctx.getClient();
    const api = await client2.get(`v1/apis/${id}`);
    const builder = api.builder;
    if (!builder) {
      throw new Error("API has no builder configuration.");
    }
    const routers = builder.routers;
    if (!Array.isArray(routers) || routers.length === 0) {
      throw new Error("API builder has no routers.");
    }
    const pps = findProcessorList(routers, exportOrImportId, opts);
    await removeProcessorAndPut({
      client: client2,
      pps,
      exportOrImportId,
      doc: api,
      putEndpoint: `v1/apis/${id}`,
      confirmMsg: `Remove processor '${exportOrImportId}' from API ${id}?`,
      yes: opts.yes,
      format: ctx.getFormat()
    });
  });
  group.command("set-group <apiGroupingId> <apiIds...>").description(
    "Assign one or more APIs to an API group.\nTo remove APIs from their group, use `apis unset-group`."
  ).action(async (apiGroupingId, apiIds) => {
    await ctx.getClient().put("v1/apis/updateApiGrouping", {
      _apiIds: apiIds,
      _apiGroupingId: apiGroupingId
    });
    success(`Assigned ${apiIds.length} API(s) to group ${apiGroupingId}.`);
  });
  group.command("unset-group <apiIds...>").description("Remove one or more APIs from their group (leaves them ungrouped).").action(async (apiIds) => {
    await ctx.getClient().put("v1/apis/updateApiGrouping", {
      _apiIds: apiIds,
      _apiGroupingId: null
    });
    success(`Removed ${apiIds.length} API(s) from their group.`);
  });
}

// src/commands/async-helpers.ts
function registerAsyncHelpers(program2, ctx) {
  const asyncHelpersGroup = makeResourceGroup("async-helpers", "asynchelpers", {
    listColumns: ["_id", "name", "lastModified"],
    description: "Manage async helpers (polling configs for long-running API operations).",
    integrationSubpath: "asynchelpers",
    helpText: HELP["async-helpers"],
    ...ctx
  });
  program2.addCommand(asyncHelpersGroup);
  addDependenciesCommand(asyncHelpersGroup, ctx, "asynchelpers");
  addAuditCommand(asyncHelpersGroup, ctx, "asynchelpers");
}

// src/commands/audit.ts
import { Command as Command4 } from "commander";
function singularType(type) {
  return type.replace(/s$/, "");
}
function needsPostQuery(opts) {
  return (opts.resourceType?.length ?? 0) > 1 || (opts.source?.length ?? 0) > 1 || (opts.action?.length ?? 0) > 1 || (opts.resource?.length ?? 0) > 0;
}
function buildQueryFilters(opts, includeTypes) {
  const body = {};
  if (includeTypes && opts.resourceType?.length) {
    body.resourceType = opts.resourceType.map(singularType);
  }
  if (opts.source?.length) body.source = opts.source;
  if (opts.action?.length) body.action = opts.action;
  if (opts.resource?.length) {
    body.resourceName = opts.resource.map((pair) => {
      const sep = pair.indexOf(":");
      if (sep < 1 || sep === pair.length - 1) {
        throw new Error(
          `--resource expects <type>:<id> (e.g. connection:5f8d43a1b9e5a80011a35f2c), got "${pair}".`
        );
      }
      return { resourceType: singularType(pair.slice(0, sep)), _resourceId: pair.slice(sep + 1) };
    });
  }
  return body;
}
function assertNoUserIdWithMultiSelect(opts) {
  if (opts.userId) {
    throw new Error(
      "--user-id is only supported by the single-value query (GET). Drop --user-id, or use single-value --source/--action/--resource-type filters."
    );
  }
}
function listParams(opts) {
  const params = new URLSearchParams();
  if (opts.timeGte) params.set("from", opts.timeGte);
  if (opts.timeLte) params.set("to", opts.timeLte);
  params.set("limit", opts.limit ?? "100");
  return params;
}
function soleResourceType(opts) {
  return opts.resourceType?.length === 1 ? opts.resourceType[0] : void 0;
}
function postAuditList(ctx, opts, params) {
  assertNoUserIdWithMultiSelect(opts);
  const singleType = soleResourceType(opts);
  const perResource = Boolean(singleType && opts.resourceId);
  if (opts.resourceId && !perResource) {
    throw new Error(
      "--resource-id pairs with exactly one --resource-type. With multiple types, scope via --resource <type>:<id> pairs instead."
    );
  }
  const endpoint = perResource ? `v1/${singleType}/${opts.resourceId}/audit` : "v1/audit";
  return ctx.getClient().post(buildUrl(endpoint, params), buildQueryFilters(opts, !perResource));
}
function getAuditList(ctx, opts, params) {
  if (opts.action?.length) params.set("action", opts.action[0]);
  if (opts.source?.length) params.set("source", opts.source[0]);
  if (opts.userId) params.set("_byUserId", opts.userId);
  const singleType = soleResourceType(opts);
  if (singleType && opts.resourceId) {
    return ctx.getClient().list(buildUrl(`v1/${singleType}/${opts.resourceId}/audit`, params));
  }
  if (singleType) params.set("resourceType", singleType);
  if (opts.resourceId) params.set("_resourceId", opts.resourceId);
  return ctx.getClient().list(buildUrl("v1/audit", params));
}
function registerAudit(program2, ctx) {
  const group = new Command4("audit").description("View audit logs.");
  addKnowledgeHelp(group, "audit");
  group.command("list").description(
    "List audit log entries.\nWhen both --resource-type and --resource-id are given, uses the per-resource endpoint\nwhich includes descendant resources (e.g. a flow's exports, imports, scripts).\nMultiple values on --resource-type/--source/--action (or any --resource pair) switch to\nthe multi-select query endpoints, where each filter OR-matches its values."
  ).option(
    "--resource-type <types...>",
    "Filter by resource type(s) (plural: flows, connections, exports, etc.)."
  ).option("--resource-id <id>", "Filter by resource ID.").option(
    "--resource <pairs...>",
    "Scope to specific resources as <type>:<id> pairs (e.g. connection:5f8d\u2026). Repeatable."
  ).option("--user-id <id>", "Filter by user ID (single-value query only).").option(
    "--source <sources...>",
    "Filter by source(s): ui, api, system, connector, script, stack, sso."
  ).option("--action <actions...>", "Filter by action(s), e.g. create, update, delete.").option("--time-gte <iso>", "Filter by time >= ISO-8601 timestamp.").option("--time-lte <iso>", "Filter by time <= ISO-8601 timestamp.").option("--limit <n>", "Max results.", "100").action(async (opts) => {
    const params = listParams(opts);
    const data = needsPostQuery(opts) ? await postAuditList(ctx, opts, params) : await getAuditList(ctx, opts, params);
    formatOutput(data, ctx.getFormat(), {
      columns: ["_id", "resourceType", "event", "time"],
      isList: true
    });
  });
  group.command("download").description(
    "Get a signed URL to download audit logs as CSV (max 20k rows).\nThree shapes:\n  1. No --resource-type: account-wide download (all audit data).\n  2. --resource-type <type> --resource-id <id>[,<id>...]: per-resource download.\n  3. Multi-select filters (multiple --resource-type/--source/--action values, or\n     --resource pairs): account-wide download of just the matching entries.\n--resource-type on its own is rejected by the server (422 audit_not_supported).\nFor a type-only filter, use multi-select or 'celigo audit list --resource-type <type>'.\nShapes 2 and 3 cannot be combined: unlike 'list', CSV export has no per-resource\nmulti-select endpoint, so descendant-tree scope (--resource-id) and multi-value\nfilters are mutually exclusive. Use 'audit list' for that combination."
  ).option(
    "--resource-type <types...>",
    "Filter by resource type(s) (plural: flows, connections, exports, etc.)."
  ).option("--resource-id <ids>", "Filter by resource ID(s), comma-separated for multiple.").option(
    "--resource <pairs...>",
    "Scope to specific resources as <type>:<id> pairs (e.g. connection:5f8d\u2026). Repeatable."
  ).option("--user-id <id>", "Filter by user ID (single-value query only).").option(
    "--source <sources...>",
    "Filter by source(s): ui, api, system, connector, script, stack, sso."
  ).option("--action <actions...>", "Filter by action(s), e.g. create, update, delete.").option("--time-gte <iso>", "Filter by time >= ISO-8601 timestamp.").option("--time-lte <iso>", "Filter by time <= ISO-8601 timestamp.").action(async (opts) => {
    const data = await downloadAudit(ctx.getClient(), opts);
    formatOutput(data, ctx.getFormat());
  });
  program2.addCommand(group);
}
function setDefinedFields(target, source, mappings) {
  for (const [srcKey, destKey] of mappings) {
    if (source[srcKey] !== void 0) target[destKey] = source[srcKey];
  }
}
async function downloadAudit(client2, opts) {
  if (needsPostQuery(opts)) {
    assertNoUserIdWithMultiSelect(opts);
    if (opts.resourceId) {
      throw new Error(
        "CSV export cannot combine --resource-id (descendant-tree scope) with multi-select filters \u2014 the API has no per-resource multi-select signed-URL endpoint, only single-value ones. Either drop to single-value filters to keep the descendant scope, scope via --resource <type>:<id> pairs (account-wide, no descendants), or use 'audit list' which does support the combination."
      );
    }
    const params2 = new URLSearchParams();
    if (opts.timeGte) params2.set("from", opts.timeGte);
    if (opts.timeLte) params2.set("to", opts.timeLte);
    return client2.post(buildUrl("v1/audit/signedURL", params2), buildQueryFilters(opts, true));
  }
  const flat = {
    action: opts.action?.[0],
    source: opts.source?.[0],
    userId: opts.userId,
    timeGte: opts.timeGte,
    timeLte: opts.timeLte
  };
  const singleType = opts.resourceType?.[0];
  const commonMappings = [
    ["action", "action"],
    ["timeGte", "from"],
    ["timeLte", "to"],
    ["source", "source"],
    ["userId", "_byUserId"]
  ];
  if (singleType && opts.resourceId) {
    const body = { _resourceIds: opts.resourceId.split(",") };
    setDefinedFields(body, flat, commonMappings);
    return client2.post(`v1/${singleType}/audit/signedURL`, body);
  }
  if (singleType) {
    throw new Error(
      "audit download requires --resource-id alongside --resource-type (the account-wide signed-URL endpoint rejects type-only filters with 422 'audit_not_supported'). Either add --resource-id <id>[,<id>...] or drop --resource-type to download the full account log."
    );
  }
  const obj = {};
  if (opts.resourceId) obj._resourceId = opts.resourceId;
  setDefinedFields(obj, flat, commonMappings);
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) params.set(k, String(v));
  return client2.get(buildUrl("v1/audit/signedURL", params));
}

// src/commands/connections.ts
import { execFile } from "child_process";
import { randomInt as randomInt2 } from "crypto";
import chalk7 from "chalk";
var POLL_JITTER_MS = 1e3;
function registerConnections(program2, ctx) {
  const group = makeResourceGroup("connections", "connections", {
    listColumns: ["_id", "name", "type", "offline", "lastModified"],
    description: "Manage connections (credentials and configuration for external systems).",
    integrationSubpath: "connections",
    helpText: HELP.connections,
    ...ctx
  });
  program2.addCommand(group);
  addDependenciesCommand(group, ctx, "connections");
  addAuditCommand(group, ctx, "connections");
  group.command("applications").description("List the external applications in use in the account, with resource references.").option(
    "--application <name>",
    "Filter by application name (case-insensitive substring match)."
  ).action(async (opts) => {
    const data = await ctx.getClient().get("v1/applications");
    if (opts.application) {
      const q = opts.application.toLowerCase();
      data.applications = (data.applications ?? []).filter(
        (a) => a._id.toLowerCase().includes(q)
      );
    }
    formatOutput(data, ctx.getFormat());
  });
  group.command("ping <id>").description("Ping a connection (basic connectivity).").action(async (id) => {
    const result = await ctx.getClient().post(`v1/connections/${id}/ping`);
    if (result) formatOutput(result, ctx.getFormat());
    else success(`Connection ${id} ping succeeded.`);
  });
  addDebugCommands(
    group,
    ctx,
    "connection",
    "connections",
    "/debugDate",
    "View the captured logs with `connections debug-logs <id>`."
  );
  group.command("debug-logs <id>").description(
    "Fetch debug logs for a connection.\nRequires debugDate to be set (use connections enable-debug).\nNote: logs are shared across all flows using this connection."
  ).action(async (id) => {
    const data = await ctx.getClient().get(`v1/connections/${id}/debug`);
    formatOutput(data, ctx.getFormat());
  });
  group.command("authorize <id>").description(
    "Complete the OAuth2 authorization flow for an existing connection.\nOpens the provider's authorization page in your browser, then polls\nuntil the connection is authorized. Works with any connection that\nhas needsAuthorization: true (HTTP OAuth, Salesforce, etc.)."
  ).option("--timeout <seconds>", "How long to wait for authorization.", "180").option("--print-url", "Print the authorization URL instead of opening a browser.").action(async (id, opts) => {
    await authorizeConnection(ctx.getClient(), id, {
      timeout: Number.parseInt(opts.timeout, 10) || 180,
      open: !opts.printUrl,
      format: ctx.getFormat()
    });
  });
  group.command("delete-debug-logs <id>").description("Delete the captured debug logs for a connection.").option("-y, --yes", "Skip confirmation.").action(
    (id, opts) => removeWithConfirm(
      ctx,
      `v1/connections/${id}/debug`,
      opts,
      `Delete debug logs for connection ${id}?`,
      `Debug logs deleted for connection ${id}.`
    )
  );
  group.command("purge-messages <id>").description("Purge queued messages for a connection.").option("-y, --yes", "Skip confirmation.").action(
    (id, opts) => confirmThen(opts, `Purge queued messages for connection ${id}?`, async () => {
      try {
        await ctx.getClient().post(`v1/connections/${id}/purgeMessages`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/already empty/i.test(msg)) {
          success(`No queued messages to purge for connection ${id}.`);
          return;
        }
        throw err;
      }
      success(`Messages purged for connection ${id}.`);
    })
  );
}
async function authorizeConnection(client2, connectionId, opts) {
  const conn = await client2.get(`v1/connections/${connectionId}`);
  const connType = conn.type;
  const connName = conn.name;
  console.error(chalk7.dim(`Connection: ${connName} (${connType})`));
  console.error(chalk7.dim("Fetching authorization URL..."));
  let authResponse;
  try {
    authResponse = await client2.get(`v1/connection/${connectionId}/oauth2`);
  } catch (err) {
    throw new Error(
      `Failed to get authorization URL. Ensure the connection is configured for OAuth2.
${err instanceof Error ? err.message : err}`
    );
  }
  const authUrl = authResponse.authorizationURL ?? authResponse.authorizationUrl ?? authResponse.authorize_url;
  if (!authUrl || typeof authUrl !== "string") {
    throw new Error(
      `No authorization URL returned. The connection may not support OAuth2, or it may already be authorized.
Response: ${JSON.stringify(authResponse)}`
    );
  }
  if (opts.open) {
    console.error(chalk7.bold("\nOpening browser for authorization..."));
    console.error(chalk7.dim(authUrl));
    openBrowser(authUrl);
  } else {
    console.error(chalk7.bold("\nOpen this URL in your browser to authorize:"));
    console.error(authUrl);
  }
  const result = await pollForAuthorization(client2, connectionId, opts.timeout);
  formatOutput(result, opts.format);
}
async function pollForAuthorization(client2, connectionId, timeout) {
  console.error(chalk7.dim(`
Waiting up to ${timeout}s for authorization...`));
  const pollInterval = 3e3;
  const maxAttempts = Math.ceil(timeout * 1e3 / (pollInterval + POLL_JITTER_MS));
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(pollInterval + randomInt2(POLL_JITTER_MS));
    const updated = await client2.get(`v1/connections/${connectionId}`);
    if (updated.needsAuthorization) {
      if (attempt > 0 && attempt % 5 === 0) {
        const elapsed = Math.round(attempt * pollInterval / 1e3);
        console.error(chalk7.dim(`  Still waiting... (${elapsed}s)`));
      }
      continue;
    }
    console.error(chalk7.dim("Authorization detected. Verifying connection..."));
    const pingResult = await client2.tryPost(`v1/connections/${connectionId}/ping`);
    if (pingResult.ok) {
      success(`
Connection ${connectionId} authorized and online.`);
    } else {
      console.error(
        chalk7.yellow(
          `
Connection authorized but ping failed: ${String(pingResult.error ?? pingResult.status)}`
        )
      );
      console.error(
        chalk7.dim(
          "The OAuth tokens were saved. The ping failure may be a scope or permission issue."
        )
      );
    }
    return {
      _id: connectionId,
      name: updated.name,
      type: updated.type,
      offline: updated.offline,
      needsAuthorization: false
    };
  }
  throw new Error(
    `Timed out after ${timeout}s waiting for authorization.
The connection ${connectionId} still needs authorization. You can:
  1. Re-run: celigo connections authorize ${connectionId}
  2. Complete the flow in the Celigo UI`
  );
}
function openBrowser(url) {
  if (!/^https:\/\//i.test(url)) {
    console.error(chalk7.yellow(`Refusing to open non-HTTPS URL: ${url}`));
    console.error("Open the URL manually if you trust it.");
    return;
  }
  const platformBin = { darwin: "open", win32: "start" };
  const bin = platformBin[process.platform] ?? "xdg-open";
  const args = process.platform === "win32" ? ["", url] : [url];
  execFile(bin, args, (err) => {
    if (err) {
      console.error(chalk7.yellow("Could not open browser automatically. Open the URL manually."));
    }
  });
}
function sleep(ms) {
  return new Promise((resolve5) => setTimeout(resolve5, ms));
}

// src/commands/connectors.ts
import { Command as Command5 } from "commander";
function registerConnectors(program2, ctx) {
  const group = makeResourceGroup("connectors", "connectors", {
    listColumns: ["_id", "name", "lastModified"],
    description: "Manage connectors (installable integration applications).",
    ...ctx
  });
  group.command("install-base <id>").description("Get the install base (installed integrations) for a connector.").action((id) => getAndPrint(ctx, `v1/connectors/${id}/installBase`));
  group.command("install <id>").description("Install a connector from a JSON body (stdin, or --file).").option(
    "-f, --file <path>",
    "Read the JSON body from a file instead of stdin ('-' also means stdin)."
  ).action(
    (id, cmdOpts) => writeFromBody(ctx, "post", `v1/connectors/${id}/install`, cmdOpts.file)
  );
  group.command("push-update <id>").description(
    "Push an update to a connector's install base from a JSON body (stdin, or --file)."
  ).option(
    "-f, --file <path>",
    "Read the JSON body from a file instead of stdin ('-' also means stdin)."
  ).action(
    (id, cmdOpts) => writeFromBody(ctx, "put", `v1/connectors/${id}/update`, cmdOpts.file)
  );
  const licenses = new Command5("licenses").description("Manage licenses for a connector.");
  licenses.command("list <id>").description("List all licenses for a connector.").action(
    (id) => listAndPrint(ctx, `v1/connectors/${id}/licenses`, ["_id", "type", "expires"])
  );
  licenses.command("get <id> <licenseId>").description("Get a connector license by ID.").action(
    (id, licenseId) => getAndPrint(ctx, `v1/connectors/${id}/licenses/${licenseId}`)
  );
  licenses.command("create <id>").description("Create a connector license from a JSON body (stdin, or --file).").option(
    "-f, --file <path>",
    "Read the JSON body from a file instead of stdin ('-' also means stdin)."
  ).action(
    (id, cmdOpts) => writeFromBody(ctx, "post", `v1/connectors/${id}/licenses`, cmdOpts.file)
  );
  licenses.command("update <id> <licenseId>").description("Update a connector license from a JSON body (stdin, or --file).").option(
    "-f, --file <path>",
    "Read the JSON body from a file instead of stdin ('-' also means stdin)."
  ).action(
    (id, licenseId, cmdOpts) => writeFromBody(ctx, "put", `v1/connectors/${id}/licenses/${licenseId}`, cmdOpts.file)
  );
  licenses.command("delete <id> <licenseId>").description("Delete a connector license by ID.").option("-y, --yes", "Skip confirmation.").action(
    (id, licenseId, cmdOpts) => removeWithConfirm(
      ctx,
      `v1/connectors/${id}/licenses/${licenseId}`,
      cmdOpts,
      `Delete license ${licenseId} on connector ${id}?`,
      `Deleted license ${licenseId}`
    )
  );
  group.addCommand(licenses);
  program2.addCommand(group);
}

// src/commands/datasets.ts
import { Command as Command6 } from "commander";
var DATASET_COLUMNS = [
  "_id",
  "name",
  "externalId",
  "enable",
  "ingestionMode",
  "userActionRequired"
];
var CATALOG_TYPES = /* @__PURE__ */ new Set(["datasets", "exports", "all"]);
function registerDatasets(program2, ctx) {
  const group = new Command6("datasets").summary("Choose and inspect the tables/objects a sync replicates.").description(
    "Choose and inspect the tables/objects a sync replicates.\n`available` shows the menu of what could be synced from a connection (with --sync,\nannotated with what's already selected); `list --sync` shows what the sync has\nselected; `upsert --sync` changes the selection; `fields` shows one table/object's\ncolumns."
  );
  addKnowledgeHelp(group, "datasets");
  group.command("list").description(
    "List the datasets configured on a sync \u2014 the tables/objects it replicates.\nExport-backed datasets whose export no longer uses the sync's source connection\ncarry mismatchSyncConnection: true."
  ).requiredOption("--sync <syncId>", "Sync whose datasets to list.").action(
    (opts) => listAndPrint(ctx, `v1/syncs/${opts.sync}/datasets`, DATASET_COLUMNS)
  );
  group.command("get <datasetId>").description(
    "Get one dataset by ID, including its column selections (dataElements).\nDatasets have no unscoped by-id endpoint, so --sync is required."
  ).requiredOption("--sync <syncId>", "Sync the dataset belongs to.").action(
    (datasetId, opts) => getAndPrint(ctx, `v1/syncs/${opts.sync}/datasets/${datasetId}`)
  );
  group.command("upsert").description(
    'Create or update datasets on a sync in one batch (PUT).\nBody: an array of datasets \u2014 entries with "_id" (or a matching "externalId") update\nthe saved dataset; entries without one create it. Datasets you omit are left\nuntouched (this merges; it never deletes).'
  ).requiredOption("--sync <syncId>", "Sync to upsert datasets on.").option(
    "-f, --file <path>",
    "Read the JSON body from a file instead of stdin ('-' also means stdin)."
  ).action(async (opts) => {
    const body = await readBody(opts.file);
    const result = await ctx.getClient().put(`v1/syncs/${opts.sync}/datasets`, body);
    if (result) formatOutput(result, ctx.getFormat(), { isList: Array.isArray(result) });
    else success(`Datasets upserted on sync ${opts.sync}.`);
  });
  group.command("available <connectionId>").description(
    "List every table/object the connection exposes that a sync could replicate \u2014 the\ncandidate pool, not just unselected ones. Also lists the connection's exports usable\nas export-backed datasets (_catalog column: dataset vs export).\nWith --sync, entries already configured on that sync are returned alongside their\nsaved settings (saved and unsaved side by side; saved entries carry an _id)."
  ).option("--sync <syncId>", "Merge the catalog with this sync's saved dataset selections.").option("--type <type>", "Restrict the catalog: datasets, exports, or all.", "all").option("--refresh", "Bypass cache and re-read the catalog from the source application.").action(
    async (connectionId, opts) => {
      if (!CATALOG_TYPES.has(opts.type)) {
        throw new Error(
          `Invalid --type value '${opts.type}'. Use 'datasets', 'exports', or 'all'.`
        );
      }
      const params = new URLSearchParams();
      if (opts.type !== "all") params.set("type", opts.type);
      if (opts.refresh) params.set("refreshCache", "true");
      const base = opts.sync ? `v1/di/metadata/sync/${opts.sync}/connections/${connectionId}/datasets` : `v1/di/metadata/connections/${connectionId}/datasets`;
      const qs = params.size > 0 ? `?${params}` : "";
      const data = await ctx.getClient().get(`${base}${qs}`);
      const combined = [
        ...(data?.datasets ?? []).map((d) => ({ ...d, _catalog: "dataset" })),
        ...(data?.exports ?? []).map((e) => ({ ...e, _catalog: "export" }))
      ];
      formatOutput(combined, ctx.getFormat(), {
        columns: ["name", "_catalog", "_id", "enable", "ingestionMode"],
        isList: true
      });
    }
  );
  group.command("fields <connectionId> <datasetName>").description(
    "Column-level detail for one table/object on a connection: data types, lengths,\nconstraints, and the delta-cursor candidates (deltaFields).\nWith --sync, columns are merged with that sync's saved selection state.\nFor an export-backed entry, pass the export id as <datasetName> with --is-export."
  ).option("--sync <syncId>", "Merge with this sync's saved column selections.").option("--is-export", "Treat <datasetName> as an export id (export-backed dataset).").option("--refresh", "Bypass cache and re-read the columns from the source application.").option(
    "--record-type <type>",
    "NetSuite record type backing a saved-search dataset (omit for other sources)."
  ).option("--display-name <name>", "NetSuite saved-search display name (with --record-type).").action(
    async (connectionId, datasetName, opts) => {
      const params = new URLSearchParams();
      if (opts.isExport) params.set("isExport", "true");
      if (opts.refresh) params.set("refreshCache", "true");
      if (opts.recordType) params.set("recordType", opts.recordType);
      if (opts.displayName) params.set("displayName", opts.displayName);
      const scope = opts.sync ? `v1/di/metadata/sync/${opts.sync}/connections/${connectionId}` : `v1/di/metadata/connections/${connectionId}`;
      const qs = params.size > 0 ? `?${params}` : "";
      const data = await ctx.getClient().get(`${scope}/datasets/${encodeURIComponent(datasetName)}/details${qs}`);
      formatOutput(data?.dataset ?? data, ctx.getFormat());
    }
  );
  program2.addCommand(group);
}

// src/commands/edi-profiles.ts
function registerEdiProfiles(program2, ctx) {
  const ediProfilesGroup = crud(
    program2,
    "edi-profiles",
    "ediprofiles",
    ["_id", "name", "lastModified"],
    ctx,
    "Manage EDI document profiles for trading partners."
  );
  addDependenciesCommand(ediProfilesGroup, ctx, "ediprofiles");
  addAuditCommand(ediProfilesGroup, ctx, "ediprofiles");
}

// src/commands/edi-transactions.ts
import { Command as Command7 } from "commander";
function registerEdiTransactions(program2, ctx) {
  const group = new Command7("edi-transactions").summary("Query EDI transaction logs from the B2B Manager dashboard.").description(
    "Query EDI transaction logs from the B2B Manager dashboard.\nLists X12 and EDIFACT documents processed through flows."
  );
  addKnowledgeHelp(group, "edi-transactions");
  group.command("list").description(
    "Query EDI transactions.\nReturns documents processed through B2B Manager flows with envelope details,\nfunctional acknowledgement status, and control numbers."
  ).option("--file-type <type>", "EDI standard: X12 or EDIFACT.", "X12").option("--direction <dir>", "Filter by direction: Inbound or Outbound.").option("--document-type <type>", "Filter by document type (e.g. 850, 810, 856, 997).").option("--document-number <num>", "Filter by document number (e.g. PO number).").option("--integration <id>", "Filter by integration ID.").option(
    "--modified-gte <iso>",
    "Filter by lastModified >= ISO-8601 timestamp or epoch ms. Default: 30 days ago."
  ).option("--modified-lte <iso>", "Filter by lastModified <= ISO-8601 timestamp or epoch ms.").option("--limit <n>", "Max results.", "100").action(
    async (opts) => {
      const body = {
        fileType: opts.fileType,
        limit: Number.parseInt(opts.limit, 10)
      };
      if (opts.modifiedGte) {
        body.startDate = /^\d+$/.test(opts.modifiedGte) ? Number.parseInt(opts.modifiedGte, 10) : new Date(opts.modifiedGte).getTime();
      } else {
        body.startDate = Date.now() - 30 * 864e5;
      }
      if (opts.modifiedLte) {
        body.endDate = /^\d+$/.test(opts.modifiedLte) ? Number.parseInt(opts.modifiedLte, 10) : new Date(opts.modifiedLte).getTime();
      }
      if (opts.direction) body.direction = opts.direction;
      if (opts.documentType) body.documentType = opts.documentType;
      if (opts.documentNumber) body.documentNumber = opts.documentNumber;
      if (opts.integration) body._integrationId = opts.integration;
      const data = await ctx.getClient().post("v1/ediTransactions/query", body);
      const txns = data?.ediTransactions ?? [];
      formatOutput(txns, ctx.getFormat(), {
        columns: [
          "documentType",
          "documentNumber",
          "direction",
          "faStatus",
          "isaSenderId",
          "isaReceiverId",
          "lastModified"
        ],
        isList: true
      });
    }
  );
  program2.addCommand(group);
  group.command("fa-detail <id>").description("Get functional acknowledgement (997/CONTRL) details for an EDI transaction.").action((id) => getAndPrint(ctx, `v1/ediTransactions/${id}/faDetails`));
  group.command("mdn-detail <id>").description(
    "Get the AS2 MDN (message disposition notification) details for an EDI transaction."
  ).action((id) => getAndPrint(ctx, `v1/ediTransactions/${id}/mdn`));
  group.command("update-fa-status").description(
    'Update the functional-ack status (faStatus) on a batch of EDI transactions.\nBody: { "ediTransactions": [{ "_id": "...", "faStatus": "..." }, ...], "fileType": "..." }'
  ).option("-f, --file <path>", "JSON body file (or pipe via stdin).").action(async (opts) => {
    const body = await readBody(opts.file);
    const result = await ctx.getClient().patch("v1/ediTransactions", body);
    if (result) formatOutput(result, ctx.getFormat());
    else success("EDI transaction FA status updated.");
  });
  group.command("download-file <documentNumber>").description(
    'Download the raw EDI file for a document number.\nRequires --document-type (e.g. "850", "810", "ORDERS"); "X12"/"EDIFACT" are not valid values.'
  ).requiredOption(
    "--document-type <type>",
    'EDI document-type code (e.g. "850", "810", "ORDERS").'
  ).action(
    (documentNumber, opts) => getAndPrint(
      ctx,
      `v1/edi/documents/${documentNumber}/ediFile?documentType=${encodeURIComponent(opts.documentType)}`
    )
  );
}

// src/commands/environments.ts
function registerEnvironments(program2, ctx) {
  const group = makeResourceGroup("environments", "environments", {
    listColumns: ["_id", "name", "lastModified"],
    description: "Manage the environments on your account.",
    exclude: ["delete"],
    helpText: HELP.environments,
    ...ctx
  });
  program2.addCommand(group);
  const setEnabled = async (id, desired) => {
    const env = await ctx.getClient().get(`v1/environments/${id}`);
    const label = env?.name ? `${env.name} (${id})` : id;
    const verb = desired ? "enabled" : "disabled";
    if (typeof env?.enabled !== "boolean") {
      throw new TypeError(
        `Cannot determine whether environment ${label} is enabled (the API response omitted 'enabled'), so refusing to toggle it blindly. Check it in the UI and retry.`
      );
    }
    if (env.enabled === desired) {
      success(`Environment ${label} is already ${verb}.`);
      return;
    }
    await ctx.getClient().put(`v1/environments/${id}/enable`, {});
    success(`Environment ${label} ${verb}.`);
  };
  group.command("enable <id>").description("Enable an environment (no-op if already enabled).").action((id) => setEnabled(id, true));
  group.command("disable <id>").description(
    "Disable an environment (no-op if already disabled). The Production environment cannot be disabled."
  ).action((id) => setEnabled(id, false));
}

// src/commands/event-reports.ts
import { Command as Command8 } from "commander";
function registerEventReports(program2, ctx) {
  const group = new Command8("event-reports").description(
    "Manage event reports: list, get, create, signed URLs, cancel."
  );
  group.command("list").description("List all event reports.").action(() => listAndPrint(ctx, "v1/eventreports", ["_id", "status", "type", "lastModified"]));
  group.command("get <id>").description("Get an event report by ID.").action((id) => getAndPrint(ctx, `v1/eventreports/${id}`));
  group.command("create").description("Create an event report from a JSON body (stdin, or --file).").option(
    "-f, --file <path>",
    "Read the JSON body from a file instead of stdin ('-' also means stdin)."
  ).action(
    (cmdOpts) => writeFromBody(ctx, "post", "v1/eventreports", cmdOpts.file)
  );
  group.command("signed-url <id>").description("Get the signed download URL for an event report.").action((id) => getAndPrint(ctx, `v1/eventreports/${id}/signedURL`));
  group.command("cancel <id>").description("Cancel an in-progress event report.").option("-y, --yes", "Skip confirmation.").action(
    (id, cmdOpts) => confirmThen(cmdOpts, `Cancel event report ${id}?`, async () => {
      await ctx.getClient().put(`v1/eventreports/${id}/cancel`, {});
      success(`Cancelled event report ${id}.`);
    })
  );
  program2.addCommand(group);
}

// src/commands/exports.ts
function registerExports(program2, ctx) {
  const group = crud(
    program2,
    "exports",
    "exports",
    ["_id", "name", "adaptorType", "_connectionId", "lastModified"],
    ctx,
    "Manage exports (data sources that read from external systems).",
    "exports"
  );
  addDependenciesCommand(group, ctx, "exports");
  addAuditCommand(group, ctx, "exports");
  addCloneCommand(group, ctx, "exports", "export");
  group.command("replace-connection <id> <newConnectionId>").description("Replace the connection on an export.").action(async (id, newConnectionId) => {
    await replaceConnection(
      ctx.getClient(),
      `v1/exports/${id}/replaceConnection`,
      { _newConnectionId: newConnectionId },
      `Replaced connection on export ${id}.`,
      ctx.getFormat()
    );
  });
  group.command("invoke [id]").description(
    "Invoke an export and return data (no job created).\nWith <id>: invokes a saved export by ID.\nWithout <id>: supply an export document (stdin or --file) to preview its output.\nUse --all to auto-page through all results."
  ).option("--all", "Fetch all pages (auto-paginate).").option(
    "-f, --file <path>",
    "Read the preview export document from a file instead of stdin ('-' also means stdin)."
  ).action(async (id, opts) => {
    if (!id) {
      const body = await readBody(opts.file);
      const result = await ctx.getClient().post("v1/exports/preview", body);
      formatOutput(result, ctx.getFormat());
      return;
    }
    const firstPage = await ctx.getClient().post(`v1/exports/${id}/invoke`);
    if (!opts.all || !firstPage.pagedExportState) {
      formatOutput(firstPage, ctx.getFormat());
      return;
    }
    const allData = Array.isArray(firstPage.data) ? [...firstPage.data] : [];
    let state = firstPage.pagedExportState;
    let page = 1;
    while (state) {
      page++;
      const next = await ctx.getClient().post(`v1/exports/${id}/invoke`, { pagedExportState: state });
      if (Array.isArray(next.data)) allData.push(...next.data);
      state = next.pagedExportState;
      if (page > 1e3) break;
    }
    formatOutput({ data: allData, pages: page }, ctx.getFormat());
  });
  addDebugCommands(
    group,
    ctx,
    "export",
    "exports",
    "/debugUntil",
    "Request/response logs are then captured by any flow, API, or tool that runs this export \u2014 fetch them from the consumer with `flows debug-requests <flowId> <exportId>` (or `apis`/`tools debug-requests`)."
  );
}

// src/commands/file-definitions.ts
function registerFileDefinitions(program2, ctx) {
  const fileDefinitionsGroup = crud(
    program2,
    "file-definitions",
    "filedefinitions",
    ["_id", "name", "lastModified"],
    ctx,
    "Manage file format definitions (CSV, EDI, fixed-width, etc.)."
  );
  addDependenciesCommand(fileDefinitionsGroup, ctx, "filedefinitions");
  addAuditCommand(fileDefinitionsGroup, ctx, "filedefinitions");
}

// src/commands/flows.ts
async function buildFlowConnectionSelfMap(client2, flow) {
  const steps = collectFlowStepIds(flow);
  const expIds = Array.from(new Set(steps.filter((s) => s.type === "export").map((s) => s.id)));
  const impIds = Array.from(new Set(steps.filter((s) => s.type === "import").map((s) => s.id)));
  const resources = await Promise.all([
    ...expIds.map((eid) => client2.get(`v1/exports/${eid}`)),
    ...impIds.map((iid) => client2.get(`v1/imports/${iid}`))
  ]);
  const map = {};
  for (const r of resources) {
    const cid = r._connectionId;
    if (cid) map[cid] = cid;
  }
  return map;
}
function autoCloneName(sourceKind, sourceId, sourceName) {
  if (!sourceName) {
    throw new Error(
      `Source ${sourceKind} ${sourceId} has no name \u2014 cannot auto-generate a clone name. Provide --name explicitly.`
    );
  }
  return `Clone - ${sourceName}`;
}
async function runBatched(items, fn) {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    await fn(items.slice(i, i + BATCH_SIZE));
  }
}
function errorIdOf(e) {
  return String(e.errorId ?? e._id);
}
async function findFlowStepError(client2, id, exportOrImportId, errorId) {
  const errors = await client2.listBodyPaginated(
    `v1/flows/${id}/${exportOrImportId}/errors`
  );
  const match = errors.find((e) => String(e.errorId) === errorId);
  if (!match) {
    throw new Error(
      `Error ${errorId} not found among the open errors on step ${exportOrImportId} of flow ${id}.`
    );
  }
  return match;
}
async function resolveErrorKeys(client2, explicit, listEndpoint, emptyMsg, confirmMsg, keyOf, yes) {
  if (explicit) return parseIds(explicit);
  const records = await client2.listBodyPaginated(listEndpoint);
  if (records.length === 0) {
    success(emptyMsg);
    return void 0;
  }
  if (!yes) {
    const ok = await confirm(confirmMsg(records.length));
    if (!ok) return void 0;
  }
  return records.map(keyOf).filter(Boolean);
}
async function runErrorAction(opts) {
  const { client: client2, explicit, listEndpoint, emptyMsg, confirmMsg, keyOf, yes, write, successMsg } = opts;
  const keys = await resolveErrorKeys(
    client2,
    explicit,
    listEndpoint,
    emptyMsg,
    confirmMsg,
    keyOf,
    yes
  );
  if (keys === void 0) return;
  await runBatched(keys, write);
  success(successMsg(keys.length));
}
function addFlowErrorActionCommand(group, ctx, spec) {
  group.command(spec.command).description(spec.description).option("-y, --yes", spec.yesHelp).action(
    async (id, exportOrImportId, keys, opts) => {
      const client2 = ctx.getClient();
      await runErrorAction({
        client: client2,
        explicit: keys,
        listEndpoint: `v1/flows/${id}/${exportOrImportId}/${spec.listSuffix}`,
        emptyMsg: spec.emptyMsg,
        confirmMsg: spec.confirmMsg,
        keyOf: spec.keyOf,
        yes: opts.yes,
        write: (batch) => spec.write(client2, id, exportOrImportId, batch),
        successMsg: spec.successMsg
      });
    }
  );
}
function registerFlows(program2, ctx) {
  const group = crud(
    program2,
    "flows",
    "flows",
    ["_id", "name", "_integrationId", "disabled", "lastModified", "lastExecutedAt"],
    ctx,
    "Manage flows (data pipelines connecting exports to imports).",
    "flows"
  );
  addDependenciesCommand(group, ctx, "flows");
  addAuditCommand(group, ctx, "flows");
  group.command("run <id>").description(
    "Trigger a flow run.\nUse --start-time/--end-time for delta window override.\nUse --export-ids to run specific exports in a multi-generator flow."
  ).option("--start-time <iso>", "Delta window start (ISO 8601). Maps to lastExportDateTime.").option("--end-time <iso>", "Delta window end (ISO 8601). Maps to currentExportDateTime.").option("--export-ids <ids>", "Comma-separated export IDs to run (default: all).").option("-y, --yes", "Skip confirmation.").action(
    async (id, opts) => {
      if (!opts.yes) {
        const ok = await confirm(`Run flow ${id}?`);
        if (!ok) return;
      }
      const body = {};
      if (opts.startTime || opts.endTime) {
        body.export = {
          ...opts.startTime && { startDate: opts.startTime },
          ...opts.endTime && { endDate: opts.endTime }
        };
      }
      if (opts.exportIds) {
        body._exportIds = opts.exportIds.split(",").map((s) => s.trim()).filter(Boolean);
      }
      const result = await ctx.getClient().post(`v1/flows/${id}/run`, Object.keys(body).length > 0 ? body : void 0);
      if (result) formatOutput(result, ctx.getFormat());
      else success(`Flow ${id} triggered.`);
    }
  );
  group.command("clone <id> <integrationId> <environmentId>").description(
    `Clone a flow into a target integration and environment.
Same-env clone: no stdin needed \u2014 the CLI auto-builds a self-map from the source flow's
connections (via its parent integration's registered connections).
Cross-env clone: pipe an explicit map via stdin: {"connectionMap":{"sourceConnId":"targetConnId",...}}`
  ).option("--flow-group <id>", "Target flow group ID within the integration.").option(
    "--name <name>",
    'Name for the cloned flow. Defaults to "Clone - <source name>" (matches the UI).'
  ).action(
    async (id, integrationId, environmentId, opts) => {
      const client2 = ctx.getClient();
      const stdin = await tryReadStdin() ?? {};
      let connectionMap = stdin.connectionMap;
      let name = opts.name;
      if (!connectionMap || !name) {
        const flow = await client2.get(`v1/flows/${id}`);
        name ??= autoCloneName("flow", id, flow.name);
        connectionMap ??= await buildFlowConnectionSelfMap(client2, flow);
      }
      const body = {
        name,
        connectionMap,
        _integrationId: integrationId,
        envId: environmentId,
        _flowGroupingId: opts.flowGroup ?? null
      };
      const result = await ctx.getClient().post(`v1/flows/${id}/clone`, body);
      formatOutput(result, ctx.getFormat());
    }
  );
  group.command("errors <id> <exportOrImportId>").description("Get open errors for a flow export or import.").action(async (id, exportOrImportId) => {
    const data = await ctx.getClient().listBodyPaginated(`v1/flows/${id}/${exportOrImportId}/errors`);
    formatOutput(data, ctx.getFormat(), {
      columns: ["_id", "code", "message", "occurredAt", "tags"],
      isList: true
    });
  });
  group.command("resolved-errors <id> <exportOrImportId>").description("Get resolved errors for a flow export or import.").action(async (id, exportOrImportId) => {
    const data = await ctx.getClient().listBodyPaginated(`v1/flows/${id}/${exportOrImportId}/resolved`);
    formatOutput(data, ctx.getFormat(), {
      columns: ["_id", "code", "message", "resolvedAt"],
      isList: true
    });
  });
  addFlowErrorActionCommand(group, ctx, {
    command: "resolve-errors <id> <exportOrImportId> [errorIds]",
    description: "Resolve errors by ID (comma-separated), or omit to resolve all (-y).",
    yesHelp: "Skip confirmation when resolving all.",
    listSuffix: "errors",
    emptyMsg: "No open errors to resolve.",
    confirmMsg: (n) => `Resolve ${n} error(s)?`,
    keyOf: errorIdOf,
    successMsg: (n) => `Resolved ${n} error(s).`,
    write: (client2, id, exportOrImportId, batch) => client2.put(`v1/flows/${id}/${exportOrImportId}/resolved`, { errors: batch })
  });
  group.command("error <id> <exportOrImportId> <errorId>").description(
    "Get one open error on a flow step by its errorId.\n--request-detail also fetches the captured HTTP request/response trace (via the error's reqAndResKey).\n--retry-data also fetches the editable retry data (via the error's retryDataKey).\nWith either flag the output is a composite { error, requestResponse?, retryData? }.\nIf you already have a reqAndResKey (e.g. from `debug-requests`), use `debug-request-detail` instead."
  ).option("--request-detail", "Include the captured HTTP request/response trace.").option("--retry-data", "Include the editable retry data.").action(
    async (id, exportOrImportId, errorId, opts) => {
      const client2 = ctx.getClient();
      const error = await findFlowStepError(client2, id, exportOrImportId, errorId);
      if (!opts.requestDetail && !opts.retryData) {
        formatOutput(error, ctx.getFormat());
        return;
      }
      const out = { error };
      if (opts.requestDetail) {
        const key = error.reqAndResKey;
        if (typeof key !== "string" || !key) {
          throw new Error(
            `Error ${errorId} has no stored request/response trace \u2014 record-level errors from non-HTTP adaptors (e.g. NetSuite distributed imports) lack a reqAndResKey.`
          );
        }
        out.requestResponse = await client2.get(
          `v1/flows/${id}/${exportOrImportId}/requests/${key}`
        );
      }
      if (opts.retryData) {
        const key = error.retryDataKey;
        if (typeof key !== "string" || !key) {
          throw new Error(
            `Error ${errorId} has no retry data \u2014 only retryable record-level errors carry a retryDataKey.`
          );
        }
        out.retryData = await client2.get(`v1/flows/${id}/${exportOrImportId}/${key}/data`);
      }
      formatOutput(out, ctx.getFormat());
    }
  );
  group.command("delete-debug-requests <id> <exportOrImportId> [reqAndResKeys]").description(
    "Delete stored HTTP request/response traces for a flow step.\nPass reqAndResKeys (comma-separated) to delete specific traces, or omit to clear every trace referenced by the step's current errors. The error records themselves remain."
  ).option("-y, --yes", "Skip confirmation.").action(
    async (id, exportOrImportId, reqAndResKeys, opts) => {
      const client2 = ctx.getClient();
      let keys;
      if (reqAndResKeys) {
        keys = parseIds(reqAndResKeys);
      } else {
        const errors = await client2.listBodyPaginated(
          `v1/flows/${id}/${exportOrImportId}/errors`
        );
        keys = errors.map((e) => e.reqAndResKey).filter((k) => typeof k === "string" && k.length > 0);
      }
      if (keys.length === 0) {
        console.error("No request/response traces to delete.");
        return;
      }
      if (!opts.yes) {
        const ok = await confirm(
          `Delete ${keys.length} request/response trace(s) for step ${exportOrImportId}?`
        );
        if (!ok) return;
      }
      const result = await client2.delete(`v1/flows/${id}/${exportOrImportId}/requests`, { keys });
      if (result) formatOutput(result, ctx.getFormat());
      else success(`Deleted ${keys.length} request/response trace(s).`);
    }
  );
  addFlowErrorActionCommand(group, ctx, {
    command: "retry-errors <id> <exportOrImportId> [retryDataKeys]",
    description: "Retry errors by retryDataKey (comma-separated), or omit to retry all (-y).",
    yesHelp: "Skip confirmation when retrying all.",
    listSuffix: "errors",
    emptyMsg: "No open errors to retry.",
    confirmMsg: (n) => `Retry ${n} error(s)?`,
    keyOf: (e) => typeof e.retryDataKey === "string" ? e.retryDataKey : "",
    successMsg: (n) => `Retried ${n} record(s).`,
    write: (client2, id, exportOrImportId, batch) => client2.post(`v1/flows/${id}/${exportOrImportId}/retry`, { retryDataKeys: batch })
  });
  group.command("assign-errors <id> <exportOrImportId> <email> [errorIds]").description(
    "Assign errors to a user by email.\nSpecify errorIds (comma-separated), or omit to assign all (-y)."
  ).option("-y, --yes", "Skip confirmation when assigning all.").action(
    async (id, exportOrImportId, email, errorIds, opts) => {
      const client2 = ctx.getClient();
      await runErrorAction({
        client: client2,
        explicit: errorIds,
        listEndpoint: `v1/flows/${id}/${exportOrImportId}/errors`,
        emptyMsg: "No open errors to assign.",
        confirmMsg: (n) => `Assign ${n} error(s)?`,
        keyOf: errorIdOf,
        yes: opts.yes,
        write: (batch) => client2.put(`v1/flows/${id}/${exportOrImportId}/errors/assign`, {
          errorIds: batch,
          email
        }),
        successMsg: (n) => `Assigned ${n} error(s) to ${email}.`
      });
    }
  );
  addFlowErrorActionCommand(group, ctx, {
    command: "unassign-errors <id> <exportOrImportId> [errorIds]",
    description: "Unassign errors by ID (comma-separated), or omit to unassign all (-y).",
    yesHelp: "Skip confirmation when unassigning all.",
    listSuffix: "errors",
    emptyMsg: "No open errors to unassign.",
    confirmMsg: (n) => `Unassign ${n} error(s)?`,
    keyOf: errorIdOf,
    successMsg: (n) => `Unassigned ${n} error(s).`,
    write: (client2, id, exportOrImportId, batch) => client2.put(`v1/flows/${id}/${exportOrImportId}/errors/unassign`, { errorIds: batch })
  });
  addFlowErrorActionCommand(group, ctx, {
    command: "delete-resolved-errors <id> <exportOrImportId> [errorIds]",
    description: "Delete resolved errors.\nSpecify errorIds (comma-separated), or omit to delete all (-y).",
    yesHelp: "Skip confirmation when deleting all.",
    listSuffix: "resolved",
    emptyMsg: "No resolved errors to delete.",
    confirmMsg: (n) => `Delete ${n} resolved error(s)?`,
    keyOf: errorIdOf,
    successMsg: (n) => `Deleted ${n} resolved error(s).`,
    write: (client2, id, exportOrImportId, batch) => client2.delete(`v1/flows/${id}/${exportOrImportId}/resolved`, { errors: batch })
  });
  group.command("update-error-data <id> <exportOrImportId> <errorId>").description(
    "Update an error's retry data before retrying.\nResolves the error's retryDataKey internally, so pass the errorId (same key as `error`).\nPipe the modified data object via stdin (from `error --retry-data` output)."
  ).action(async (id, exportOrImportId, errorId) => {
    const client2 = ctx.getClient();
    const error = await findFlowStepError(client2, id, exportOrImportId, errorId);
    const key = error.retryDataKey;
    if (typeof key !== "string" || !key) {
      throw new Error(
        `Error ${errorId} has no retry data \u2014 only retryable record-level errors carry a retryDataKey.`
      );
    }
    const body = await readStdin();
    const result = await client2.put(`v1/flows/${id}/${exportOrImportId}/${key}/data`, body);
    if (result) formatOutput(result, ctx.getFormat());
    else success(`Updated error data for ${errorId}.`);
  });
  group.command("tag-errors <id> <exportOrImportId>").description(
    'Update tags on errors for a flow step.\nPipe JSON via stdin: {"errors":[{"id":"<errorId>","rdk":"<retryDataKey>"}],"tagIds":["<tagId>"]}\ntagIds uses the short tag code from `tags list` (the `tagId` field, e.g. F3ZBQ), not the Mongo _id.\nReads project tag names under a `tags` field on each error \u2014 see `flows errors` output.\nEmpty tagIds array removes all tags.'
  ).action(async (id, exportOrImportId) => {
    const body = await readStdin();
    const result = await ctx.getClient().put(`v1/flows/${id}/${exportOrImportId}/tags`, body);
    formatOutput(result, ctx.getFormat());
  });
  group.command("error-summary <id>").description("Summarize a flow's open errors (per-step counts and last-error times).").action(async (flowId) => {
    const data = await ctx.getClient().get(`v1/flows/${flowId}/errors`);
    const rows = (data?.flowErrors ?? []).map((entry) => ({
      stepId: entry._expOrImpId,
      openErrors: typeof entry.numError === "number" ? entry.numError : 0,
      lastErrorAt: entry.lastErrorAt
    }));
    const withErrors = rows.filter((r) => r.openErrors > 0);
    if (withErrors.length === 0 && ctx.getFormat() === "table") {
      success(`No open errors in flow ${flowId}.`);
      return;
    }
    formatOutput(withErrors, ctx.getFormat(), {
      columns: ["stepId", "openErrors", "lastErrorAt"],
      isList: true
    });
  });
  group.command("error-analysis <id> <exportOrImportId>").description("Analyze errors for a flow step: group by pattern and count.").option("--limit <n>", "Max errors to fetch.", "100").action(async (flowId, exportOrImportId, opts) => {
    const client2 = ctx.getClient();
    const errors = await client2.listBodyPaginated(
      `v1/flows/${flowId}/${exportOrImportId}/errors`
    );
    const limit = Number.parseInt(opts.limit, 10) || 100;
    const subset = errors.slice(0, limit);
    const groups = /* @__PURE__ */ new Map();
    for (const err of subset) {
      const msg = typeof err.message === "string" ? err.message : "Unknown error";
      const code = typeof err.code === "string" ? err.code : "";
      const key = `${code}:${msg.slice(0, 200)}`;
      if (!groups.has(key)) {
        groups.set(key, {
          message: msg.slice(0, 200),
          code,
          count: 0,
          sampleId: typeof err._id === "string" ? err._id : ""
        });
      }
      const entry = groups.get(key);
      if (entry) entry.count++;
    }
    const patterns = [...groups.values()].sort((a, b) => b.count - a.count);
    formatOutput(
      { totalErrors: errors.length, analyzed: subset.length, patterns },
      ctx.getFormat()
    );
  });
  withProcessorOptions(
    group.command("add-processor <id> <exportOrImportId>").description(
      "Add a page processor to a flow.\nAuto-detects whether the ID is an export or import.\nExample: celigo flows add-processor <id> <importId>"
    )
  ).action(async (id, exportOrImportId, opts) => {
    const client2 = ctx.getClient();
    const { type, processor } = await detectProcessorType(client2, exportOrImportId);
    const flow = await client2.get(`v1/flows/${id}`);
    if (!opts.yes) {
      const ok = await confirm(`Add ${type} '${exportOrImportId}' to flow ${id}?`);
      if (!ok) return;
    }
    const routers = flow.routers;
    let pps;
    if (opts.router || Array.isArray(routers) && routers.length > 0) {
      if (!Array.isArray(routers) || routers.length === 0) {
        throw new TypeError("Flow has no routers.");
      }
      if (!opts.router && routers.length > 0) {
        throw new Error(
          "Flow uses routers. Specify --router (and optionally --branch) to target a branch."
        );
      }
      const branch = resolveBranch(routers, opts, "Flow");
      if (!Array.isArray(branch.pageProcessors)) branch.pageProcessors = [];
      pps = branch.pageProcessors;
    } else {
      if (!Array.isArray(flow.pageProcessors)) flow.pageProcessors = [];
      pps = flow.pageProcessors;
    }
    pps.push(processor);
    const result = await client2.put(`v1/flows/${id}`, flow);
    formatOutput(result, ctx.getFormat());
  });
  withProcessorOptions(
    group.command("remove-processor <id> <exportOrImportId>").description("Remove a page processor from a flow by its export or import ID.")
  ).action(async (id, exportOrImportId, opts) => {
    const client2 = ctx.getClient();
    const flow = await client2.get(`v1/flows/${id}`);
    const routers = flow.routers;
    let pps;
    if (Array.isArray(routers) && routers.length > 0) {
      pps = findProcessorList(routers, exportOrImportId, opts);
    } else {
      pps = flow.pageProcessors ?? [];
    }
    await removeProcessorAndPut({
      client: client2,
      pps,
      exportOrImportId,
      doc: flow,
      putEndpoint: `v1/flows/${id}`,
      confirmMsg: `Remove processor '${exportOrImportId}' from flow ${id}?`,
      yes: opts.yes,
      format: ctx.getFormat()
    });
  });
  group.command("add-generator <id> <exportId>").description(
    "Add a page generator (export) to a flow.\nExample: celigo flows add-generator <id> <exportId>\n         celigo flows add-generator <id> <exportId> --schedule '? */5 * * * *'"
  ).option("--index <position>", "Insert at this 0-based position (default: append to end).").option(
    "--schedule <cron>",
    "Override schedule for this generator (6-field cron with seconds)."
  ).option("-y, --yes", "Skip confirmation.").action(
    async (id, exportId, opts) => {
      const client2 = ctx.getClient();
      const flow = await client2.get(`v1/flows/${id}`);
      if (!opts.yes) {
        const ok = await confirm(`Add generator '${exportId}' to flow ${id}?`);
        if (!ok) return;
      }
      const gen = { _exportId: exportId };
      if (opts.schedule) gen.schedule = opts.schedule;
      if (!Array.isArray(flow.pageGenerators)) flow.pageGenerators = [];
      const pgs = flow.pageGenerators;
      if (opts.index === void 0) {
        pgs.push(gen);
      } else {
        const insertAt = Number.parseInt(opts.index, 10);
        if (insertAt < 0 || insertAt > pgs.length) {
          throw new Error(`Invalid index ${insertAt}. Valid range: 0\u2013${pgs.length}.`);
        }
        pgs.splice(insertAt, 0, gen);
      }
      const result = await client2.put(`v1/flows/${id}`, flow);
      formatOutput(result, ctx.getFormat());
    }
  );
  group.command("remove-generator <id> <exportId>").description("Remove a page generator from a flow by export ID.").option("-y, --yes", "Skip confirmation.").action(async (id, exportId, opts) => {
    const client2 = ctx.getClient();
    const flow = await client2.get(`v1/flows/${id}`);
    const pgs = flow.pageGenerators;
    if (!Array.isArray(pgs) || pgs.length === 0) {
      throw new Error("Flow has no page generators.");
    }
    const idx = pgs.findIndex((pg) => pg._exportId === exportId);
    if (idx === -1) {
      throw new Error(`No page generator with _exportId '${exportId}' found in this flow.`);
    }
    if (!opts.yes) {
      const ok = await confirm(`Remove generator '${exportId}' from flow ${id}?`);
      if (!ok) return;
    }
    pgs.splice(idx, 1);
    const result = await client2.put(`v1/flows/${id}`, flow);
    formatOutput(result, ctx.getFormat());
  });
  group.command("replace-connection <id> <oldConnectionId> <newConnectionId>").description("Swap a connection across all exports and imports in a flow.").action(async (id, oldConnectionId, newConnectionId) => {
    await replaceConnection(
      ctx.getClient(),
      `v1/flows/${id}/replaceConnection`,
      { _connectionId: oldConnectionId, _newConnectionId: newConnectionId },
      `Replaced connection on flow ${id}.`,
      ctx.getFormat()
    );
  });
  group.command("set-group <flowGroupingId> <flowIds...>").description(
    "Assign one or more flows to a flow group (created via `integrations create-flow-group`).\nTo remove flows from their group, use `flows unset-group`."
  ).action(async (flowGroupingId, flowIds) => {
    await ctx.getClient().put("v1/flows/updateFlowGrouping", {
      _flowIds: flowIds,
      _flowGroupingId: flowGroupingId
    });
    success(`Assigned ${flowIds.length} flow(s) to flow group ${flowGroupingId}.`);
  });
  group.command("unset-group <flowIds...>").description("Remove one or more flows from their flow group (leaves them ungrouped).").action(async (flowIds) => {
    await ctx.getClient().put("v1/flows/updateFlowGrouping", {
      _flowIds: flowIds,
      _flowGroupingId: null
    });
    success(`Removed ${flowIds.length} flow(s) from their flow group.`);
  });
  addDebugRequestCommands(group, ctx, "flows");
  addTestRunCommands(group, ctx, "flows");
  group.command("enable-execution-logs <id>").description(
    "Enable debug execution logging on a flow (sets logging.debugUntil via PATCH).\nOnce enabled, subsequent flow runs will capture detailed execution logs\nviewable via execution-logs, query-execution-logs, and execution-log-detail."
  ).option("--duration <minutes>", "Debug duration in minutes (max 60).", "60").action(async (id, opts) => {
    const minutes = Math.min(Number.parseInt(opts.duration, 10) || 60, 60);
    const value = new Date(Date.now() + minutes * 6e4).toISOString();
    await ctx.getClient().patch(`v1/flows/${id}`, [{ op: "replace", path: "/logging/debugUntil", value }]);
    success(`Execution logging enabled (debug) on flow ${id} until ${value}.`);
  });
  group.command("disable-execution-logs <id>").description("Disable debug execution logging on a flow (removes logging.debugUntil).").action(async (id) => {
    await ctx.getClient().patch(`v1/flows/${id}`, [{ op: "remove", path: "/logging/debugUntil" }]);
    success(`Execution logging debug disabled on flow ${id}.`);
  });
  group.command("execution-logs <id> <jobId>").description(
    "List execution log entries for a flow run.\nEach entry has recordId, groupId, traceKey, and _expOrImpId \u2014 feed these to\nquery-execution-logs and execution-log-detail to drill into per-step traces."
  ).action(async (id, jobId) => {
    const data = await ctx.getClient().get(`v1/flows/${id}/jobs/${jobId}/logs`);
    formatOutput(data, ctx.getFormat());
  });
  group.command("query-execution-logs <id> <jobId>").description(
    "Search execution log metadata for a flow run step.\nPass --trace-key to widen results to every step sharing that trace (both export and import)."
  ).requiredOption("--export-or-import-id <exportOrImportId>", "Export or import ID.").requiredOption("--group-id <groupId>", "Group ID.").requiredOption("--record-id <recordId>", "Record ID.").option("--trace-key <traceKey>", "Trace key \u2014 enables traceView across paired steps.").action(
    async (id, jobId, opts) => {
      const body = {
        _expOrImpId: opts.exportOrImportId,
        groupId: opts.groupId,
        recordId: opts.recordId
      };
      if (opts.traceKey) body.traceKey = opts.traceKey;
      const data = await ctx.getClient().post(`v1/flows/${id}/jobs/${jobId}/logs/metadata/query`, body);
      formatOutput(data, ctx.getFormat());
    }
  );
  group.command("execution-log-detail <id> <jobId>").description(
    "Get per-step execution log data for a flow run.\nFor HTTP request/response traces on HTTPExport/HTTPImport steps, use --stage apiCall.\nOther stages (preMap, postMap, postSubmit, postResponseMap) populate only when the\ncorresponding script hook calls options.logs.push(...).\nGet groupId / recordId / _expOrImpId from `execution-logs`; the response includes\ndecoded request and response bodies."
  ).requiredOption("--export-or-import-id <exportOrImportId>", "Export or import ID.").requiredOption(
    "--stage <stage>",
    "Execution stage (e.g. apiCall for HTTP request/response traces)."
  ).requiredOption("--group-id <groupId>", "Group ID.").requiredOption("--record-id <recordId>", "Record ID.").action(
    async (id, jobId, opts) => {
      const body = {
        _expOrImpId: opts.exportOrImportId,
        stage: opts.stage,
        groupId: opts.groupId,
        recordId: opts.recordId
      };
      const data = await ctx.getClient().post(`v1/flows/${id}/jobs/${jobId}/logs/data/query`, body);
      formatOutput(data, ctx.getFormat());
    }
  );
  group.command("last-export-date <id>").description(
    "Get the last export date/time for a flow (flow-level delta checkpoint).\nReturns the most recent export timestamp across all generators in the flow."
  ).action(async (id) => {
    const data = await ctx.getClient().get(`v1/flows/${id}/lastExportDateTime`);
    formatOutput(data, ctx.getFormat());
  });
  group.command("delete-execution-logs <id>").description(
    "Delete a flow's execution logs within a time range.\n--started-gte and --started-lte are required ISO-8601 timestamps; --started-gte must be before --started-lte."
  ).requiredOption(
    "--started-gte <iso>",
    "Filter by startedAt >= ISO-8601 timestamp (inclusive). Required by the API."
  ).requiredOption(
    "--started-lte <iso>",
    "Filter by startedAt <= ISO-8601 timestamp (inclusive). Must be after --started-gte."
  ).option("-y, --yes", "Skip confirmation.").action((id, opts) => {
    const qs = new URLSearchParams({ startedAt: opts.startedGte, endAt: opts.startedLte });
    return removeWithConfirm(
      ctx,
      `v1/flows/${id}/logs?${qs.toString()}`,
      opts,
      `Delete logs for flow ${id} from ${opts.startedGte} to ${opts.startedLte}?`,
      "Flow logs deleted."
    );
  });
  group.command("cancel-jobs <id>").description("Cancel a flow's jobs.").option("-y, --yes", "Skip confirmation.").option("-f, --file <path>", "JSON body file (or pipe via stdin).").action(
    (id, opts) => confirmThen(opts, `Cancel jobs for flow ${id}?`, async () => {
      const body = opts.file ? await readBody(opts.file) : void 0;
      await writeAndReport(ctx, "post", `v1/flows/${id}/jobs/cancel`, body, "Jobs cancelled.");
    })
  );
}

// src/commands/http-connectors.ts
import { Command as Command9 } from "commander";
var LIST_COLUMNS = ["_id", "name", "published", "isGraphQL"];
function registerHttpConnectors(program2, ctx) {
  const group = new Command9("http-connectors").summary("Browse and manage HTTP connector definitions (550+ managed plus custom ones).").description(
    "Browse and manage HTTP connector definitions (Celigo's 550+ managed connectors plus custom ones).\nDrill into a connector with `resources`/`endpoints`, or `get --full` to inline everything. create/update/delete apply to custom connector definitions."
  );
  addKnowledgeHelp(group, "http-connectors");
  group.command("list").description("List all HTTP connector definitions.").option(FIELDS_OPTION_FLAGS, FIELDS_OPTION_DESCRIPTION).action(async (cmdOpts) => {
    const fields = resolveListFields({
      fields: cmdOpts.fields,
      jqActive: isJqActive(),
      setting: ctx.getListFields?.(),
      defaults: defaultProjection(LIST_COLUMNS)
    });
    const data = await ctx.getClient().list(withListProjection("v1/httpconnectors", fields));
    formatOutput(projectRows(data, fields), ctx.getFormat(), {
      columns: LIST_COLUMNS,
      isList: true
    });
  });
  group.command("get <id>").description(
    "Get an HTTP connector definition.\nUse --full to include endpoints, resources, supported fields, and global iClient refs."
  ).option("--full", "Include all endpoints, resources, and supportedBy fields.").action(async (id, opts) => {
    const qs = opts.full ? "?returnEverything=true" : "";
    const data = await ctx.getClient().get(`v1/httpconnectors/${id}${qs}`);
    formatOutput(data, ctx.getFormat());
  });
  program2.addCommand(group);
  addWriteCommands(group, ctx, {
    endpoint: "httpconnectors",
    descNoun: "an HTTP connector definition",
    confirmNoun: "HTTP connector"
  });
  group.command("resources <connectorId>").description("List resources for an HTTP connector.").action(
    (connectorId) => getAndPrint(ctx, `v1/httpconnectors/${connectorId}/httpconnectorresources`, ["_id", "name"])
  );
  group.command("resource <connectorId> <id>").description("Get an HTTP connector resource by id.").action(
    (connectorId, id) => getAndPrint(ctx, `v1/httpconnectors/${connectorId}/${id}`)
  );
  group.command("endpoints <connectorId> <resourceId>").description("List endpoints for an HTTP connector resource.").action(
    (connectorId, resourceId) => getAndPrint(ctx, `v1/httpconnectors/${connectorId}/${resourceId}/httpconnectorendpoints`, [
      "_id",
      "name"
    ])
  );
  group.command("endpoint <connectorId> <resourceId> <id>").description("Get an HTTP connector endpoint by id.").action(
    (connectorId, resourceId, id) => getAndPrint(ctx, `v1/httpconnectors/${connectorId}/${resourceId}/${id}`)
  );
}

// src/commands/iclients.ts
function registerIclients(program2, ctx) {
  const iclientsGroup = makeResourceGroup("iclients", "iclients", {
    listColumns: ["_id", "name", "lastModified"],
    description: "Manage OAuth2 iClients (app registrations for OAuth flows).",
    helpText: HELP.iclients,
    ...ctx
  });
  addDependenciesCommand(iclientsGroup, ctx, "iclients");
  addAuditCommand(iclientsGroup, ctx, "iclients");
  program2.addCommand(iclientsGroup);
}

// src/commands/imports.ts
function registerImports(program2, ctx) {
  const group = crud(
    program2,
    "imports",
    "imports",
    ["_id", "name", "adaptorType", "_connectionId", "lastModified"],
    ctx,
    "Manage imports (data destinations that write to external systems).",
    "imports"
  );
  addDependenciesCommand(group, ctx, "imports");
  addAuditCommand(group, ctx, "imports");
  addCloneCommand(group, ctx, "imports", "import");
  group.command("invoke [id]").description(
    `Invoke an import (no job created).
  With <id>: run a saved import against piped JSON records:
    echo '[{"name":"rec1"}]' | celigo imports invoke <id>
  Without <id>: pipe an import document to preview its output (POST /imports/preview).
Input is required either way \u2014 an empty stdin/file errors rather than silently previewing.`
  ).option(
    "-f, --file <path>",
    "Read the records/import document from a file instead of stdin ('-' also means stdin)."
  ).action(async (id, opts) => {
    const body = await readBody(opts.file);
    if (id) {
      const result2 = await ctx.getClient().post(`v1/imports/${id}/invoke`, body);
      formatOutput(result2, ctx.getFormat());
      return;
    }
    const result = await ctx.getClient().post("v1/imports/preview", body);
    formatOutput(result, ctx.getFormat());
  });
  group.command("replace-connection <id> <newConnectionId>").description("Replace the connection on an import.").action(async (id, newConnectionId) => {
    await replaceConnection(
      ctx.getClient(),
      `v1/imports/${id}/replaceConnection`,
      { _newConnectionId: newConnectionId },
      `Replaced connection on import ${id}.`,
      ctx.getFormat()
    );
  });
  addDebugCommands(
    group,
    ctx,
    "import",
    "imports",
    "/debugUntil",
    "Request/response logs are then captured by any flow, API, or tool that runs this import \u2014 fetch them from the consumer with `flows debug-requests <flowId> <importId>` (or `apis`/`tools debug-requests`)."
  );
}

// src/commands/integrations.ts
import { writeFileSync as writeFileSync7 } from "fs";
import { resolve as resolve3 } from "path";
function registerIntegrations(program2, ctx) {
  const group = crud(
    program2,
    "integrations",
    "integrations",
    ["_id", "name", "mode", "install", "lastModified"],
    ctx,
    "Manage integrations (containers for flows, connections, and resources)."
  );
  addDependenciesCommand(group, ctx, "integrations");
  addAuditCommand(group, ctx, "integrations");
  group.command("clone <id> <environmentId>").description(
    `Clone an integration into a target environment.
Same-env clone: no stdin needed \u2014 the CLI auto-builds a self-map from the source integration's
registered connections (every cloned resource points at the same connection as the source).
Cross-env clone: pipe an explicit map via stdin so source connections get remapped to target-env
connections: {"connectionMap":{"sourceConnId":"targetConnId",...}}`
  ).option(
    "--name <name>",
    'Name for the cloned integration. Defaults to "Clone - <source name>" (matches the UI).'
  ).action(async (id, environmentId, opts) => {
    await runClone(
      ctx,
      "integrations",
      "integration",
      id,
      opts.name,
      (source) => {
        const ids = Array.isArray(source._registeredConnectionIds) ? source._registeredConnectionIds : [];
        const map = {};
        for (const cid of ids) map[cid] = cid;
        return map;
      },
      { _envId: environmentId }
    );
  });
  group.command("flow-groups <id>").description("List flow groups (sections) within an integration.").action(async (id) => {
    const integration = await ctx.getClient().get(`v1/integrations/${id}`);
    const groupings = integration.flowGroupings;
    if (!Array.isArray(groupings) || groupings.length === 0) {
      success("No flow groups in this integration.");
      return;
    }
    formatOutput(groupings, ctx.getFormat(), { columns: ["_id", "name"], isList: true });
  });
  group.command("create-flow-group <id> <name>").description("Create a new flow group in an integration.").action(async (id, name) => {
    const client2 = ctx.getClient();
    const integration = await client2.get(`v1/integrations/${id}`);
    const groupings = integration.flowGroupings ?? [];
    groupings.push({ name });
    const result = await client2.put(`v1/integrations/${id}`, {
      ...integration,
      flowGroupings: groupings
    });
    const updated = result.flowGroupings;
    const created = updated.at(-1);
    formatOutput(created, ctx.getFormat());
  });
  group.command("delete-flow-group <id> <flowGroupingId>").description(
    "Delete a flow group from an integration (flows in it become ungrouped; they are not deleted)."
  ).option("-y, --yes", "Skip confirmation.").action(async (id, flowGroupingId, opts) => {
    const client2 = ctx.getClient();
    const integration = await client2.get(`v1/integrations/${id}`);
    const groupings = integration.flowGroupings ?? [];
    const idx = groupings.findIndex((g) => g._id === flowGroupingId);
    if (idx === -1) {
      throw new Error(`Flow group ${flowGroupingId} not found in integration ${id}.`);
    }
    if (!opts.yes) {
      const ok = await confirm(`Delete flow group ${flowGroupingId} from integration ${id}?`);
      if (!ok) return;
    }
    groupings.splice(idx, 1);
    await client2.put(`v1/integrations/${id}`, { ...integration, flowGroupings: groupings });
    success(`Deleted flow group ${flowGroupingId} from integration ${id}.`);
  });
  group.command("api-groups <id>").description("List API groups (sections) within an integration.").action(async (id) => {
    const integration = await ctx.getClient().get(`v1/integrations/${id}`);
    const groupings = integration.apiGroupings;
    if (!Array.isArray(groupings) || groupings.length === 0) {
      success("No API groups in this integration.");
      return;
    }
    formatOutput(groupings, ctx.getFormat(), { columns: ["_id", "name"], isList: true });
  });
  group.command("create-api-group <id> <name>").description("Create a new API group in an integration.").action(async (id, name) => {
    const client2 = ctx.getClient();
    const integration = await client2.get(`v1/integrations/${id}`);
    const groupings = integration.apiGroupings ?? [];
    groupings.push({ name });
    const result = await client2.put(`v1/integrations/${id}`, {
      ...integration,
      apiGroupings: groupings
    });
    const updated = result.apiGroupings;
    const created = updated.at(-1);
    formatOutput(created, ctx.getFormat());
  });
  group.command("delete-api-group <id> <apiGroupingId>").description(
    "Delete an API group from an integration (APIs in it become ungrouped; they are not deleted)."
  ).option("-y, --yes", "Skip confirmation.").action(async (id, apiGroupingId, opts) => {
    const client2 = ctx.getClient();
    const integration = await client2.get(`v1/integrations/${id}`);
    const groupings = integration.apiGroupings ?? [];
    const idx = groupings.findIndex((g) => g._id === apiGroupingId);
    if (idx === -1) {
      throw new Error(`API group ${apiGroupingId} not found in integration ${id}.`);
    }
    if (!opts.yes) {
      const ok = await confirm(`Delete API group ${apiGroupingId} from integration ${id}?`);
      if (!ok) return;
    }
    groupings.splice(idx, 1);
    await client2.put(`v1/integrations/${id}`, { ...integration, apiGroupings: groupings });
    success(`Deleted API group ${apiGroupingId} from integration ${id}.`);
  });
  group.command("register-connections <id> <connectionIds...>").description(
    "Register one or more connections to an integration via the dedicated API endpoint."
  ).action(async (id, connectionIds) => {
    await ctx.getClient().put(`v1/integrations/${id}/connections/register`, connectionIds);
    success(`Registered ${connectionIds.length} connection(s) to integration ${id}.`);
  });
  group.command("deregister-connections <id> <connectionIds...>").description("Deregister one or more connections from an integration.").option("-y, --yes", "Skip confirmation.").action(async (id, connectionIds, opts) => {
    if (!opts.yes) {
      const ok = await confirm(
        `Deregister ${connectionIds.length} connection(s) from integration ${id}?`
      );
      if (!ok) return;
    }
    const client2 = ctx.getClient();
    for (const connId of connectionIds) {
      await client2.delete(`v1/integrations/${id}/connections/${connId}/register`);
    }
    success(`Deregistered ${connectionIds.length} connection(s) from integration ${id}.`);
  });
  group.command("download <id>").description(
    "Download an integration as a ZIP file.\nCalls the template endpoint, fetches the signed URL, and saves locally.\nDefault filename: <integration-name>.zip (or integration-<id>.zip)."
  ).option("-o, --output <path>", "Output file path (default: <name>.zip in current directory).").action(async (id, opts) => {
    const client2 = ctx.getClient();
    const integration = await client2.get(`v1/integrations/${id}`);
    if (integration._connectorId || integration.mode === "install") {
      throw new Error(
        "Cannot download Integration App installations. Only standalone (non-connector) integrations support template export."
      );
    }
    const result = await client2.get(`v1/integrations/${id}/template`);
    const signedURL = result.signedURL ?? result.signedUrl ?? result.url;
    if (!signedURL) {
      throw new Error(
        `Template endpoint did not return a download URL. Response: ${JSON.stringify(result)}`
      );
    }
    const resp = await fetch(signedURL);
    if (!resp.ok) throw new Error(`Download failed: ${resp.status} ${resp.statusText}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    const name = integration.name ?? `integration-${id}`;
    const safeName = name.replaceAll(/[^a-zA-Z0-9_-]/g, "_");
    const outPath = opts.output ?? resolve3(process.cwd(), `${safeName}.zip`);
    writeFileSync7(outPath, buf);
    success(`Downloaded to ${outPath} (${(buf.length / 1024).toFixed(1)} KB)`);
  });
  group.command("errors <id>").description("Get all open errors across all flows in an integration.").action(async (id) => {
    const data = await ctx.getClient().listBodyPaginated(`v1/integrations/${id}/errors`);
    formatOutput(data, ctx.getFormat(), {
      columns: ["_id", "code", "message", "occurredAt"],
      isList: true
    });
  });
  group.command("revisions <id>").description("List all revisions (snapshots, pulls, pushes) for an integration.").action(async (id) => {
    const data = await ctx.getClient().list(`v1/integrations/${id}/revisions`);
    formatOutput(data, ctx.getFormat(), {
      columns: ["_id", "description", "type", "status", "createdAt"],
      isList: true
    });
  });
  group.command("revision <id> <revisionId>").description("Get details of a specific revision.").action(async (id, revisionId) => {
    const data = await ctx.getClient().get(`v1/integrations/${id}/revisions/${revisionId}`);
    formatOutput(data, ctx.getFormat());
  });
  group.command("create-snapshot <id>").description(
    "Create a snapshot revision of the current integration state.\nUsage: celigo integrations create-snapshot <id> --description 'before deploy'"
  ).requiredOption("--description <text>", "Snapshot description.").action(async (id, opts) => {
    const result = await ctx.getClient().post(`v1/integrations/${id}/revisions/create`, {
      description: opts.description
    });
    formatOutput(result, ctx.getFormat());
  });
  group.command("revision-diff <id> <revisionId>").description("Show the before/after diff for a revision (must be in a pending state).").action(async (id, revisionId) => {
    try {
      const data = await ctx.getClient().get(`v1/integrations/${id}/revisions/${revisionId}/diff`);
      formatOutput(data, ctx.getFormat());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/invalid[_ ]revision[_ ]state|invalid state/i.test(msg)) {
        throw new Error(
          "Diff is only available for revisions in a pending state (e.g. pull or revert). Completed snapshot revisions cannot be diffed."
        );
      }
      throw err;
    }
  });
}

// src/commands/jobs.ts
import { writeFileSync as writeFileSync8 } from "fs";
import { resolve as resolve4 } from "path";
import { Command as Command10 } from "commander";
async function resolveJobErrorScope(client2, id) {
  const job = await client2.get(`v1/jobs/${id}`);
  if (!job._flowId && (job._parentJobId || job._flowJobId)) {
    const parentId = job._parentJobId ?? job._flowJobId;
    const parent = await client2.get(`v1/jobs/${parentId}`);
    job._flowId = parent._flowId;
  }
  if (!job._flowId) {
    throw new Error(
      `Job ${id} has no _flowId \u2014 it may not be a flow run. Try 'jobs get ${id}' to inspect.`
    );
  }
  const flowJobId = job._flowJobId ?? id;
  const windowStart = job.startedAt ?? job.createdAt ?? (/* @__PURE__ */ new Date(0)).toISOString();
  const windowEnd = job.endedAt ?? (/* @__PURE__ */ new Date()).toISOString();
  let targetIds;
  if (job.type === "flow") {
    const family = await client2.get(`v1/jobs/${id}/family`);
    targetIds = (family.children ?? []).filter((c) => (c.numError ?? 0) > 0).map((c) => c._importId ?? c._exportId).filter((x) => typeof x === "string");
    if (targetIds.length === 0) {
      targetIds = (family.children ?? []).map((c) => c._importId ?? c._exportId).filter((x) => typeof x === "string");
    }
  } else {
    const direct = job._importId ?? job._exportId;
    targetIds = direct ? [direct] : [];
  }
  if (targetIds.length === 0) {
    throw new Error(
      `Could not resolve an export/import scope for job ${id}. Try 'jobs get ${id}' to inspect.`
    );
  }
  return { flowId: job._flowId, flowJobId, targetIds, windowStart, windowEnd };
}
async function fetchJobErrors(ctx, id, resolved) {
  const client2 = ctx.getClient();
  const { flowId, flowJobId, targetIds, windowStart, windowEnd } = await resolveJobErrorScope(
    client2,
    id
  );
  const path = resolved ? "resolved" : "errors";
  const tsField = resolved ? "resolvedAt" : "occurredAt";
  const qs = new URLSearchParams({
    _flowJobId: flowJobId,
    [`${tsField}_gte`]: windowStart,
    [`${tsField}_lte`]: windowEnd
  }).toString();
  const pages = await Promise.all(
    targetIds.map((eid) => client2.listBodyPaginated(`v1/flows/${flowId}/${eid}/${path}?${qs}`))
  );
  formatOutput(pages.flat(), ctx.getFormat(), {
    columns: ["errorId", tsField, "code", "message", "source", "_flowJobId"],
    isList: true
  });
}
var PARENT_JOB_TYPES = /* @__PURE__ */ new Set(["flow", "retry"]);
var CHILD_JOB_TYPES = /* @__PURE__ */ new Set(["export", "import"]);
function assertIndexedJobsQuery(opts) {
  const { type } = opts;
  if (!type) {
    throw new Error(
      "jobs list requires --type <flow|retry|export|import>. Prefer `jobs current` for running/active jobs, `jobs get <id>` for a specific run, or `jobs run-stats` for aggregates \u2014 use `jobs list` only when those don't fit."
    );
  }
  const isParentType = PARENT_JOB_TYPES.has(type);
  const isChildType = CHILD_JOB_TYPES.has(type);
  if (!isParentType && !isChildType) {
    throw new Error(
      `Unsupported --type "${type}". jobs list supports: flow, retry, export, import.`
    );
  }
  if (opts.status?.includes(",")) {
    throw new Error(
      "--status takes a single value \u2014 /v1/jobs does not support multi-status filtering."
    );
  }
  const hasRunScope = Boolean(opts.integration || opts.flow);
  const hasChildScope = Boolean(opts.flowJob || opts.parentJob);
  if (isParentType && hasChildScope) {
    throw new Error(
      `--flow-job/--parent-job apply to --type export/import only; scope --type ${type} with --integration or --flow.`
    );
  }
  if (isParentType && !hasRunScope) {
    throw new Error(
      `jobs list --type ${type} requires --integration <id> or --flow <id>. The API does not support unscoped job queries.`
    );
  }
  if (isChildType && hasRunScope) {
    throw new Error(
      `--integration/--flow apply to --type flow/retry only (child step jobs carry no _flowId); scope --type ${type} with --flow-job or --parent-job.`
    );
  }
  if (isChildType && !hasChildScope) {
    throw new Error(
      `jobs list --type ${type} requires --flow-job <id> or --parent-job <id> \u2014 the parent run's job ID. Child jobs are not queryable by export/import ID; find the run with \`jobs list --type flow\`, or use \`jobs get <runId>\` to see its children inline.`
    );
  }
}
async function listFilteredRuns(ctx, path, itemsKey, opts, columns) {
  const body = {};
  if (opts.integration) body._integrationIds = [opts.integration];
  if (opts.flow) body._flowIds = [opts.flow];
  if (opts.status) body.status = opts.status.split(",").map((s) => s.trim());
  const data = await ctx.getClient().listBodyPaginated(path, {
    method: "POST",
    data: body,
    itemsKey
  });
  formatOutput(data, ctx.getFormat(), { columns, isList: true });
}
function registerJobs(program2, ctx) {
  const group = new Command10("jobs").description(
    "Manage flow execution jobs (status, files, diagnostics, cancellation)."
  );
  addKnowledgeHelp(group, "jobs");
  group.command("get <id>").description(
    "Get a job by ID.\nTop-level run jobs (type=flow/retry) auto-expand to the full family with child jobs inlined under `children`; child step jobs (type=export/import) return just the record."
  ).action(async (id) => {
    const client2 = ctx.getClient();
    const job = await client2.get(`v1/jobs/${id}`);
    const isChildStep = job.type === "export" || job.type === "import";
    const data = isChildStep ? job : await client2.get(`v1/jobs/${id}/family`);
    formatOutput(data, ctx.getFormat());
  });
  group.command("current").description("List currently running jobs.").option("--integration <id>", "Filter by integration ID.").option("--flow <id>", "Filter by flow ID.").option("--status <status>", "Filter by status (queued,running,retrying,canceling).").action(async (opts) => {
    await listFilteredRuns(ctx, "v1/jobs/current", "jobs", opts, [
      "_id",
      "_flowId",
      "status",
      "startedAt"
    ]);
  });
  group.command("cancel <id>").description("Cancel a running job.").option("-y, --yes", "Skip confirmation.").action(async (id, opts) => {
    if (!opts.yes) {
      const ok = await confirm(`Cancel job ${id}?`);
      if (!ok) return;
    }
    const result = await ctx.getClient().put(`v1/jobs/${id}/cancel`, {});
    if (result) formatOutput(result, ctx.getFormat());
  });
  group.command("diagnostics <id>").description("Get diagnostics for a job.").action(async (id) => {
    const data = await ctx.getClient().get(`v1/jobs/${id}/diagnostics`);
    formatOutput(data, ctx.getFormat());
  });
  group.command("download-files <id>").description(
    "Download files produced by a job, or list their signed URLs.\nWith no flags, prints the signed download URLs (it does not fetch bytes).\n--file-id narrows to a specific file (e.g. an EDI transaction's s3Key); -o fetches that file's bytes and saves them to a path."
  ).option(
    "--file-id <fileId>",
    "Specific file ID to download (e.g. s3Key from edi-transactions)."
  ).option(
    "-o, --output <path>",
    "Fetch the file's bytes and save to this path instead of stdout."
  ).action(async (id, opts) => {
    const body = opts.fileId ? { fileIds: [opts.fileId] } : {};
    const result = await ctx.getClient().post(`v1/jobs/${id}/files/signedURL`, body);
    const urls = result?.signedURLs ?? (result?.signedURL ? [result.signedURL] : []);
    if (urls.length === 0) {
      console.error("No files available for this job.");
      process.exitCode = 1;
      return;
    }
    if (opts.output) {
      const resp = await fetch(urls[0]);
      if (!resp.ok) throw new Error(`Download failed: ${resp.status} ${resp.statusText}`);
      const content = await resp.text();
      writeFileSync8(resolve4(opts.output), content, "utf-8");
      success(`Downloaded to ${opts.output} (${content.length} bytes).`);
    } else if (urls.length === 1 && opts.fileId) {
      const resp = await fetch(urls[0]);
      if (!resp.ok) throw new Error(`Download failed: ${resp.status} ${resp.statusText}`);
      process.stdout.write(await resp.text());
    } else {
      formatOutput({ signedURLs: urls }, ctx.getFormat());
    }
  });
  group.command("purge-files <id>").description("Purge stored files for a job.").option("-y, --yes", "Skip confirmation.").action(async (id, opts) => {
    if (!opts.yes) {
      const ok = await confirm(`Purge all files for job ${id}?`);
      if (!ok) return;
    }
    await ctx.getClient().delete(`v1/jobs/${id}/files`);
    success(`Files purged for job ${id}.`);
  });
  group.command("errors <id>").description(
    "Get open errors for a job.\nResolves the job's flow + export/import steps from its job family, then queries the\nflow-scoped error endpoint filtered by the flow-job id. Use `jobs resolved-errors` for resolved ones."
  ).action(async (id) => {
    await fetchJobErrors(ctx, id, false);
  });
  group.command("resolved-errors <id>").description(
    "Get resolved errors for a job.\nSame flow + step resolution as `jobs errors`, but queries the resolved-error endpoint."
  ).action(async (id) => {
    await fetchJobErrors(ctx, id, true);
  });
  group.command("run-stats").description("Get flow run statistics.").option("--integration <id>", "Filter by integration ID.").option("--flow <id>", "Filter by flow ID.").option("--status <status>", "Filter by status (completed,failed).").action(async (opts) => {
    await listFilteredRuns(ctx, "v1/flows/runs/stats", "stats", opts);
  });
  group.command("list").description(
    "Last resort: list jobs via the generic GET /v1/jobs with strict, index-backed filters.\nPrefer `jobs current` (running/active jobs), `jobs get <id>` (one run with children\ninlined), or `jobs run-stats` (aggregate history) when they fit.\nOnly two filter shapes are supported: --type flow|retry scoped by --integration or\n--flow, and --type export|import scoped by --flow-job or --parent-job."
  ).option("--type <type>", "REQUIRED. Job type to list: flow, retry, export, or import.").option("--integration <id>", "Scope --type flow/retry by _integrationId.").option("--flow <id>", "Scope --type flow/retry by _flowId.").option(
    "--flow-job <id>",
    "Scope --type export/import by _flowJobId (the parent run's job ID)."
  ).option("--parent-job <id>", "Scope --type export/import by _parentJobId.").option("--status <status>", "Filter by ONE status (e.g. completed, failed, queued, canceled).").option("--created-gte <iso>", "Filter by createdAt >= ISO-8601 timestamp.").option("--created-lte <iso>", "Filter by createdAt <= ISO-8601 timestamp.").option("--started-gte <iso>", "Filter by startedAt >= ISO-8601 timestamp.").option("--started-lte <iso>", "Filter by startedAt <= ISO-8601 timestamp.").option("--limit <n>", "Stop after collecting this many rows (client-side early-stop).").action(async (opts) => {
    assertIndexedJobsQuery(opts);
    const qs = new URLSearchParams();
    const paramMap = {
      type: "type",
      integration: "_integrationId",
      flow: "_flowId",
      flowJob: "_flowJobId",
      parentJob: "_parentJobId",
      status: "status",
      createdGte: "createdAt_gte",
      createdLte: "createdAt_lte",
      startedGte: "startedAt_gte",
      startedLte: "startedAt_lte"
    };
    for (const [cliKey, apiKey] of Object.entries(paramMap)) {
      const value = opts[cliKey];
      if (value) qs.set(apiKey, value);
    }
    const result = await ctx.getClient().listByCreatedCursor("v1/jobs", {
      params: qs,
      limit: parsePositiveInt(opts.limit)
    });
    reportCursorList(
      ctx,
      result,
      ["_id", "type", "status", "_flowId", "numSuccess", "numError", "createdAt"],
      "Narrow with --created-gte/--created-lte or cap with --limit."
    );
  });
  program2.addCommand(group);
}

// src/commands/lookup-caches.ts
function registerLookupCaches(program2, ctx) {
  const group = crud(
    program2,
    "lookup-caches",
    "lookupcaches",
    ["_id", "name", "size", "lastModified"],
    ctx,
    "Manage lookup caches (in-memory key-value stores for enrichment and deduplication)."
  );
  addDependenciesCommand(group, ctx, "lookupcaches");
  addAuditCommand(group, ctx, "lookupcaches");
  group.command("put-data <id>").description(
    'Upsert data into a lookup cache.\nExpects JSON on stdin or --file: { "data": [{ "key": "k", "value": "v" }, ...] }\nAuto-batches by count (1000) and size (5 MB).'
  ).option(
    "-f, --file <path>",
    "Read the JSON body from a file instead of stdin ('-' also means stdin)."
  ).action(async (id, opts) => {
    const body = await readBody(opts.file);
    if (!Array.isArray(body.data)) {
      throw new TypeError(
        'Expected "data" to be an array of {key, value} objects.\nExample: {"data":[{"key":"k1","value":"v1"},{"key":"k2","value":"v2"}]}'
      );
    }
    const entries = body.data;
    if (entries.length === 0) throw new Error("No data entries provided.");
    const MAX_COUNT = 1e3;
    const MAX_BYTES = 5 * 1024 * 1024;
    const batches = [];
    let cur = [];
    let curBytes = 0;
    for (const entry of entries) {
      const entryBytes = Buffer.byteLength(JSON.stringify(entry), "utf-8");
      if (cur.length > 0 && (cur.length >= MAX_COUNT || curBytes + entryBytes > MAX_BYTES)) {
        batches.push(cur);
        cur = [];
        curBytes = 0;
      }
      cur.push(entry);
      curBytes += entryBytes;
    }
    if (cur.length > 0) batches.push(cur);
    const allResults = [];
    for (const batch of batches) {
      const result = await ctx.getClient().post(`v1/lookupcaches/${id}/data`, { data: batch });
      if (result.data) allResults.push(...result.data);
    }
    formatOutput(
      { success: true, data: allResults, batches: batches.length, total: entries.length },
      ctx.getFormat()
    );
  });
  group.command("get-data <id>").description(
    'Get data from a lookup cache.\nWithout input: returns first page of all data (max 1000 keys).\nWith keys: { "keys": ["k1", "k2"] } \u2014 returns matching entries.\nWith prefix: { "startsWith": "abc" } \u2014 returns keys with that prefix.\nProvide the body via stdin or --file.'
  ).option(
    "-f, --file <path>",
    "Read the JSON body from a file instead of stdin ('-' also means stdin)."
  ).action(async (id, opts) => {
    let body;
    if (opts.file) {
      body = await readBody(opts.file);
    } else {
      try {
        body = await readStdin();
      } catch {
        body = void 0;
      }
    }
    const result = body ? await ctx.getClient().post(`v1/lookupcaches/${id}/getData`, body) : await ctx.getClient().post(`v1/lookupcaches/${id}/getData`);
    formatOutput(result, ctx.getFormat());
  });
  group.command("delete-data <id>").description(
    'Delete specific keys from a lookup cache.\nExpects JSON on stdin or --file: { "keys": ["k1", "k2", ...] }'
  ).option("-y, --yes", "Skip confirmation.").option(
    "-f, --file <path>",
    "Read the JSON body from a file instead of stdin ('-' also means stdin)."
  ).action(async (id, opts) => {
    const body = await readBody(opts.file);
    if (!opts.yes) {
      const count = Array.isArray(body.keys) ? body.keys.length : 0;
      const ok = await confirm(`Delete ${count} key(s) from lookup cache ${id}?`);
      if (!ok) return;
    }
    const result = await ctx.getClient().delete(`v1/lookupcaches/${id}/data`, body);
    formatOutput(result, ctx.getFormat());
  });
  group.command("purge-data <id>").description("Purge ALL data from a lookup cache.").option("-y, --yes", "Skip confirmation.").action(async (id, opts) => {
    if (!opts.yes) {
      const ok = await confirm(`Purge all data from lookup cache ${id}?`);
      if (!ok) return;
    }
    await ctx.getClient().delete(`v1/lookupcaches/${id}/data/purge`);
    success(`Purged all data from lookup cache ${id}.`);
  });
}

// src/commands/mcp-oauth-providers.ts
function registerMcpOauthProviders(program2, ctx) {
  const group = makeResourceGroup("mcp-oauth-providers", "mcpoauthproviders", {
    listColumns: ["_id", "name", "lastModified"],
    description: "Manage MCP OAuth providers (OAuth provider registrations for MCP servers).",
    ...ctx
  });
  program2.addCommand(group);
}

// src/commands/mcp-servers.ts
function registerMcpServers(program2, ctx) {
  const mcpServersGroup = crud(
    program2,
    "mcp-servers",
    "mcpServers",
    ["_id", "name", "relativeURI", "disabled", "lastModified"],
    ctx,
    "Manage MCP servers that expose tools and APIs as MCP endpoints."
  );
  addDependenciesCommand(mcpServersGroup, ctx, "mcpServers");
  addAuditCommand(mcpServersGroup, ctx, "mcpServers");
}

// src/commands/metadata.ts
import chalk8 from "chalk";
import { Command as Command11 } from "commander";
var METADATA_TYPES = ["netsuite", "salesforce", "rdbms"];
async function detectConnType(client2, connectionId) {
  const conn = await client2.get(`v1/connections/${connectionId}`);
  const t = conn.type ?? "";
  if (METADATA_TYPES.includes(t)) return t;
  throw new Error(
    `Connection ${connectionId} has type "${t}" \u2014 metadata is only supported for ${METADATA_TYPES.join(", ")} connections.`
  );
}
function registerMetadata(program2, ctx) {
  const group = new Command11("metadata").description(
    "Query metadata via a live connection. Auto-detects adaptor type (NetSuite, Salesforce, RDBMS)."
  );
  addKnowledgeHelp(group, "metadata");
  group.command("types <connectionId>").description(
    "List entity types on a connection.\nNetSuite: record types + saved searches. Salesforce: sObject types. RDBMS: tables."
  ).option("--refresh", "Bypass cache and fetch fresh metadata.").action(async (connectionId, opts) => {
    const client2 = ctx.getClient();
    const connType = await detectConnType(client2, connectionId);
    const qs = opts.refresh ? "?refreshCache=true" : "";
    if (connType === "netsuite") {
      const base = `v1/netsuite/metadata/suitescript/connections/${connectionId}`;
      const [recordTypes, savedSearches] = await Promise.all([
        client2.get(`${base}/recordTypes${qs}`),
        client2.get(`${base}/savedSearches${qs}`)
      ]);
      const combined = [
        ...Array.isArray(recordTypes) ? recordTypes.map((r) => ({
          ...r,
          _metaType: "recordType"
        })) : [],
        ...Array.isArray(savedSearches) ? savedSearches.map((s) => ({
          ...s,
          _metaType: "savedSearch"
        })) : []
      ];
      formatOutput(combined, ctx.getFormat(), {
        columns: ["id", "name", "_metaType"],
        isList: true
      });
    } else if (connType === "salesforce") {
      const data = await client2.get(
        `v1/salesforce/metadata/connections/${connectionId}/sObjectTypes${qs}`
      );
      formatOutput(data, ctx.getFormat(), {
        columns: [
          "name",
          "label",
          "labelPlural",
          "keyPrefix",
          "queryable",
          "createable",
          "updateable",
          "deletable",
          "searchable",
          "custom"
        ],
        isList: true
      });
    } else {
      const data = await client2.put(`v1/connections/${connectionId}/metadata`, {
        rdbms: { type: "tables", tables: "" },
        refreshCache: !!opts.refresh
      });
      formatOutput(data, ctx.getFormat(), { isList: Array.isArray(data) });
    }
  });
  group.command("fields <connectionId> <entityType>").description(
    "List fields for an entity type (record type for NetSuite, sObject for Salesforce, table columns for RDBMS).\nSalesforce returns fields and record types together."
  ).option("--refresh", "Bypass cache and fetch fresh metadata.").action(async (connectionId, entityType, opts) => {
    const client2 = ctx.getClient();
    const connType = await detectConnType(client2, connectionId);
    const qs = opts.refresh ? "?refreshCache=true" : "";
    if (connType === "netsuite") {
      const data = await client2.get(
        `v1/netsuite/metadata/suitescript/connections/${connectionId}/recordTypes/${entityType}${qs}`
      );
      formatOutput(data, ctx.getFormat(), {
        columns: ["id", "name", "type", "group"],
        isList: true
      });
    } else if (connType === "salesforce") {
      const data = await client2.get(
        `v1/salesforce/metadata/connections/${connectionId}/sObjectTypes/${entityType}${qs}`
      );
      formatOutput(data, ctx.getFormat());
    } else {
      const data = await client2.put(`v1/connections/${connectionId}/metadata`, {
        rdbms: { type: "columns", tables: entityType },
        refreshCache: !!opts.refresh
      });
      let results = null;
      if (Array.isArray(data)) {
        results = data;
      } else if (Array.isArray(data?.results)) {
        results = data.results;
      }
      if (results !== null && results.length === 0) {
        console.error(
          chalk8.yellow(
            `No columns returned for '${entityType}'. Check the table name is fully qualified (database.schema.table) and the connection user has column-metadata permissions (e.g. BigQuery: bigquery.tables.get on the dataset).`
          )
        );
      }
      formatOutput(data, ctx.getFormat(), { isList: Array.isArray(data) });
    }
  });
  program2.addCommand(group);
}

// src/commands/notifications.ts
import { Command as Command12 } from "commander";
var LIST_COLUMNS2 = [
  "_id",
  "type",
  "_integrationId",
  "_flowId",
  "_connectionId",
  "subscribedByUser.email",
  "lastModified"
];
function registerNotifications(program2, ctx) {
  const group = new Command12("notifications").description(
    "Manage notification subscriptions (integrations, flows, connections)."
  );
  addKnowledgeHelp(group, "notifications");
  group.command("list").description("List all notification subscriptions.").option(FIELDS_OPTION_FLAGS, FIELDS_OPTION_DESCRIPTION).action(async (cmdOpts) => {
    const fields = resolveListFields({
      fields: cmdOpts.fields,
      jqActive: isJqActive(),
      setting: ctx.getListFields?.(),
      defaults: defaultProjection(LIST_COLUMNS2)
    });
    const path = withListProjection("v1/notifications?users=all", fields);
    const data = await ctx.getClient().list(path);
    formatOutput(projectRows(data, fields), ctx.getFormat(), {
      columns: LIST_COLUMNS2,
      isList: true
    });
  });
  group.command("subscribe").description(
    "Subscribe to notifications for one or more resources.\n  celigo notifications subscribe --user jane@example.com --flow <id>\n  celigo notifications subscribe --user jane@example.com --connection <id1> --connection <id2>"
  ).requiredOption("--user <email>", "Email of the user to subscribe.").option("--flow <ids...>", "Flow ID(s) to subscribe to.").option("--connection <ids...>", "Connection ID(s) to subscribe to.").option("--integration <ids...>", "Integration ID(s) to subscribe to.").action(
    async (opts) => {
      const items = buildNotificationItems(opts, true);
      if (items.length === 0)
        throw new Error("Provide at least one --flow, --connection, or --integration.");
      let lastResult;
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        lastResult = await ctx.getClient().put("v1/notifications", items.slice(i, i + BATCH_SIZE));
      }
      formatOutput(lastResult, ctx.getFormat());
    }
  );
  group.command("unsubscribe").description(
    "Unsubscribe from notifications for one or more resources.\n  celigo notifications unsubscribe --user jane@example.com --flow <id>\n  celigo notifications unsubscribe --user jane@example.com --connection <id1> --connection <id2>"
  ).requiredOption("--user <email>", "Email of the user to unsubscribe.").option("--flow <ids...>", "Flow ID(s) to unsubscribe from.").option("--connection <ids...>", "Connection ID(s) to unsubscribe from.").option("--integration <ids...>", "Integration ID(s) to unsubscribe from.").action(
    async (opts) => {
      const items = buildNotificationItems(opts, false);
      if (items.length === 0)
        throw new Error("Provide at least one --flow, --connection, or --integration.");
      let lastResult;
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        lastResult = await ctx.getClient().put("v1/notifications", items.slice(i, i + BATCH_SIZE));
      }
      formatOutput(lastResult, ctx.getFormat());
    }
  );
  program2.addCommand(group);
}
function buildNotificationItems(opts, subscribed) {
  const items = [];
  const email = opts.user;
  for (const id of opts.flow ?? [])
    items.push({ _flowId: id, subscribed, subscribedByUserEmail: email });
  for (const id of opts.connection ?? [])
    items.push({ _connectionId: id, subscribed, subscribedByUserEmail: email });
  for (const id of opts.integration ?? [])
    items.push({ _integrationId: id, subscribed, subscribedByUserEmail: email });
  return items;
}

// src/commands/on-premise-agents.ts
function registerOnPremiseAgents(program2, ctx) {
  const group = crud(
    program2,
    "on-premise-agents",
    "agents",
    ["_id", "name", "offline", "lastModified"],
    ctx,
    "Manage on-premise agents (OPA)."
  );
  addDependenciesCommand(group, ctx, "agents");
  addAuditCommand(group, ctx, "agents");
  group.command("token <id>").description("Show the access token for an on-premise agent.").action(async (id) => {
    const result = await ctx.getClient().get(`v1/agents/${id}/display-token`);
    formatOutput(result, ctx.getFormat());
  });
  group.command("rotate-token <id>").description(
    "Rotate (regenerate) the access token for an on-premise agent.\nReturns the new token; the old one is invalidated immediately, so any running agent process must be reconfigured with the new value before it can reconnect."
  ).action(async (id) => {
    const result = await ctx.getClient().put(`v1/agents/${id}/change-token`, {});
    formatOutput(result, ctx.getFormat());
  });
  group.command("installer-url <id>").description("Get the signed installer download URL for an on-premise agent.").requiredOption("--os <os>", "Target OS for the installer (e.g. windows, linux, macOS).").action(async (id, opts) => {
    const qs = new URLSearchParams({ os: opts.os }).toString();
    const data = await ctx.getClient().get(`v1/agents/${id}/installer/signedURL?${qs}`);
    formatOutput(data, ctx.getFormat());
  });
}

// src/commands/processors.ts
import { readFileSync as readFileSync8 } from "fs";
import { Argument, Command as Command13 } from "commander";
var KNOWN_PROCESSORS = [
  "csvParser",
  "csvDataGenerator",
  "structuredFileParser",
  "structuredFileGenerator",
  "xmlParser"
];
var PARSE_PROCESSORS = {
  csv: "csvParser",
  edi: "structuredFileParser",
  xml: "xmlParser"
};
var GENERATE_PROCESSORS = {
  csv: "csvDataGenerator",
  edi: "structuredFileGenerator"
};
var NO_RAW_INPUT_MESSAGE = "No input received. Pipe the raw file via stdin, or pass a file path argument.";
async function readRawData(file) {
  if (file && file !== "-") {
    const path = expandHome(file);
    try {
      return readFileSync8(path, "utf-8");
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Cannot read file '${path}': ${reason}`);
    }
  }
  if (process.stdin.isTTY) {
    throw new Error(NO_RAW_INPUT_MESSAGE);
  }
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw.trim()) {
    throw new Error(NO_RAW_INPUT_MESSAGE);
  }
  return raw;
}
async function readRulesFile(path, flag) {
  if (path === "-") {
    throw new Error(`${flag} must be a file path \u2014 stdin is reserved for the data input.`);
  }
  return readBody(path);
}
async function ediProfileOptions(ctx, id) {
  if (!id) return {};
  const profile = await ctx.getClient().get(`v1/ediprofiles/${id}`);
  return { options: { ediProfile: profile } };
}
var OPTION_FORMATS = {
  fileDefinitionId: { formats: ["edi"], flag: "--file-definition-id" },
  fileDefinition: { formats: ["edi"], flag: "--file-definition" },
  ediProfileId: { formats: ["edi"], flag: "--edi-profile-id" },
  resourcePath: { formats: ["edi", "xml"], flag: "--resource-path" },
  rules: { formats: ["csv", "xml"], flag: "--rules" },
  columnDelimiter: { formats: ["csv"], flag: "--column-delimiter" },
  rowDelimiter: { formats: ["csv"], flag: "--row-delimiter" },
  hasHeaderRow: { formats: ["csv"], flag: "--has-header-row" },
  trimSpaces: { formats: ["csv"], flag: "--trim-spaces" },
  rowsToSkip: { formats: ["csv"], flag: "--rows-to-skip" },
  includeEmptyValues: { formats: ["csv"], flag: "--include-empty-values" },
  includeHeader: { formats: ["csv"], flag: "--include-header" },
  wrapWithQuotes: { formats: ["csv"], flag: "--wrap-with-quotes" }
};
function assertOptionsMatchFormat(format, opts) {
  const misapplied = Object.entries(opts).filter(([key, value]) => value !== void 0 && OPTION_FORMATS[key]).filter(([key]) => !OPTION_FORMATS[key].formats.includes(format)).map(([key]) => OPTION_FORMATS[key].flag);
  if (misapplied.length > 0) {
    throw new Error(`Option(s) not applicable to format '${format}': ${misapplied.join(", ")}.`);
  }
}
async function ediParseRules(opts) {
  if (Boolean(opts.fileDefinitionId) === Boolean(opts.fileDefinition)) {
    throw new Error(
      "Format 'edi' requires exactly one of --file-definition-id or --file-definition."
    );
  }
  const rules = opts.fileDefinitionId ? { _fileDefinitionId: opts.fileDefinitionId } : {
    fileDefinition: await readRulesFile(opts.fileDefinition, "--file-definition")
  };
  if (opts.resourcePath) rules.resourcePath = opts.resourcePath;
  return rules;
}
async function parseRulesFor(format, opts) {
  if (opts.rules) {
    return await readRulesFile(opts.rules, "--rules");
  }
  if (format === "xml") {
    if (!opts.resourcePath) {
      throw new Error(
        "Format 'xml' requires --resource-path (XPath to the repeating element, e.g. /root/item) or --rules."
      );
    }
    return { resourcePath: opts.resourcePath };
  }
  const rules = {};
  if (opts.columnDelimiter !== void 0) rules.columnDelimiter = opts.columnDelimiter;
  if (opts.rowDelimiter !== void 0) rules.rowDelimiter = opts.rowDelimiter;
  if (opts.hasHeaderRow) rules.hasHeaderRow = true;
  if (opts.trimSpaces) rules.trimSpaces = true;
  if (opts.rowsToSkip !== void 0) rules.rowsToSkip = Number.parseInt(opts.rowsToSkip, 10);
  return rules;
}
async function generateRulesFor(format, opts) {
  if (format === "edi") {
    if (!opts.fileDefinition) {
      throw new Error("Format 'edi' requires --file-definition (the generation rules JSON).");
    }
    return await readRulesFile(opts.fileDefinition, "--file-definition");
  }
  if (opts.rules) {
    return await readRulesFile(opts.rules, "--rules");
  }
  const rules = {};
  if (opts.columnDelimiter !== void 0) rules.columnDelimiter = opts.columnDelimiter;
  if (opts.rowDelimiter !== void 0) rules.rowDelimiter = opts.rowDelimiter;
  if (opts.includeHeader) rules.includeHeader = true;
  if (opts.wrapWithQuotes) rules.wrapWithQuotes = true;
  return rules;
}
function registerProcessors(program2, ctx) {
  const group = new Command13("processors").summary("Stateless parsers & generators: test parsing rules without creating resources.").description(
    "Stateless parsers & generators (POST /v1/processors/*): convert raw CSV/XML/EDI data\nto JSON and back using parsing rules or file definitions. One-shot transformation\ncalls \u2014 nothing is created or modified, so they are allowed in read mode.\nUse `parse edi` as a checkpoint to validate an EDI file against a spec before building a flow."
  );
  addKnowledgeHelp(group, "processors");
  group.command("list").description(
    "List the processor catalog (parser/generator types with input/output media types)."
  ).action(async () => {
    const catalog = await ctx.getClient().get("v1/processors");
    const rows = Object.entries(catalog ?? {}).map(([name, descriptor]) => ({ name, ...descriptor })).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    formatOutput(rows, ctx.getFormat(), {
      columns: ["name", "label", "dataMediaType", "resultMediaType"],
      isList: true
    });
  });
  group.command("invoke <name>").description(
    `Invoke any processor by name with a full JSON request body (stdin, or --file).
Known names: ${KNOWN_PROCESSORS.join(", ")} \u2014 see 'processors list' for the catalog.
Example body for csvParser: {"data": "a,b\\n1,2", "rules": {"columnDelimiter": ",", "hasHeaderRow": true}}`
  ).option(
    "-f, --file <path>",
    "Read the JSON body from a file instead of stdin ('-' also means stdin)."
  ).action(async (name, opts) => {
    const body = await readBody(opts.file);
    const result = await ctx.getClient().post(`v1/processors/${name}`, body);
    formatOutput(result, ctx.getFormat());
  });
  group.command("parse").addArgument(
    new Argument("<format>", "Input format to parse into JSON records.").choices([
      "csv",
      "edi",
      "xml"
    ])
  ).argument("[dataFile]", "Raw input file ('-' or omitted reads stdin).").description(
    "Parse raw data into JSON records. Formats:\n  csv \u2014 flags like --column-delimiter/--has-header-row, or full --rules JSON.\n  xml \u2014 --resource-path (XPath, e.g. /root/item), or full --rules JSON.\n  edi \u2014 X12/EDIFACT/structured files via a file definition (--file-definition-id\n        or inline --file-definition); validation failures come back in\n        'recordLevelErrors', making this a pre-flow validation checkpoint."
  ).option("--rules <path>", "Full parsing-rules JSON file (csv, xml).").option("--file-definition-id <id>", "Parse using an existing file definition (edi).").option("--file-definition <path>", "Parse using an inline file definition JSON file (edi).").option(
    "--resource-path <path>",
    "XPath to the repeating element (xml), or dot path selecting the segment to return (edi)."
  ).option(
    "--edi-profile-id <id>",
    "Fetch this edi-profiles resource and send it as ISA/GS envelope context (edi)."
  ).option("--column-delimiter <char>", "Column delimiter (csv).").option("--row-delimiter <char>", "Row delimiter (csv).").option("--has-header-row", "Treat the first row as column headers (csv).").option("--trim-spaces", "Trim leading/trailing spaces from values (csv).").option("--rows-to-skip <n>", "Rows to skip before parsing (csv).").option("--include-empty-values", "Return empty values as null instead of omitting (csv).").action(async (format, dataFile, opts) => {
    assertOptionsMatchFormat(format, opts);
    const rules = format === "edi" ? await ediParseRules(opts) : await parseRulesFor(format, opts);
    const data = await readRawData(dataFile);
    const body = { data, rules };
    if (format === "edi") Object.assign(body, await ediProfileOptions(ctx, opts.ediProfileId));
    if (format === "csv" && opts.includeEmptyValues) {
      body.options = { includeEmptyValues: true };
    }
    const result = await ctx.getClient().post(`v1/processors/${PARSE_PROCESSORS[format]}`, body);
    formatOutput(result, ctx.getFormat());
  });
  group.command("generate").addArgument(
    new Argument("<format>", "Output format to generate from JSON records.").choices([
      "csv",
      "edi"
    ])
  ).argument("[recordsFile]", "JSON array of records ('-' or omitted reads stdin).").description(
    "Generate formatted output from a JSON array of records (one element per document).\n  csv \u2014 flags like --include-header/--column-delimiter, or full --rules JSON.\n  edi \u2014 requires --file-definition (generation rules JSON, sent directly as\n        'rules'; the generator takes no fileDefinition wrapper or ID reference).\nTip: --jq .data prints the generated text raw, e.g. --jq .data > out.edi"
  ).option("--rules <path>", "Full generation-rules JSON file (csv).").option("--file-definition <path>", "Generation rules JSON file \u2014 the file definition (edi).").option(
    "--edi-profile-id <id>",
    "Fetch this edi-profiles resource and send it as ISA/GS envelope context (edi)."
  ).option("--column-delimiter <char>", "Column delimiter (csv).").option("--row-delimiter <char>", "Row delimiter (csv).").option("--include-header", "Include a header row of column names (csv).").option("--wrap-with-quotes", "Wrap every value in double quotes (csv).").action(async (format, recordsFile, opts) => {
    assertOptionsMatchFormat(format, opts);
    const rules = await generateRulesFor(format, opts);
    const records = await readBody(recordsFile);
    if (!Array.isArray(records)) {
      throw new TypeError(
        "The records input must be a JSON array \u2014 each element is one document to generate."
      );
    }
    const body = { data: records, rules };
    if (format === "edi") Object.assign(body, await ediProfileOptions(ctx, opts.ediProfileId));
    const result = await ctx.getClient().post(`v1/processors/${GENERATE_PROCESSORS[format]}`, body);
    formatOutput(result, ctx.getFormat());
  });
  program2.addCommand(group);
}

// src/commands/recycle-bin.ts
import { Command as Command14 } from "commander";
var STORAGE_MODEL = "StorageItem";
var resourceTypeFor = (model) => `${model.toLowerCase()}s`;
async function findBinEntry(ctx, id) {
  const items = await ctx.getClient().list("v1/recycleBinTTL");
  const entry = items.find((e) => e?.doc?._id === id);
  if (!entry) {
    throw new Error(
      `No recycle-bin entry found for id ${id} \u2014 it may not be deleted, or its retention window expired.`
    );
  }
  return entry;
}
function registerRecycleBin(program2, ctx) {
  const group = new Command14("recycle-bin").description(
    "Browse, restore, and purge soft-deleted resources (recycle bin TTL)."
  );
  group.command("list").description("List recycle bin entries (all, or just one resource type with --type).").option("--type <resourceType>", "Filter to a single resource type (e.g. flows, exports).").action(async (opts) => {
    const raw = opts.type ? await ctx.getClient().list(`v1/recycleBinTTL/${opts.type}`) : await ctx.getClient().list("v1/recycleBinTTL");
    if (ctx.getFormat() === "json") {
      printJson(raw);
      return;
    }
    const rows = raw.map((e) => ({
      model: e?.model,
      _id: e?.doc?._id,
      name: e?.doc?.name
    }));
    formatOutput(rows, ctx.getFormat(), { columns: ["model", "_id", "name"], isList: true });
  });
  group.command("get <id>").description("Show a single soft-deleted entry by ID.").action(async (id) => {
    const entry = await findBinEntry(ctx, id);
    formatOutput(entry.doc, ctx.getFormat());
  });
  group.command("restore <id>").description("Restore a soft-deleted resource by ID (type auto-detected from the bin).").option("--cascade", "Also restore dependents (generic resources only).").option("-f, --file <path>", "JSON body file (or pipe via stdin) \u2014 generic resources only.").action(async (id, opts) => {
    const { model } = await findBinEntry(ctx, id);
    if (model === STORAGE_MODEL) {
      const data2 = await ctx.getClient().post(`v1/storage/items/${id}/restore`);
      formatOutput(data2, ctx.getFormat());
      return;
    }
    const rt = resourceTypeFor(model);
    const body = opts.file ? await readBody(opts.file) : void 0;
    const data = opts.cascade ? await ctx.getClient().post(`v1/recycleBinTTL/${rt}/${id}/doCascadeRestore`, body) : await ctx.getClient().post(`v1/recycleBinTTL/${rt}/${id}`, body);
    formatOutput(data, ctx.getFormat());
  });
  group.command("purge <id>").description("Permanently delete a soft-deleted resource by ID. Irreversible.").option("-y, --yes", "Skip confirmation.").action(async (id, opts) => {
    const { model } = await findBinEntry(ctx, id);
    if (model === STORAGE_MODEL) {
      await removeWithConfirm(
        ctx,
        `v1/storage/items/${id}/purge`,
        opts,
        `Permanently purge ${id}? This cannot be undone.`,
        "Purge complete."
      );
      return;
    }
    const rt = resourceTypeFor(model);
    await removeWithConfirm(
      ctx,
      `v1/recycleBinTTL/${rt}/${id}`,
      opts,
      `Permanently purge ${id}? This cannot be undone.`,
      "Purge complete."
    );
  });
  program2.addCommand(group);
}

// src/commands/scripts.ts
function normalizeScriptLogs(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.logs)) return raw.logs;
  return [];
}
function registerScripts(program2, ctx) {
  const group = crud(
    program2,
    "scripts",
    "scripts",
    ["_id", "name", "lastModified"],
    ctx,
    "Manage scripts (JavaScript hooks: preSavePage, preMap, postMap, postSubmit, etc.)."
  );
  addDependenciesCommand(group, ctx, "scripts");
  addDebugCommands(
    group,
    ctx,
    "script",
    "scripts",
    "/debugUntil",
    "View the captured console output with `scripts debug-logs <id>`."
  );
  group.command("debug-logs <id>").description(
    "Fetch a script's debug logs \u2014 console output captured while debug is enabled (set debugUntil via `scripts enable-debug`).\nFilter by --level, a time window (--since, or --time-gte/--time-lte), or --flow-id.\nGotcha: preSavePage is an export-only hook \u2014 attaching it to an import silently produces no logs."
  ).option("--limit <n>", "Max entries (1-1000).", "100").option("--offset <n>", "Entries to skip.").option("--level <level>", "Filter by level (INFO, WARN, ERROR).").option("--since <minutes>", "Only logs from the last N minutes.").option("--flow-id <id>", "Filter logs by flow ID.").option("--time-gte <iso>", "Filter by time >= ISO-8601 timestamp.").option("--time-lte <iso>", "Filter by time <= ISO-8601 timestamp.").action(async (id, opts) => {
    const params = new URLSearchParams();
    if (opts.limit) params.set("limit", opts.limit);
    if (opts.offset && opts.offset !== "0") params.set("offset", opts.offset);
    if (opts.level) params.set("level", opts.level);
    if (opts.since) {
      const minutes = Number.parseInt(opts.since, 10) || 60;
      params.set("time_gt", String(Date.now() - minutes * 6e4));
    }
    if (opts.flowId) params.set("_flowId", opts.flowId);
    if (opts.timeGte) params.set("startDate", opts.timeGte);
    if (opts.timeLte) params.set("endDate", opts.timeLte);
    const raw = await ctx.getClient().get(buildUrl(`v1/scripts/${id}/logs`, params));
    const logs = normalizeScriptLogs(raw);
    formatOutput(logs, ctx.getFormat(), {
      columns: ["time", "logLevel", "functionType", "_resourceId", "message"],
      isList: true
    });
  });
  group.command("audit <id>").description("Get a script's audit trail.").action(async (id) => {
    const data = await ctx.getClient().get(`v1/scripts/${id}/audit`);
    formatOutput(data, ctx.getFormat(), { isList: true });
  });
  group.command("delete-debug-logs <id>").description("Delete a script's debug logs (the entries shown by `scripts debug-logs`).").option("-y, --yes", "Skip confirmation.").action(
    (id, opts) => removeWithConfirm(
      ctx,
      `v1/scripts/${id}/logs`,
      opts,
      `Delete debug logs for script ${id}?`,
      "Script debug logs deleted."
    )
  );
}

// src/commands/stacks.ts
function registerStacks(program2, ctx) {
  const group = makeResourceGroup("stacks", "stacks", {
    listColumns: ["_id", "name", "lastModified"],
    description: "Manage stacks (server/Lambda runtimes for custom code).",
    exclude: ["list"],
    helpText: HELP.stacks,
    ...ctx
  });
  program2.addCommand(group);
  addDependenciesCommand(group, ctx, "stacks");
  group.command("list").description("List stacks \u2014 both your own and any shared with you (shared=true).").option(FIELDS_OPTION_FLAGS, FIELDS_OPTION_DESCRIPTION).action(async (cmdOpts) => {
    const client2 = ctx.getClient();
    const fields = resolveListFields({
      fields: cmdOpts.fields,
      jqActive: isJqActive(),
      setting: ctx.getListFields?.(),
      defaults: defaultProjection(["_id", "name", "lastModified"])
    });
    const [own, shared] = await Promise.all([
      client2.list(withListProjection("v1/stacks", fields)),
      client2.list(withListProjection("v1/shared/stacks", fields))
    ]);
    const ownRows = projectRows(own, fields);
    const sharedRows = projectRows(shared, fields);
    const byId = /* @__PURE__ */ new Map();
    for (const s of ownRows) byId.set(String(s._id), { ...s, shared: false });
    for (const s of sharedRows) {
      const id = String(s._id);
      if (!byId.has(id)) byId.set(id, { ...s, shared: true });
    }
    formatOutput([...byId.values()], ctx.getFormat(), {
      columns: ["_id", "name", "shared", "lastModified"],
      isList: true
    });
  });
  group.command("token <id>").description("Retrieve the system token for a server stack.").action(async (id) => {
    const stack = await ctx.getClient().get(`v1/stacks/${id}`);
    if (stack.type !== "server") {
      throw new Error(
        `token is only available for server-type stacks (this stack is type '${stack.type}').`
      );
    }
    const result = await ctx.getClient().get(`v1/stacks/${id}/systemToken`);
    formatOutput(result, ctx.getFormat());
  });
  group.command("rotate-token <id>").description(
    "Rotate the system token for a server stack.\nThe old token is invalidated immediately \u2014 retrieve the new one with `token`."
  ).option("-y, --yes", "Skip confirmation.").action(async (id, opts) => {
    if (!opts.yes) {
      const ok = await confirm(
        `Rotate system token for stack ${id}? All clients using the old token must be updated.`
      );
      if (!ok) return;
    }
    await ctx.getClient().delete(`v1/stacks/${id}/systemToken`);
    success(`System token for stack ${id} recycled.`);
  });
  group.command("audit <id>").description("Show the audit log for a stack.").action(
    (id) => getAndPrint(ctx, `v1/stacks/${id}/audit`, [
      "_id",
      "fieldChange.fieldPath",
      "byUser.email",
      "time"
    ])
  );
}

// src/commands/state.ts
import { Command as Command15 } from "commander";
function isResourceScoped(opts) {
  if (opts.resourceType && opts.resourceId) return true;
  if (opts.resourceType || opts.resourceId)
    throw new Error(
      "Pass --resource-type and --resource-id together to target a resource's state (omit both for global state)."
    );
  return false;
}
function withResourceFlags(cmd) {
  return cmd.option(
    "--resource-type <type>",
    "Target a resource's state (e.g. flows, exports) instead of global state. Requires --resource-id."
  ).option("--resource-id <id>", "Resource id whose state to target. Requires --resource-type.");
}
function registerState(program2, ctx) {
  const group = new Command15("state").summary("Manage state key-value stores.").description(
    "Manage state key-value stores.\nCommands target global state by default; pass --resource-type and --resource-id together to target a specific resource's state."
  );
  withResourceFlags(
    group.command("list").description("List state keys \u2014 global, or a resource's with --resource-type/--resource-id.")
  ).action(
    (opts) => isResourceScoped(opts) ? getAndPrint(ctx, `v1/${opts.resourceType}/${opts.resourceId}/state`, ["key", "value"]) : getAndPrint(ctx, "v1/state", ["key", "value"])
  );
  withResourceFlags(
    group.command("get <key>").description("Get a state value \u2014 global, or a resource's.")
  ).action(
    (key, opts) => isResourceScoped(opts) ? getAndPrint(ctx, `v1/${opts.resourceType}/${opts.resourceId}/state/${key}`) : getAndPrint(ctx, `v1/state/${key}`)
  );
  withResourceFlags(
    group.command("set <key>").description("Set a state key from a JSON body (stdin, or --file) \u2014 global, or a resource's.").option(
      "-f, --file <path>",
      "Read the JSON body from a file instead of stdin ('-' also means stdin)."
    )
  ).action(async (key, opts) => {
    const body = await readBody(opts.file);
    if (isResourceScoped(opts)) {
      await writeAndReport(
        ctx,
        "put",
        `v1/${opts.resourceType}/${opts.resourceId}/state/${key}`,
        body,
        `Set state key '${key}' on ${opts.resourceType} ${opts.resourceId}.`
      );
      return;
    }
    await writeAndReport(ctx, "put", `v1/state/${key}`, body, `Set global state key '${key}'.`);
  });
  withResourceFlags(
    group.command("delete <key>").description("Delete one state key \u2014 global, or a resource's.").option("-y, --yes", "Skip confirmation.")
  ).action(
    (key, opts) => isResourceScoped(opts) ? removeWithConfirm(
      ctx,
      `v1/${opts.resourceType}/${opts.resourceId}/state/${key}`,
      opts,
      `Delete state key '${key}' on ${opts.resourceType} ${opts.resourceId}?`,
      `Deleted state key '${key}' on ${opts.resourceType} ${opts.resourceId}.`
    ) : removeWithConfirm(
      ctx,
      `v1/state/${key}`,
      opts,
      `Delete global state key '${key}'?`,
      `Deleted global state key '${key}'.`
    )
  );
  withResourceFlags(
    group.command("purge").description(
      "Delete ALL state keys \u2014 global, or a resource's with --resource-type/--resource-id."
    ).option("-y, --yes", "Skip confirmation.")
  ).action(
    (opts) => isResourceScoped(opts) ? removeWithConfirm(
      ctx,
      `v1/${opts.resourceType}/${opts.resourceId}/state`,
      opts,
      `Delete ALL state keys on ${opts.resourceType} ${opts.resourceId}?`,
      `Cleared all state on ${opts.resourceType} ${opts.resourceId}.`
    ) : removeWithConfirm(
      ctx,
      "v1/state",
      opts,
      "Delete ALL global state keys?",
      "Cleared all global state."
    )
  );
  program2.addCommand(group);
}

// src/commands/storage.ts
import { existsSync as existsSync7, statSync as statSync3 } from "fs";
import { basename } from "path";
import { Command as Command16 } from "commander";

// src/storage-transfer.ts
import { createReadStream, createWriteStream, existsSync as existsSync6, statSync as statSync2 } from "fs";
import { open } from "fs/promises";
import { join as join8 } from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { ProxyAgent as ProxyAgent2 } from "undici";
var MULTIPART_PART_SIZE = 5 * 1024 * 1024;
var S3_MAX_PARTS = 1e4;
function shouldUseMultipart(size) {
  return size > MULTIPART_PART_SIZE;
}
function planMultipart(size) {
  let partSize = MULTIPART_PART_SIZE;
  const minBySize = Math.ceil(size / S3_MAX_PARTS);
  if (minBySize > partSize) partSize = Math.ceil(minBySize / (1024 * 1024)) * 1024 * 1024;
  return { partSize, numParts: Math.ceil(size / partSize) };
}
var SSE_HEADER = "x-amz-server-side-encryption";
var SSE_VALUE = "AES256";
function getProxyDispatcher2() {
  const proxyUrl = getProxyUrl();
  return proxyUrl ? new ProxyAgent2(proxyUrl) : void 0;
}
function s3Error(msg, status, detail, max = 300) {
  const body = detail ? `: ${detail.slice(0, max)}` : "";
  return new Error(`${msg} (HTTP ${status})${body}`);
}
async function fetchS3(label, url, init) {
  try {
    return await fetch(url, init);
  } catch (err) {
    const cause = err instanceof Error ? err.cause : void 0;
    const code = typeof cause?.code === "string" ? ` (${cause.code})` : "";
    throw new Error(`${label}: network request failed${code}`, { cause: err });
  }
}
async function uploadFileToPresignedUrl(url, localPath) {
  const { size } = statSync2(localPath);
  const body = Readable.toWeb(createReadStream(localPath));
  const res = await fetchS3("S3 upload", url, {
    method: "PUT",
    headers: { [SSE_HEADER]: SSE_VALUE, "Content-Length": String(size) },
    body,
    duplex: "half",
    dispatcher: getProxyDispatcher2()
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw s3Error("S3 upload failed", res.status, detail);
  }
  return size;
}
async function uploadFileMultipart(localPath, partUrls, completeUrl, partSize) {
  const { size } = statSync2(localPath);
  const fh = await open(localPath, "r");
  const completed = [];
  try {
    for (const part of partUrls) {
      const start = (part.partNumber - 1) * partSize;
      const length = Math.min(partSize, size - start);
      const buf = Buffer.allocUnsafe(length);
      await fh.read(buf, 0, length, start);
      const res2 = await fetchS3(`S3 part ${part.partNumber} upload`, part.url, {
        method: "PUT",
        body: buf,
        dispatcher: getProxyDispatcher2()
      });
      if (!res2.ok) {
        const detail = await res2.text().catch(() => "");
        throw s3Error(`S3 part ${part.partNumber} upload failed`, res2.status, detail, 200);
      }
      const etag = res2.headers.get("etag");
      if (!etag) throw new Error(`S3 part ${part.partNumber} returned no ETag.`);
      completed.push({ partNumber: part.partNumber, etag });
    }
  } finally {
    await fh.close();
  }
  completed.sort((a, b) => a.partNumber - b.partNumber);
  const xml = `<?xml version="1.0" encoding="UTF-8"?><CompleteMultipartUpload>${completed.map((p) => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${p.etag}</ETag></Part>`).join("")}</CompleteMultipartUpload>`;
  const res = await fetchS3("Multipart completion", completeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body: xml,
    dispatcher: getProxyDispatcher2()
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw s3Error("Multipart completion failed", res.status, detail);
  }
  return size;
}
function filenameFromContentDisposition(header) {
  if (!header) return void 0;
  const quoted = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  return quoted?.[1] ? decodeURIComponent(quoted[1].trim()) : void 0;
}
function resolveDownloadPath(localPath, storedName = "download") {
  if (!localPath) return storedName;
  if (existsSync6(localPath) && statSync2(localPath).isDirectory())
    return join8(localPath, storedName);
  return localPath;
}
async function downloadPresignedUrlToPath(url, localPath) {
  const res = await fetchS3("S3 download", url, {
    dispatcher: getProxyDispatcher2()
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw s3Error("S3 download failed", res.status, detail);
  }
  const stream = Readable.fromWeb(res.body);
  if (localPath === "-") {
    await pipeline(stream, process.stdout);
    return "-";
  }
  const storedName = filenameFromContentDisposition(res.headers.get("content-disposition"));
  const target = resolveDownloadPath(localPath, storedName);
  await pipeline(stream, createWriteStream(target));
  return target;
}

// src/commands/storage.ts
var LIST_COLUMNS3 = ["_id", "type", "name", "size", "mimeType", "status", "lastModified"];
var MIME_BY_EXT = {
  txt: "text/plain",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  json: "application/json",
  xml: "application/xml",
  html: "text/html",
  pdf: "application/pdf",
  zip: "application/zip",
  gz: "application/gzip",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif"
};
function mimeForName(name) {
  const dot = name.lastIndexOf(".");
  const ext = dot > -1 ? name.slice(dot + 1).toLowerCase() : "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}
function statLocalFile(localPath) {
  if (!existsSync7(localPath)) throw new Error(`Local file not found: ${localPath}`);
  const stat = statSync3(localPath);
  if (!stat.isFile()) throw new Error(`Not a file: ${localPath}`);
  return { size: stat.size };
}
function buildUploadEntry(name, size) {
  const base = { name, size, mimeType: mimeForName(name) };
  if (!shouldUseMultipart(size)) return { ...base, uploadType: "single" };
  const { partSize, numParts } = planMultipart(size);
  return { ...base, uploadType: "multipart", partSize, numParts };
}
async function transferEntry(entry, localPath, size, what) {
  const body = entry?.body;
  if (!body) {
    const err = entry?.errors?.[0];
    const detail = err ? `: ${err.code} \u2014 ${err.message}` : ".";
    throw new Error(`Could not ${what}${detail}`);
  }
  if (body.uploadType === "multipart") {
    if (!body.partUrls?.length || !body.completeUrl) {
      throw new Error(`Could not ${what}: multipart response missing partUrls/completeUrl.`);
    }
    const { partSize } = planMultipart(size);
    await uploadFileMultipart(localPath, body.partUrls, body.completeUrl, partSize);
    return `${size} bytes, ${body.partUrls.length} parts`;
  }
  if (!body.uploadUrl) throw new Error(`Could not ${what}: response missing uploadUrl.`);
  await uploadFileToPresignedUrl(body.uploadUrl, localPath);
  return `${size} bytes`;
}
function withListFilterOptions(cmd) {
  return cmd.option(
    "--mime <types...>",
    "Filter by MIME type(s) \u2014 repeatable, OR-matched (e.g. --mime text/csv application/pdf)."
  ).option("--sort <field>", "Sort field (e.g. name, lastModified, size).").option("--order <dir>", "Sort order: asc or desc.").option(
    "--modified-gte <iso>",
    "Only items with lastModified >= this ISO timestamp (inclusive)."
  ).option(
    "--modified-lte <iso>",
    "Only items with lastModified <= this ISO timestamp (inclusive)."
  );
}
function applyListFilters(params, opts) {
  for (const m of opts.mime ?? []) params.append("mimeType", m);
  if (opts.sort) params.set("sort_by", opts.sort);
  if (opts.order) params.set("sort_order", opts.order);
  if (opts.modifiedGte) params.set("lastModified_gte", opts.modifiedGte);
  if (opts.modifiedLte) params.set("lastModified_lte", opts.modifiedLte);
}
function registerStorage(program2, ctx) {
  const group = new Command16("storage").description(
    "Manage files and folders in Celigo Storage (managed file storage)."
  );
  withListFilterOptions(
    group.command("list").description(
      "List items in a folder (root by default), with optional MIME/sort/date filters."
    ).option("--parent <id>", "List the contents of this folder (omit for root).")
  ).action(async (opts) => {
    const params = new URLSearchParams();
    if (opts.parent) params.set("_parentId", opts.parent);
    applyListFilters(params, opts);
    const qs = params.toString();
    const items = await ctx.getClient().listEnvelope(qs ? `v1/storage/items?${qs}` : "v1/storage/items");
    formatOutput(items, ctx.getFormat(), { columns: LIST_COLUMNS3, isList: true });
  });
  withListFilterOptions(
    group.command("search <query>").description("Recursively search items by name, with optional MIME/sort/date filters.")
  ).action(async (query, opts) => {
    const params = new URLSearchParams();
    params.set("search", query);
    applyListFilters(params, opts);
    const items = await ctx.getClient().listEnvelope(`v1/storage/items?${params.toString()}`);
    formatOutput(items, ctx.getFormat(), { columns: LIST_COLUMNS3, isList: true });
  });
  group.command("upload <localPath>").description("Upload a local file to Celigo Storage (auto single-PUT or multipart by size).").option("--parent <id>", "Destination folder (omit for root).").option("--name <name>", "Name to store the file as (defaults to the local filename).").action(async (localPath, opts) => {
    const { size } = statLocalFile(localPath);
    const name = opts.name ?? basename(localPath);
    const body = { files: [buildUploadEntry(name, size)] };
    if (opts.parent) body._parentId = opts.parent;
    const res = await ctx.getClient().post("v1/storage/files/initiateUpload", body);
    const entry = res.files?.[0];
    const detail = await transferEntry(entry, localPath, size, `initiate upload of ${name}`);
    success(`Uploaded ${name} (${detail}) \u2192 ${entry?._id}`);
    if (ctx.getFormat() === "json") {
      formatOutput(
        { _id: entry?._id, name, size, _parentId: opts.parent ?? null },
        ctx.getFormat()
      );
    }
  });
  group.command("download <id> [localPath]").description(
    "Download a stored file by ID. Writes to the stored filename by default, to a directory if given one, or to stdout with '-'."
  ).action(async (id, localPath) => {
    const res = await ctx.getClient().get(`v1/storage/files/${id}/download`);
    if (!res?.downloadUrl) throw new Error(`No download URL returned for ${id}.`);
    const written = await downloadPresignedUrlToPath(res.downloadUrl, localPath);
    if (written !== "-") success(`Downloaded ${id} \u2192 ${written}`);
  });
  group.command("replace <id> <localPath>").description(
    "Replace a file's contents in place \u2014 preserves the item's ID, name, parent, and all references."
  ).action(async (id, localPath) => {
    const { size } = statLocalFile(localPath);
    const { name: _drop, ...fileEntry } = buildUploadEntry(basename(localPath), size);
    const res = await ctx.getClient().patch(`v1/storage/items/${id}/replace`, fileEntry);
    const detail = await transferEntry(res, localPath, size, `initiate replace of ${id}`);
    success(`Replaced contents of ${id} (${detail}).`);
  });
  group.command("create-folder <name>").description("Create a folder.").option("--parent <id>", "Parent folder (omit for root).").action(async (name, opts) => {
    const body = { type: "folder", name };
    if (opts.parent) body._parentId = opts.parent;
    const data = await ctx.getClient().post("v1/storage/items", body);
    formatOutput(data, ctx.getFormat());
  });
  group.command("set <id> [assignments...]").description(
    `Set field(s) on a storage item. Only name and description are editable.
Usage: set <id> key=value [key2=value2 ...]
Examples: set <id> name=report.csv   |   set <id> description="Q3 export"   |   set <id> name=a.csv description="..."`
  ).action(async (id, assignments) => {
    if (assignments.length === 0) {
      throw new Error("Provide at least one key=value assignment (e.g. name=report.csv).");
    }
    assertSetFieldsAllowedInMode(ctx.getMode(), extractFieldPaths(assignments));
    const body = {};
    applyAssignments(body, assignments);
    const data = await ctx.getClient().put(`v1/storage/items/${id}`, body);
    formatOutput(data, ctx.getFormat());
  });
  group.command("move <id>").description("Move an item to another folder. Folder moves cascade asynchronously.").requiredOption("--to <parentId>", "Destination folder ID, or 'root' for the top level.").action(async (id, opts) => {
    const parentId = opts.to === "root" ? null : opts.to;
    const data = await ctx.getClient().patch(`v1/storage/items/${id}/move`, { _parentId: parentId });
    formatOutput(data, ctx.getFormat());
  });
  group.command("copy <id>").description("Copy a file to another folder (files only \u2014 folders cannot be copied).").requiredOption("--to <parentId>", "Destination folder ID, or 'root' for the top level.").option("--name <name>", "Name for the copy (defaults to the source name).").action(async (id, opts) => {
    const body = { _parentId: opts.to === "root" ? null : opts.to };
    if (opts.name) body.name = opts.name;
    const data = await ctx.getClient().post(`v1/storage/items/${id}/copy`, body);
    formatOutput(data, ctx.getFormat());
  });
  group.command("merge <id>").description(
    "Merge a folder's contents into another folder, then remove the source (folders only \u2014\nmove individual files with 'move'). Runs asynchronously: returns a 202 job receipt and\nthe contents transfer in the background. Merging a soft-deleted source folder restores\nits contents into the destination."
  ).requiredOption("--to <destinationId>", "Destination folder ID (must be an existing folder).").action(async (id, opts) => {
    const data = await ctx.getClient().post(`v1/storage/items/${id}/merge`, { _destinationId: opts.to });
    formatOutput(data, ctx.getFormat());
  });
  group.command("delete <id>").description("Soft-delete an item to the recycle bin. Folder deletes cascade asynchronously.").option("-y, --yes", "Skip confirmation.").action(
    (id, opts) => removeWithConfirm(
      ctx,
      `v1/storage/items/${id}`,
      opts,
      `Delete storage item ${id}? (Folders cascade to all descendants.)`,
      `Deleted ${id} (recoverable via 'recycle-bin restore ${id}').`
    )
  );
  program2.addCommand(group);
}

// src/commands/subscriptions.ts
import { Command as Command17 } from "commander";
var REPORTS = [
  ["usage", "v1/usage", "Get historical usage records."],
  ["licenses", "v1/licenses", "Get license information."],
  ["entitlement-usage", "v1/licenseEntitlementUsage", "Get usage by license entitlement."],
  ["historical-usage", "v1/historicalMonthlyUsage", "Get historical monthly usage breakdown."],
  ["api-usage", "v1/apis/usage", "Get API usage detail."]
];
function registerSubscriptions(program2, ctx) {
  const group = new Command17("subscriptions").description(
    "View subscription and usage information."
  );
  addKnowledgeHelp(group, "subscriptions");
  for (const [name, path, description] of REPORTS) {
    group.command(name).description(description).action(async () => {
      const data = await ctx.getClient().get(path);
      formatOutput(data, ctx.getFormat());
    });
  }
  program2.addCommand(group);
}

// src/commands/syncs.ts
import { Command as Command18 } from "commander";
function registerSyncs(program2, ctx) {
  const syncs = makeResourceGroup("syncs", "syncs", {
    listColumns: ["_id", "name", "_integrationId", "disabled", "lastExecutedAt"],
    description: "Manage and run syncs \u2014 Celigo Data Ingestion replication pipelines.",
    integrationSubpath: "syncs",
    helpText: HELP.syncs,
    // PUT /v1/syncs/:id rejects _id/_userId in the body and refuses _integrationId even when
    // unchanged (live-verified), so set's GET+PUT fallback must strip them.
    putSanitizeFields: ["_id", "_userId", "_integrationId"],
    ...ctx
  });
  program2.addCommand(syncs);
  syncs.command("run <syncId>").description("Trigger a run of a sync.").action(async (syncId) => {
    const data = await ctx.getClient().post(`v1/syncs/${syncId}/run`);
    formatOutput(data, ctx.getFormat());
  });
  syncs.command("audit <syncId>").description("Show the audit log (change history) for a sync.").action(
    (syncId) => getAndPrint(ctx, `v1/syncs/${syncId}/audit`, [
      "_id",
      "fieldChange.fieldPath",
      "byUser.email",
      "time"
    ])
  );
  syncs.command("sources").description("List the applications supported as a sync source.").action(() => getAndPrint(ctx, "v1/di/metadata/sources", ["id", "category"]));
  syncs.command("destinations").description("List the applications supported as a sync destination.").action(() => getAndPrint(ctx, "v1/di/metadata/destinations", ["id", "category"]));
  syncs.command("cancel-jobs <syncId>").description("Cancel all running jobs for a sync.").option("-y, --yes", "Skip confirmation.").action(
    (syncId, opts) => confirmThen(opts, `Cancel all sync jobs for sync ${syncId}?`, async () => {
      await ctx.getClient().put(`v1/syncs/${syncId}/syncJobs/cancel`, {});
      success(`Cancel requested for all jobs of sync ${syncId}.`);
    })
  );
  syncs.command("events <syncId>").description(
    'List events for a sync across all of its runs, newest first.\nTwo categories: "Schema Drift" (source schema changes detected or applied) and\n"Data Catalog" (dataset metadata activity while cataloging the source).\nEvents are retention-bounded; --time-gte must not be in the future.'
  ).option("--type <type>", 'Filter by category: "Schema Drift" or "Data Catalog".').option("--resource-name <name>", "Filter to one source table/object (e.g. Account).").option(
    "--run <runId>",
    "Filter to one run \u2014 the flowExecutionGroupId returned by `syncs run`."
  ).option(
    "--time-gte <iso>",
    "Only events after this ISO-8601 timestamp (API param time_gt; not in the future)."
  ).option("--time-lte <iso>", "Only events at or before this ISO-8601 timestamp.").option("--limit <n>", "Max events to return (single request, 1-1000). Default: all pages.").action(
    async (syncId, opts) => {
      const params = new URLSearchParams();
      if (opts.type) params.set("type", opts.type);
      if (opts.resourceName) params.set("resourceName", opts.resourceName);
      if (opts.run) params.set("flowExecutionGroupId", opts.run);
      if (opts.timeGte) params.set("time_gt", opts.timeGte);
      if (opts.timeLte) params.set("time_lte", opts.timeLte);
      const base = `v1/di/resource/syncs/${syncId}/events`;
      const columns = ["id", "type", "severity", "resourceName", "stage", "eventTime"];
      if (opts.limit) {
        params.set("limit", opts.limit);
        const data = await ctx.getClient().get(`${base}?${params}`);
        formatOutput(data?.events ?? [], ctx.getFormat(), { columns, isList: true });
        return;
      }
      const qs = params.size > 0 ? `?${params}` : "";
      const events = await ctx.getClient().listEnvelope(`${base}${qs}`, "events");
      formatOutput(events, ctx.getFormat(), { columns, isList: true });
    }
  );
  syncs.command("usage").description(
    "Sync usage volumes (records loaded).\nDefault: per sync, current calendar month (UTC).\n--by month: account-wide monthly history vs. license entitlement (up to 14 months back).\n--by environment: per environment, current month."
  ).option("--by <dimension>", "Break down by 'month' or 'environment' instead of per sync.").option("--from <YYYY-MM>", "First month to include (requires --by month).").option("--to <YYYY-MM>", "Last month to include (requires --by month; not in the future).").action(async (opts) => {
    if (opts.by && opts.by !== "month" && opts.by !== "environment") {
      throw new Error(`Invalid --by value '${opts.by}'. Use 'month' or 'environment'.`);
    }
    if ((opts.from || opts.to) && opts.by !== "month") {
      throw new Error("--from/--to only apply with --by month (monthly history).");
    }
    const client2 = ctx.getClient();
    if (opts.by === "month") {
      const params = new URLSearchParams();
      if (opts.from) params.set("from", opts.from);
      if (opts.to) params.set("to", opts.to);
      const qs = params.size > 0 ? `?${params}` : "";
      const data2 = await client2.get(`v1/syncs/usage/summary${qs}`);
      formatOutput(data2, ctx.getFormat(), {
        columns: ["year", "month", "volume", "entitlement"],
        isList: true
      });
      return;
    }
    if (opts.by === "environment") {
      const data2 = await client2.get("v1/syncs/usage/environments");
      formatOutput(data2?.usage ?? [], ctx.getFormat(), {
        columns: ["environment", "volume"],
        isList: true
      });
      return;
    }
    const data = await client2.get("v1/syncs/usage");
    formatOutput(data?.usage ?? [], ctx.getFormat(), {
      columns: ["_id", "name", "volume"],
      isList: true
    });
  });
  const syncJobs = new Command18("sync-jobs").description(
    "Inspect and cancel sync jobs (the executions produced by `syncs run`)."
  );
  syncJobs.command("list").description("List the jobs for a sync, newest first.").requiredOption("--sync <syncId>", "Sync whose jobs to list.").option("--created-gte <iso>", "Filter by createdAt >= ISO-8601 timestamp.").option("--created-lte <iso>", "Filter by createdAt <= ISO-8601 timestamp.").action(async (opts) => {
    const params = new URLSearchParams();
    if (opts.createdGte) params.set("createdAt_gt", opts.createdGte);
    if (opts.createdLte) params.set("createdAt_lte", opts.createdLte);
    const result = await ctx.getClient().listByCreatedCursor(`v1/syncs/${opts.sync}/syncJobs`, { params, pageSize: 100 });
    reportCursorList(
      ctx,
      result,
      ["_id", "status", "runType", "numErrors", "numLoadedRecords", "createdAt"],
      "Narrow with --created-gte/--created-lte."
    );
  });
  syncJobs.command("get <syncJobId>").description("Get a sync job by ID.").action((syncJobId) => getAndPrint(ctx, `v1/syncJobs/${syncJobId}`));
  syncJobs.command("errors <syncJobId>").description("List errors for a sync job.").action(
    (syncJobId) => listAndPrint(ctx, `v1/syncJobs/${syncJobId}/errors`, [
      "code",
      "message",
      "source",
      "stage",
      "occurredAt"
    ])
  );
  syncJobs.command("cancel <syncJobId>").description("Cancel a single sync job.").option("-y, --yes", "Skip confirmation.").action(
    (syncJobId, opts) => confirmThen(opts, `Cancel sync job ${syncJobId}?`, async () => {
      await ctx.getClient().put(`v1/syncJobs/${syncJobId}/cancel`, {});
      success(`Cancel requested for sync job ${syncJobId}.`);
    })
  );
  program2.addCommand(syncJobs);
}

// src/commands/tags.ts
function registerTags(program2, ctx) {
  crud(
    program2,
    "tags",
    "tags",
    ["_id", "tag", "tagId", "lastModified"],
    ctx,
    "Manage tags for organizing resources."
  );
}

// src/commands/templates.ts
import { readFile } from "fs/promises";
import { Command as Command19 } from "commander";
var MARKETPLACE_COLUMNS = ["_id", "name", "numInstalls", "docType", "applications"];
async function uploadTemplateZip(ctx, filePath) {
  const { signedURL, runKey } = await ctx.getClient().get("v1/s3SignedURL?file_type=application/zip");
  const bytes = await readFile(filePath);
  const res = await fetch(signedURL, {
    method: "PUT",
    headers: { "x-amz-server-side-encryption": "AES256" },
    body: bytes
  });
  if (!res.ok) {
    throw new Error(
      `Failed to upload template zip to S3 (HTTP ${res.status}): ${await res.text()}`
    );
  }
  return runKey;
}
function registerTemplates(program2, ctx) {
  const group = new Command19("templates").summary("Browse, preview, manage, and install integration templates.").description(
    "Browse, preview, manage, and install integration templates.\n`marketplace` browses the published catalog; `list`/`get`/`create`/`update`/`delete` manage your own template resources; `preview` inspects a template's blueprint; `install` creates an integration from a template (by id or a local .zip)."
  );
  addKnowledgeHelp(group, "templates");
  group.command("marketplace").description(
    "List published marketplace templates, sorted by install count.\nConnectors (integration apps) are excluded by default \u2014 they're managed installs that can't be previewed.\nUse --type Connector or --include-connectors to see them.\n(For your own template resources, use 'templates list'.)"
  ).option("--type <type>", "Filter by docType: Template or Connector.").option("--include-connectors", "Include docType=Connector entries in the unfiltered list.").option(FIELDS_OPTION_FLAGS, FIELDS_OPTION_DESCRIPTION).action(async (opts) => {
    const fields = resolveListFields({
      fields: opts.fields,
      jqActive: isJqActive(),
      setting: ctx.getListFields?.(),
      defaults: defaultProjection(MARKETPLACE_COLUMNS),
      mandatory: ["docType"]
    });
    const data = await ctx.getClient().post("v1/published/combined?sort_by=numInstalls");
    let filtered;
    if (opts.type) {
      const t = opts.type.toLowerCase();
      filtered = data.filter((x) => x.docType?.toLowerCase() === t);
    } else if (opts.includeConnectors) {
      filtered = data;
    } else {
      filtered = data.filter((x) => x.docType !== "Connector");
    }
    formatOutput(projectRows(filtered, fields), ctx.getFormat(), {
      columns: MARKETPLACE_COLUMNS,
      isList: true
    });
  });
  group.command("preview [id]").description(
    "Preview a template's blueprint \u2014 by id, or from a local .zip with --zip.\nBy id: returns all objects (flows, exports, imports, scripts, connections) with complete configs; use --model to filter or --summary for counts. Only docType=Template entries are previewable.\nBy --zip: previews the integration a local template bundle would create (nothing is saved) \u2014 run this first to discover the source connections to map for `install --zip`."
  ).option("--zip <path>", "Preview a local template .zip instead of a template id.").option(
    "--model <model>",
    "Filter objects by model type (Flow, Export, Import, Script, Connection, Integration)."
  ).option("--summary", "Show only a summary of object counts instead of full configs.").action(
    async (id, opts) => {
      if (id && opts.zip) throw new Error("Pass either a template id or --zip <path>, not both.");
      if (!id && !opts.zip)
        throw new Error("Provide a template id, or --zip <path> to preview a local bundle.");
      if (opts.zip) {
        const runKey = await uploadTemplateZip(ctx, opts.zip);
        const data2 = await ctx.getClient().get(`v1/integrations/template/preview?runKey=${encodeURIComponent(runKey)}`);
        formatOutput(data2, ctx.getFormat());
        return;
      }
      let data;
      try {
        data = await ctx.getClient().get(`v1/templates/${id}/preview`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("invalid_ref") || msg.includes("Template not found")) {
          throw new Error(
            `Template ${id} not found or not previewable. Connectors (docType=Connector) install via the UI and can't be previewed \u2014 only docType=Template entries support preview.`
          );
        }
        throw err;
      }
      if (opts.summary) {
        const counts = {};
        for (const obj of data.objects) {
          counts[obj.model] = (counts[obj.model] || 0) + 1;
        }
        const rows2 = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([model, count]) => ({ model, count }));
        formatOutput(rows2, ctx.getFormat(), {
          columns: ["model", "count"],
          isList: true
        });
        return;
      }
      let objects = data.objects;
      if (opts.model) {
        const m = opts.model.toLowerCase();
        objects = objects.filter((o) => o.model.toLowerCase() === m);
      }
      const rows = objects.map((o) => ({ model: o.model, ...o.doc }));
      formatOutput(rows, ctx.getFormat(), {
        columns: ["model", "_id", "name", "adaptorType"],
        isList: true
      });
    }
  );
  program2.addCommand(group);
  group.command("list").description(
    "List your own template resources from the v1/templates CRUD endpoint.\nDistinct from `marketplace`, which browses published templates (v1/published/combined)."
  ).action(async () => {
    const data = await ctx.getClient().get("v1/templates");
    formatOutput(data, ctx.getFormat(), {
      columns: ["_id", "name", "lastModified"],
      isList: true
    });
  });
  group.command("get <id>").description("Get a single template by id.").action(async (id) => {
    const data = await ctx.getClient().get(`v1/templates/${id}`);
    formatOutput(data, ctx.getFormat());
  });
  addWriteCommands(group, ctx, {
    endpoint: "templates",
    descNoun: "a template",
    confirmNoun: "template"
  });
  group.command("install [id]").description(
    'Install a template, creating a new integration \u2014 by id, or from a local .zip with --zip.\nTemplates that include connections require a source\u2192target connection map piped via stdin:\n{"connectionMap":{"sourceConnId":"targetConnId",...}}\nRun `templates preview <id>` (or `preview --zip <file>`) first to discover the source connections.'
  ).option("--zip <path>", "Install from a local template .zip instead of a template id.").option("-f, --file <path>", "JSON body file for an id-based install (or pipe via stdin).").action(async (id, opts) => {
    if (id && opts.zip) throw new Error("Pass either a template id or --zip <path>, not both.");
    if (!id && !opts.zip)
      throw new Error("Provide a template id, or --zip <path> to install a local bundle.");
    if (opts.zip) {
      const stdin = await tryReadStdin() ?? {};
      const runKey = await uploadTemplateZip(ctx, opts.zip);
      const body = { runKey };
      if (stdin.connectionMap) body.connectionMap = stdin.connectionMap;
      const data = await ctx.getClient().post("v1/integrations/template", body);
      formatOutput(data, ctx.getFormat());
      return;
    }
    await writeFromBody(ctx, "post", `v1/integrations/template/${id}`, opts.file);
  });
}

// src/commands/tools.ts
function registerTools(program2, ctx) {
  const group = crud(
    program2,
    "tools",
    "tools",
    ["_id", "name", "_integrationId", "lastModified"],
    ctx,
    "Manage tools (reusable building blocks callable from flows, APIs, agents, MCP servers, and other tools)."
  );
  addDependenciesCommand(group, ctx, "tools");
  addAuditCommand(group, ctx, "tools");
  withProcessorOptions(
    group.command("add-processor <id> <exportOrImportId>").description(
      "Add a page processor to a tool.\nAuto-detects whether the ID is an export or import.\nExample: celigo tools add-processor <id> <importId> --router r1"
    )
  ).action(async (id, exportOrImportId, opts) => {
    const client2 = ctx.getClient();
    const { type, processor } = await detectProcessorType(client2, exportOrImportId);
    const tool = await client2.get(`v1/tools/${id}`);
    if (!Array.isArray(tool.routers) || tool.routers.length === 0) {
      const routerId = randomRouterId();
      tool.routers = [
        {
          id: routerId,
          branches: [
            {
              name: "Branch 1.0",
              inputFilter: { rules: [] },
              pageProcessors: [],
              nextRouterId: "outputRouter"
            }
          ]
        }
      ];
    }
    const routers = tool.routers;
    const branch = resolveBranch(routers, opts, "Tool");
    await addProcessorToBranch({
      client: client2,
      branch,
      processor,
      confirmMsg: `Add ${type} '${exportOrImportId}' to tool ${id}, branch '${branch.name || "(default)"}'?`,
      doc: tool,
      putEndpoint: `v1/tools/${id}`,
      yes: opts.yes,
      format: ctx.getFormat()
    });
  });
  withProcessorOptions(
    group.command("remove-processor <id> <exportOrImportId>").description("Remove a page processor from a tool by its export or import ID.")
  ).action(async (id, exportOrImportId, opts) => {
    const client2 = ctx.getClient();
    const tool = await client2.get(`v1/tools/${id}`);
    const routers = tool.routers;
    if (!Array.isArray(routers) || routers.length === 0) {
      throw new Error("Tool has no routers.");
    }
    const pps = findProcessorList(routers, exportOrImportId, opts);
    await removeProcessorAndPut({
      client: client2,
      pps,
      exportOrImportId,
      doc: tool,
      putEndpoint: `v1/tools/${id}`,
      confirmMsg: `Remove processor '${exportOrImportId}' from tool ${id}?`,
      yes: opts.yes,
      format: ctx.getFormat()
    });
  });
  addDebugRequestCommands(group, ctx, "tools");
  addTestRunCommands(group, ctx, "tools");
  group.command("connections <id>").description("List the connections used by a tool.").action(
    (id) => getAndPrint(ctx, `v1/tools/${id}/connections`, ["_id", "name", "type"])
  );
  group.command("download <id>").description(
    "Download a tool as a template ZIP file.\nCalls the template endpoint, fetches the signed URL, and saves locally.\nDefault filename: <tool-name>.zip (or tool-<id>.zip)."
  ).option("-o, --output <path>", "Output file path (default: <name>.zip in current directory).").action(async (id, opts) => {
    const tool = await ctx.getClient().get(`v1/tools/${id}`);
    await fetchSignedZip(
      ctx,
      `v1/tools/${id}/template`,
      tool.name ?? `tool-${id}`,
      opts.output
    );
  });
}

// src/commands/trading-partner-connectors.ts
import { Command as Command20 } from "commander";
function registerTradingPartnerConnectors(program2, ctx) {
  const group = new Command20("trading-partner-connectors").alias("tp-connectors").summary("Browse trading partner connector definitions (590+ connectors).").description(
    "Browse trading partner connector definitions (590+ connectors).\nCeligo publishes the catalog; create/update/delete exist for definition management."
  );
  addKnowledgeHelp(group, "trading-partner-connectors");
  group.command("list").description("List all trading partner connector definitions.").option(FIELDS_OPTION_FLAGS, FIELDS_OPTION_DESCRIPTION).action(async (cmdOpts) => {
    const fields = resolveListFields({
      fields: cmdOpts.fields,
      jqActive: isJqActive(),
      setting: ctx.getListFields?.(),
      defaults: defaultProjection(["_id", "name"])
    });
    const data = await ctx.getClient().list(withListProjection("v1/tpconnectors", fields));
    formatOutput(projectRows(data, fields), ctx.getFormat(), {
      columns: ["_id", "name"],
      isList: true
    });
  });
  group.command("get <id>").description("Get a trading partner connector definition.").action(async (id) => {
    const data = await ctx.getClient().get(`v1/tpconnectors/${id}`);
    formatOutput(data, ctx.getFormat());
  });
  program2.addCommand(group);
  addWriteCommands(group, ctx, {
    endpoint: "tpconnectors",
    descNoun: "a trading partner connector definition",
    confirmNoun: "trading partner connector"
  });
}

import { registerUsers } from "../src/commands/users.js";

// src/commands/virtual-imports.ts
import { Command as Command21 } from "commander";
function registerVirtualImport(program2, ctx, name, adaptorType, listColumns, description) {
  const group = new Command21(name).description(description);
  addKnowledgeHelp(group, name);
  const singular = name.replace(/s$/, "");
  const fetchTyped = async (id) => {
    const resource = await ctx.getClient().get(`v1/imports/${id}`);
    if (!resource || resource.adaptorType !== adaptorType) {
      throw new Error(
        `Import ${id} is not ${article(singular)} ${singular} (adaptorType=${resource?.adaptorType ?? "unknown"}). Use \`celigo imports\` for non-${singular} imports.`
      );
    }
    return resource;
  };
  group.command("list").description(`List all ${name}.`).option(FIELDS_OPTION_FLAGS, FIELDS_OPTION_DESCRIPTION).action(async (cmdOpts) => {
    const fields = resolveListFields({
      fields: cmdOpts.fields,
      jqActive: isJqActive(),
      setting: ctx.getListFields?.(),
      defaults: defaultProjection(listColumns, ["adaptorType"]),
      mandatory: ["adaptorType"]
    });
    const all = await ctx.getClient().list(withListProjection("v1/imports", fields));
    const filtered = all.filter((r) => r.adaptorType === adaptorType);
    formatOutput(projectRows(filtered, fields), ctx.getFormat(), {
      columns: listColumns,
      isList: true
    });
  });
  group.command("get <id>").description(`Get ${article(singular)} ${singular} by ID.`).action(async (id) => {
    const data = await fetchTyped(id);
    formatOutput(data, ctx.getFormat());
  });
  group.command("create").description(`Create ${article(singular)} ${singular} from a JSON body (stdin, or --file).`).option(
    "-f, --file <path>",
    "Read the JSON body from a file instead of stdin ('-' also means stdin)."
  ).action(async (opts) => {
    const body = await readBody(opts.file);
    body.adaptorType = adaptorType;
    const result = await ctx.getClient().post("v1/imports", body);
    formatOutput(result, ctx.getFormat());
  });
  group.command("update <id>").description(`Update ${article(singular)} ${singular} from a JSON body (stdin, or --file).`).option(
    "-f, --file <path>",
    "Read the JSON body from a file instead of stdin ('-' also means stdin)."
  ).action(async (id, opts) => {
    await fetchTyped(id);
    const body = await readBody(opts.file);
    const result = await ctx.getClient().put(`v1/imports/${id}`, body);
    formatOutput(result, ctx.getFormat());
  });
  group.command("set <id> [assignments...]").description(
    `Set field(s) on ${article(singular)} ${singular} via GET + modify + PUT.
Usage: set <id> key=value [key2=value2 ...]
Values are auto-parsed: disabled=false \u2192 boolean.
Dot notation supported (e.g. nested.field=value).`
  ).action(async (id, assignments) => {
    if (assignments.length === 0) throw new Error("Provide at least one key=value assignment.");
    const client2 = ctx.getClient();
    const resource = await fetchTyped(id);
    applyAssignments(resource, assignments);
    const result = await client2.put(`v1/imports/${id}`, resource);
    formatOutput(result, ctx.getFormat());
  });
  group.command("delete <id>").description(`Delete ${article(singular)} ${singular} by ID.`).option("-y, --yes", "Skip confirmation.").action(async (id, cmdOpts) => {
    await fetchTyped(id);
    if (!cmdOpts.yes) {
      const ok = await confirm(`Delete ${singular} ${id}?`);
      if (!ok) return;
    }
    await ctx.getClient().delete(`v1/imports/${id}`);
    success(`Deleted ${id}`);
  });
  group.command("invoke [id]").description(
    `Invoke (no job created).
  With <id>: run a saved ${singular} against input records (stdin or --file).
  Without <id>: supply a ${singular} document (stdin or --file) to preview its output (POST /imports/preview).
Without an <id>, input is required \u2014 an empty stdin/file errors rather than silently previewing.`
  ).option(
    "-f, --file <path>",
    "Read the records/import document from a file instead of stdin ('-' also means stdin)."
  ).action(async (id, opts) => {
    if (!id) {
      const body2 = await readBody(opts.file);
      body2.adaptorType = adaptorType;
      const result2 = await ctx.getClient().post("v1/imports/preview", body2);
      formatOutput(result2, ctx.getFormat());
      return;
    }
    await fetchTyped(id);
    const body = opts.file ? await readBody(opts.file) : await tryReadStdin();
    const result = await ctx.getClient().post(`v1/imports/${id}/invoke`, body);
    formatOutput(result, ctx.getFormat());
  });
  addDebugCommands(
    group,
    ctx,
    singular,
    "imports",
    "/debugUntil",
    `Request/response logs are then captured by any flow, API, or tool that runs this ${singular} \u2014 fetch them from the consumer with \`flows debug-requests <flowId> <id>\` (or \`apis\`/\`tools debug-requests\`).`
  );
  group.command("clone <id>").description(
    `Clone ${article(singular)} ${singular}.
Same-env clone: no stdin needed \u2014 the CLI auto-builds a self-map from the resource's connection (empty for guardrails without a BYOK connection).
Cross-env clone: pipe JSON via stdin: {"connectionMap":{"sourceConnId":"targetConnId"},"name":"..."}`
  ).option(
    "--name <name>",
    `Name for the cloned ${singular}. Defaults to "Clone - <source name>" (matches the UI).`
  ).action(async (id, opts) => {
    const stdin = await tryReadStdin() ?? {};
    const res = await fetchTyped(id);
    let connectionMap = stdin.connectionMap;
    const connId = res._connectionId;
    connectionMap ??= connId ? { [connId]: connId } : {};
    let cloneName = opts.name;
    if (!cloneName) {
      if (!res.name) {
        throw new Error(
          `Source ${singular} ${id} has no name \u2014 cannot auto-generate a clone name. Provide --name explicitly.`
        );
      }
      cloneName = `Clone - ${res.name}`;
    }
    const body = { name: cloneName, connectionMap };
    const result = await ctx.getClient().post(`v1/imports/${id}/clone`, body);
    formatOutput(result, ctx.getFormat());
  });
  group.command("replace-connection <id> <newConnectionId>").description(
    `Replace the connection on ${article(singular)} ${singular} (e.g. BYOK key connection).`
  ).action(async (id, newConnectionId) => {
    await replaceConnection(
      ctx.getClient(),
      `v1/imports/${id}/replaceConnection`,
      { _newConnectionId: newConnectionId },
      `Replaced connection on ${singular} ${id}.`,
      ctx.getFormat()
    );
  });
  program2.addCommand(group);
  return group;
}
function registerAiAgents(program2, ctx) {
  registerVirtualImport(
    program2,
    ctx,
    "ai-agents",
    "AiAgentImport",
    ["_id", "name", "lastModified"],
    "Manage AI agents (LLM-powered import steps)."
  );
}
function registerGuardrails(program2, ctx) {
  registerVirtualImport(
    program2,
    ctx,
    "guardrails",
    "GuardrailImport",
    ["_id", "name", "guardrail.type", "lastModified"],
    "Manage guardrails (PII detection, content moderation, AI safety checks)."
  );
}

// src/commands/index.ts
function registerAll(program2, ctx) {
  registerAiAgents(program2, ctx);
  registerAsyncHelpers(program2, ctx);
  registerGuardrails(program2, ctx);
  registerOnPremiseAgents(program2, ctx);
  registerApis(program2, ctx);
  registerEdiProfiles(program2, ctx);
  registerEnvironments(program2, ctx);
  registerFileDefinitions(program2, ctx);
  registerIclients(program2, ctx);
  registerLookupCaches(program2, ctx);
  registerTags(program2, ctx);
  registerTools(program2, ctx);
  registerMcpServers(program2, ctx);
  registerIntegrations(program2, ctx);
  registerFlows(program2, ctx);
  registerConnections(program2, ctx);
  registerExports(program2, ctx);
  registerImports(program2, ctx);
  registerScripts(program2, ctx);
  registerStacks(program2, ctx);
  registerUsers(program2, ctx);
  registerJobs(program2, ctx);
  registerAudit(program2, ctx);
  registerSubscriptions(program2, ctx);
  registerNotifications(program2, ctx);
  registerAccount(program2, ctx);
  registerEdiTransactions(program2, ctx);
  registerHttpConnectors(program2, ctx);
  registerTradingPartnerConnectors(program2, ctx);
  registerMetadata(program2, ctx);
  registerProcessors(program2, ctx);
  registerTemplates(program2, ctx);
  registerConnectors(program2, ctx);
  registerState(program2, ctx);
  registerSyncs(program2, ctx);
  registerDatasets(program2, ctx);
  registerRecycleBin(program2, ctx);
  registerStorage(program2, ctx);
  registerMcpOauthProviders(program2, ctx);
  registerEventReports(program2, ctx);
}

// src/index.ts
function getCommandPath(cmd) {
  const parts = [];
  let current = cmd;
  while (current?.parent) {
    parts.unshift(current.name());
    current = current.parent;
  }
  return parts.join(" ");
}
var VERSION = true ? "2026.8.6" : "0.0.0-dev";
autoUpdate(VERSION);
autoInstallSkills();
var config;
var client;
var program = new Command22().name("celigo").description("Celigo CLI \u2014 manage your integrator.io resources from the terminal.").version(VERSION, "-v, --version").option(
  "--token <token>",
  "API bearer token (prefer CELIGO_API_TOKEN env var to avoid exposing in process list)."
).option("--base-url <url>", "API base URL.").option("--format <format>", "Output format (json or table). Defaults to config or json.").option(
  "--jq <expr>",
  "Transform JSON output with a jq expression (e.g. --jq '.[] | {id: ._id, name}')."
).option("--verbose", "Show HTTP requests.").option("--profile <name>", "Use a named config profile instead of the active profile.").hook("preAction", (thisCommand, actionCommand) => {
  assertRequiredArgsNonEmpty(actionCommand);
  const opts = thisCommand.opts();
  config = loadConfig({
    token: opts.token,
    baseUrl: opts.baseUrl,
    format: opts.format,
    verbose: opts.verbose,
    profile: opts.profile
  });
  setJqExpression(typeof opts.jq === "string" ? opts.jq : void 0);
  assertCommandAllowedInMode(config.mode, getCommandPath(actionCommand));
  client = void 0;
});
var configGroup = new Command22("config").description("Manage CLI configuration.");
function parseConfigValue(key, value) {
  switch (key) {
    case "mode":
      return parseMode(value);
    case "base_url":
      return normalizeBaseUrl(value);
    case "auto_update":
    case "skills_auto_install":
      return parseBooleanSetting(key, value);
    case "account_alias":
      return parseAccountAlias(value);
    case "list_fields":
      return parseListFields(value);
    case "skills_auto_install_exclude":
      return parseSkillNames(key, value);
    default:
      return value;
  }
}
configGroup.command("set <key> <value>").description(
  `Set a config value. Per-profile keys: api_token, base_url, default_format, mode [${VALID_MODES.join("|")}], account_alias, list_fields [all|default]. Machine-wide keys (one CLI install per machine, so not per-profile): auto_update [true|false], skills_auto_install [true|false], skills_auto_install_exclude [comma-separated skill names, empty to clear].`
).action((key, value) => {
  const valid = /* @__PURE__ */ new Set([
    "account_alias",
    "api_token",
    "auto_update",
    "base_url",
    "default_format",
    "list_fields",
    "mode",
    "skills_auto_install",
    "skills_auto_install_exclude"
  ]);
  if (!valid.has(key)) {
    throw new Error(
      `Unknown key '${key}'. Valid keys: ${[...valid].sort((a, b) => a.localeCompare(b)).join(", ")}`
    );
  }
  const stored = parseConfigValue(key, value);
  const profile = program.opts().profile;
  if (GLOBAL_SETTING_KEYS.has(key)) {
    if (profile) {
      throw new Error(
        `'${key}' is machine-wide (there is one CLI installation, not one per profile) \u2014 drop --profile.`
      );
    }
    writeGlobalSetting(key, stored);
    console.log(`${key} = ${stored || "(empty)"} (machine-wide)`);
    return;
  }
  writeConfig(key, stored, profile);
  const display = key === "api_token" ? redactToken(value) : stored;
  console.log(`${key} = ${display}`);
});
configGroup.command("get <key>").description("Get a config value.").action((key) => {
  const profile = program.opts().profile;
  const value = GLOBAL_SETTING_KEYS.has(key) ? getGlobalSetting(key) : getConfig(key, profile);
  if (value === void 0) {
    console.log(`${key}: (not set)`);
  } else {
    const display = key === "api_token" ? redactToken(value) : value;
    console.log(`${key} = ${display}`);
  }
});
configGroup.command("show").description("Show all configuration (tokens redacted), including machine-wide settings.").action(() => {
  const profile = program.opts().profile;
  const cfg = getConfig(void 0, profile);
  const settings = {};
  for (const key of GLOBAL_SETTING_KEYS) {
    const value = getGlobalSetting(key);
    if (value !== void 0) settings[key] = value;
  }
  if ((!cfg || Object.keys(cfg).length === 0) && Object.keys(settings).length === 0) {
    console.log("No configuration set. Run: celigo config set api_token <token>");
    return;
  }
  const redacted = {};
  for (const [key, value] of Object.entries({ ...cfg, ...settings })) {
    redacted[key] = key.toLowerCase().includes("token") ? redactToken(value) : value;
  }
  if (program.opts().format === "json" || program.opts().jq) {
    printJson(redacted);
    return;
  }
  for (const [key, value] of Object.entries(redacted)) {
    console.log(`${key} = ${value}`);
  }
});
program.addCommand(configGroup);
var profileGroup = new Command22("profile").description(
  "Manage named config profiles (multiple accounts/environments)."
);
profileGroup.command("list").description("List all profiles.").action(() => {
  const profiles = listProfiles();
  if (program.opts().format === "json" || program.opts().jq) {
    printJson(
      profiles.map((p) => ({
        name: p.name,
        active: p.active,
        mode: p.config.mode ?? DEFAULT_MODE,
        base_url: p.config.base_url || DEFAULT_BASE_URL,
        api_token: redactToken(p.config.api_token)
      }))
    );
    return;
  }
  if (profiles.length === 0) {
    console.log("No profiles configured. Run: celigo profile add <name> --api-token <token>");
    return;
  }
  for (const p of profiles) {
    const markers = [];
    if (p.active) markers.push("active");
    const mode = p.config.mode ?? DEFAULT_MODE;
    if (mode !== DEFAULT_MODE) markers.push(`mode=${mode}`);
    const marker = markers.length ? ` (${markers.join(", ")})` : "";
    const url = p.config.base_url || DEFAULT_BASE_URL;
    const token = redactToken(p.config.api_token);
    console.log(`  ${p.name}${marker}  token=${token}  url=${url}`);
  }
});
profileGroup.command("show [name]").description("Show details of a profile (defaults to active).").action((name) => {
  const profileName = name || getActiveProfile();
  const cfg = getConfig(void 0, profileName);
  if (!cfg || Object.keys(cfg).length === 0) {
    console.log(`Profile '${profileName}' has no configuration.`);
    return;
  }
  const redacted = {};
  for (const [key, value] of Object.entries(cfg)) {
    redacted[key] = key.toLowerCase().includes("token") ? redactToken(value) : value;
  }
  if (program.opts().format === "json" || program.opts().jq) {
    printJson({ profile: profileName, ...redacted });
    return;
  }
  console.log(`Profile: ${profileName}`);
  for (const [key, value] of Object.entries(redacted)) {
    console.log(`  ${key} = ${value}`);
  }
});
profileGroup.command("whoami").description(
  "Resolve the active profile's API token to the user it authenticates as (GET /v1/tokenInfo)."
).action(async () => {
  client ??= new CeligoClient(config);
  const data = await client.get("v1/tokenInfo");
  formatOutput(data, config.format);
});
profileGroup.command("use <name>").description("Switch the active profile.").action((name) => {
  useProfile(name);
  console.log(`Switched to profile '${name}'.`);
});
profileGroup.command("add <name>").description("Create a new profile.").option("--api-token <token>", "API token for the profile.").option("--api-base-url <url>", "API base URL for the profile.").option("--default-format <format>", "Default output format (json or table).").option(
  "--mode <mode>",
  `Permission mode: ${VALID_MODES.join(" | ")} (default: ${DEFAULT_MODE}).`
).option(
  "--account-alias <alias>",
  "This account's MCP alias (the segment in https://api.\u2026/mcp/<alias>/<server>). No API returns it, so the local tree needs it to tell this account's MCP servers from another account's with the same name."
).action(
  async (name, opts, cmd) => {
    let token = opts.apiToken ?? cmd.parent?.parent?.opts()?.token;
    if (!token) {
      if (!process.stdin.isTTY) {
        console.error(
          "No token provided. Use --api-token <token> (or pipe input via a TTY to be prompted)."
        );
        process.exitCode = 1;
        return;
      }
      token = await promptSecret("API token: ");
      if (!token) {
        console.error("No token provided. Profile not created.");
        process.exitCode = 1;
        return;
      }
    }
    const cfg = { api_token: token };
    if (opts.apiBaseUrl) cfg.base_url = normalizeBaseUrl(opts.apiBaseUrl);
    if (opts.defaultFormat) cfg.default_format = opts.defaultFormat;
    if (opts.mode) cfg.mode = parseMode(opts.mode);
    if (opts.accountAlias) cfg.account_alias = parseAccountAlias(opts.accountAlias);
    addProfile(name, cfg);
    console.log(`Profile '${name}' created.`);
    const profiles = listProfiles();
    if (profiles.find((p) => p.name === name)?.active) {
      console.log(`  (set as active \u2014 it's the only profile)`);
    }
  }
);
profileGroup.command("delete <name>").description("Delete a profile.").option("-y, --yes", "Skip confirmation.").action(async (name, opts) => {
  if (!opts.yes && !await confirm(`Delete profile '${name}'? This cannot be undone.`)) return;
  deleteProfile(name);
  console.log(`Profile '${name}' deleted.`);
});
profileGroup.command("rename <oldName> <newName>").description("Rename a profile.").action((oldName, newName) => {
  renameProfile(oldName, newName);
  console.log(`Profile '${oldName}' renamed to '${newName}'.`);
});
program.addCommand(profileGroup);
registerSkills(program);
registerAll(program, {
  getClient: () => {
    client ??= new CeligoClient(config);
    return client;
  },
  getFormat: () => config.format,
  getMode: () => config.mode,
  getProfile: () => config.profile,
  getAccountAlias: () => config.accountAlias,
  getListFields: () => config.listFields
});
await initUserAgent();
try {
  await program.parseAsync(process.argv);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(chalk9.red(message));
  process.exit(1);
}
