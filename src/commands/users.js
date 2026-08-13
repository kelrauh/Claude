import { makeResourceGroup, HELP, parseIds, formatOutput, success, confirm } from "../lib/core.js";

function inviteOutcome(statusCode) {
  if (statusCode === 201) return "invited";
  if (statusCode === 400) return "already has access";
  return `status ${statusCode ?? "?"}`;
}
function registerUsers(program2, ctx) {
  const group = makeResourceGroup("users", "ashares", {
    listColumns: ["_id", "accessLevel", "accepted", "lastModified"],
    description: "Manage account users and access levels.",
    exclude: ["create"],
    integrationSubpath: "ashares",
    helpText: HELP.users,
    ...ctx
  });
  program2.addCommand(group);
  group.command("invite").description(
    "Invite one or more users to the account (POST /v1/invite/multiple).\nAccess settings apply uniformly to every email in the batch.\nAccess level strategies:\n  administrator / manage / monitor \u2192 account-wide access\n  custom (omit --access-level, use --integration) \u2192 per-integration access\nExample: celigo users invite --email a@b.com --email c@d.com --access-level monitor --force-mfa\nExample: celigo users invite --email a@b.com --integration int1=manage --mcp-server mcp1=mcp:read,mcp:write"
  ).requiredOption("--email <emails...>", "Email address(es) to invite. Repeatable.").option("--access-level <level>", "Account-wide access level (monitor, manage, administrator).").option(
    "--integration <mapping...>",
    "Per-integration access: <integrationId>=<monitor|manage>. Repeatable."
  ).option(
    "--mcp-server <mapping...>",
    "MCP server access: <mcpServerId>=<scope[,scope...]> (e.g. mcp:read,mcp:write). Repeatable."
  ).option("--force-mfa", "Require MFA for this user.").option("--force-sso", "Require SSO for this user (account must have SSO configured).").option(
    "--allow-edit-retry-data",
    "Allow editing retry data (only applicable for monitor access)."
  ).action(
    async (opts) => {
      const body = { emails: opts.email };
      if (opts.accessLevel) body.accessLevel = opts.accessLevel;
      if (opts.integration) {
        body.integrationAccessLevel = opts.integration.map((m) => {
          const [id, level] = m.split("=");
          if (!id || !level)
            throw new Error(
              `Invalid --integration format '${m}'. Use <integrationId>=<monitor|manage>.`
            );
          return { _integrationId: id, accessLevel: level };
        });
      }
      if (opts.mcpServer) {
        body.mcpServerAccessLevel = opts.mcpServer.map((m) => {
          const eq = m.indexOf("=");
          const id = eq > 0 ? m.slice(0, eq) : "";
          const scopes = eq > 0 ? m.slice(eq + 1) : "";
          if (!id || !scopes)
            throw new Error(
              `Invalid --mcp-server format '${m}'. Use <mcpServerId>=<scope[,scope...]>.`
            );
          return { _mcpServerId: id, scopes: parseIds(scopes) };
        });
      }
      if (opts.forceMfa) body.accountMFARequired = true;
      if (opts.forceSso) body.accountSSORequired = true;
      if (opts.allowEditRetryData) body.allowToEditRetryData = true;
      const result = await ctx.getClient().post("v1/invite/multiple", body);
      if (!Array.isArray(result)) {
        if (result) formatOutput(result, ctx.getFormat());
        return;
      }
      const rows = result.map((entry, i) => {
        const e = entry;
        const sharedWith = e.doc?.sharedWithUser;
        return {
          email: sharedWith?.email ?? opts.email[i] ?? "(unknown)",
          result: inviteOutcome(e.statusCode)
        };
      });
      formatOutput(rows, ctx.getFormat(), { columns: ["email", "result"], isList: true });
    }
  );
  group.command("reinvite <id>").description(
    "Re-send an invite to a user who dismissed it (PUT /v1/ashares/<id>/reinvite).\nOnly works on users with dismissed:true; they return to a pending state afterward.\n<id> is the user's access-record id (from `users list`)."
  ).action(async (id) => {
    const result = await ctx.getClient().put(`v1/ashares/${id}/reinvite`, {});
    if (result) formatOutput(result, ctx.getFormat());
    else success(`Reinvited user ${id}.`);
  });
  const setUserDisabled = async (userId, desiredDisabled, yes) => {
    const user = await ctx.getClient().get(`v1/ashares/${userId}`);
    const label = user?.email ? `${user.email} (${userId})` : userId;
    const verb = desiredDisabled ? "disabled" : "enabled";
    const currentlyDisabled = user?.disabled ?? false;
    if (currentlyDisabled === desiredDisabled) {
      success(`User ${label} is already ${verb}.`);
      return;
    }
    if (desiredDisabled && !yes && !await confirm(`Disable access for user ${label}?`)) return;
    await ctx.getClient().put(`v1/ashares/${userId}/disable`, {});
    success(`User ${label} ${verb}.`);
  };
  group.command("disable <userId>").description(
    "Disable a user's account access (no-op if already disabled). Only works on accepted users."
  ).option("-y, --yes", "Skip confirmation.").action(
    (userId, cmdOpts) => setUserDisabled(userId, true, cmdOpts.yes)
  );
  group.command("enable <userId>").description("Re-enable a disabled user's account access (no-op if already enabled).").action((userId) => setUserDisabled(userId, false));
}

export { registerUsers };
