#!/usr/bin/env node

// src/index.ts
import chalk9 from "chalk";
import { Command as Command22 } from "commander";

// src/args.ts
var ALLOW_EMPTY_REQUIRED_ARG = /* @__PURE__ */ new Set([]);
var isBlank = (v) => typeof v === "string" && v.trim() === "";
function assertRequiredArgsNonEmpty(cmd) {
  for (const [i, arg] of cmd.registeredArguments.entries()) {
    if (!arg.required || ALLOW_EMPTY_REQUIRED_ARG.has(arg.name())) continue;
    const value = cmd.processedArgs[i];
    const offending = arg.variadic ? Array.isArray(value) && value.some(isBlank) : isBlank(value);
    if (offending) {
      throw new Error(
        `The <${arg.name()}> argument is empty. Provide a non-empty value (this usually means a shell variable was unset).`
      );
    }
  }
}
function parsePositiveInt(raw, label = "--limit") {
  if (raw === void 0) return void 0;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`${label} must be a positive integer (got '${raw}').`);
  }
  return n;
}

// src/auto-skills.ts
import { existsSync as existsSync2, mkdirSync as mkdirSync2, readFileSync as readFileSync2, writeFileSync as writeFileSync2 } from "fs";
import { join as join2 } from "path";

// src/background.ts
import { spawn } from "child_process";
var GLOBAL_FLAGS_WITH_VALUE = /* @__PURE__ */ new Set(["--token", "--base-url", "--format", "--jq", "--profile"]);
function firstSubcommand(argv) {
  let i = 2;
  while (i < argv.length) {
    const arg = argv[i];
    if (!arg.startsWith("-")) return arg;
    i += GLOBAL_FLAGS_WITH_VALUE.has(arg) ? 2 : 1;
  }
  return void 0;
}
function release(child) {
  child.on("error", () => {
  });
  child.unref();
}
function spawnDetachedNode(source, stderr = "ignore") {
  release(
    spawn(process.execPath, ["-e", source], {
      detached: true,
      stdio: stderr === "inherit" ? ["ignore", "ignore", "inherit"] : "ignore"
    })
  );
}
function windowsLauncher(command, args) {
  return [
    'const{spawn}=require("node:child_process");',
    `spawn(${JSON.stringify(command)},${JSON.stringify(args)},{stdio:"ignore",shell:true,windowsHide:true})`,
    '.on("error",()=>{});'
  ].join("");
}
function spawnDetached(command, args) {
  if (process.platform === "win32") {
    spawnDetachedNode(windowsLauncher(`${command}.cmd`, args));
    return;
  }
  release(spawn(command, args, { detached: true, stdio: "ignore" }));
}

// src/commands/skills.ts
import { spawnSync } from "child_process";
import { Command } from "commander";
var SKILLS_SOURCE = "celigo/ai";
var SKILLS_CLI_PACKAGE = "skills@1.5.16";
function runSkillsCli(args) {
  const windows = process.platform === "win32";
  const result = spawnSync(windows ? "npx.cmd" : "npx", ["--yes", SKILLS_CLI_PACKAGE, ...args], {
    stdio: "inherit",
    shell: windows
  });
  if (result.error) {
    throw new Error(`Could not start the skills CLI: ${result.error.message}`);
  }
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  }
}
function appendRepeated(args, flag, values) {
  for (const value of values ?? []) args.push(flag, value);
}
function registerSkills(program2) {
  const group = new Command("skills").description(
    "Install and update agent skills from the public celigo/ai repository."
  );
  group.command("install").description("Install Celigo agent skills using the official skills CLI.").option("-g, --global", "Install for the current user instead of this project.").option("-a, --agent <agents...>", "Install for specific agent(s).").option("-s, --skill <skills...>", "Install specific skill(s).").option("-l, --list", "List available Celigo skills without installing.").option("--copy", "Copy skill files instead of creating symlinks.").option("-y, --yes", "Skip installer confirmation prompts.").option("--all", "Install all skills for all detected agents.").action((opts) => {
    const args = ["add", SKILLS_SOURCE];
    if (opts.global) args.push("--global");
    appendRepeated(args, "--agent", opts.agent);
    appendRepeated(args, "--skill", opts.skill);
    if (opts.list) args.push("--list");
    if (opts.copy) args.push("--copy");
    if (opts.yes) args.push("--yes");
    if (opts.all) args.push("--all");
    runSkillsCli(args);
  });
  group.command("list").description("List skills installed by the official skills CLI.").option("-g, --global", "List only globally installed skills.").option("-a, --agent <agents...>", "Filter by agent.").action((opts) => {
    const args = ["list"];
    if (opts.global) args.push("--global");
    appendRepeated(args, "--agent", opts.agent);
    runSkillsCli(args);
  });
  group.command("update [skills...]").description(
    "Update named installed skills. Pass --all-installed to update non-Celigo skills too."
  ).option("-g, --global", "Update only globally installed skills.").option("-p, --project", "Update only project-installed skills.").option("-y, --yes", "Skip the scope prompt.").option("--all-installed", "Update every skill managed by the official skills CLI.").action((skills, opts) => {
    const names = skills ?? [];
    if (names.length === 0 && !opts.allInstalled) {
      throw new Error(
        "Name one or more skills to update, or pass --all-installed to update every installed skill."
      );
    }
    const args = ["update", ...names];
    if (opts.global) args.push("--global");
    if (opts.project) args.push("--project");
    if (opts.yes) args.push("--yes");
    runSkillsCli(args);
  });
  program2.addCommand(group);
}

// src/config.ts
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from "fs";
import { homedir } from "os";
import { join } from "path";

// src/env.ts
function readEnv(name) {
  return process.env[name];
}
function readPositiveNumberEnv(name, fallback) {
  const raw = readEnv(name);
  if (raw === void 0 || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return value;
}
function isCIEnvironment() {
  return [
    "CI",
    "CONTINUOUS_INTEGRATION",
    "GITHUB_ACTIONS",
    "JENKINS_URL",
    "GITLAB_CI",
    "CIRCLECI",
    "BUILDKITE"
  ].some((name) => readEnv(name));
}
function getProxyUrl() {
  return readEnv("https_proxy") || readEnv("HTTPS_PROXY") || readEnv("http_proxy") || readEnv("HTTP_PROXY");
}

// src/projection.ts
var VALID_LIST_FIELDS = ["all", "default"];
var FIELDS_OPTION_FLAGS = "--fields <spec>";
var FIELDS_OPTION_DESCRIPTION = "Fields to request per row: 'default' (id, name, and the table columns), 'all' (complete documents), or a comma-separated field list (dot notation allowed).";
function parseListFields(value) {
  const normalized = value.trim().toLowerCase();
  if (!VALID_LIST_FIELDS.includes(normalized)) {
    throw new Error(
      `Invalid list_fields '${value}'. Use 'all' (complete documents) or 'default' (per-group projection).`
    );
  }
  return normalized;
}
function coerceListFields(value) {
  if (typeof value !== "string") return void 0;
  const normalized = value.trim().toLowerCase();
  return VALID_LIST_FIELDS.includes(normalized) ? normalized : void 0;
}
var IDENTITY_FIELDS = ["_id", "name"];
function defaultProjection(listColumns, extras = []) {
  return dedupe([...IDENTITY_FIELDS, ...listColumns, ...extras]);
}
function resolveListFields(opts) {
  if (opts.fields !== void 0) return fieldsFromSpec(opts.fields, opts.defaults, opts.mandatory);
  if (opts.jqActive) return void 0;
  if (opts.setting === "all") return void 0;
  return dedupe([...opts.defaults, ...opts.mandatory ?? []]);
}
function projectRows(rows, fields) {
  if (!fields || fields.length === 0 || !Array.isArray(rows)) return rows;
  const paths = dedupe([...IDENTITY_FIELDS, ...fields]).map((f) => f.split("."));
  return rows.map((row) => pickPaths(row, paths));
}
function pickPaths(row, paths) {
  if (row === null || typeof row !== "object" || Array.isArray(row)) return row;
  const source = row;
  const out = {};
  for (const path of paths) copyPath(source, out, path);
  return out;
}
function copyPath(source, target, path) {
  const [head, ...rest] = path;
  if (!(head in source)) return;
  const value = source[head];
  if (rest.length === 0) {
    target[head] = value;
    return;
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) return;
  const existing = target[head];
  const nested = existing !== null && typeof existing === "object" && !Array.isArray(existing) ? existing : {};
  copyPath(value, nested, rest);
  if (Object.keys(nested).length > 0) target[head] = nested;
}
function withListProjection(path, fields) {
  if (!fields || fields.length === 0) return path;
  const { base, params } = splitQuery(path);
  params.delete("include");
  const existing = params.toString();
  const include = `include=${fields.map((f) => encodeURIComponent(f)).join(",")}`;
  return `${base}?${existing ? `${existing}&` : ""}${include}`;
}
function withQueryParam(path, key, value) {
  const { base, params } = splitQuery(path);
  params.set(key, value);
  return `${base}?${params.toString()}`;
}
function splitQuery(path) {
  const qIdx = path.indexOf("?");
  if (qIdx === -1) return { base: path, params: new URLSearchParams() };
  return { base: path.slice(0, qIdx), params: new URLSearchParams(path.slice(qIdx + 1)) };
}
function fieldsFromSpec(spec, defaults, mandatory) {
  const normalized = spec.trim().toLowerCase();
  if (normalized === "all") return void 0;
  if (normalized === "default") return dedupe([...defaults, ...mandatory ?? []]);
  const fields = spec.split(",").map((f) => f.trim()).filter((f) => f.length > 0);
  if (fields.length === 0) {
    throw new Error(
      `Invalid --fields value '${spec}'. Use 'all', 'default', or a comma-separated field list.`
    );
  }
  return dedupe([...fields, ...mandatory ?? []]);
}
function dedupe(fields) {
  const out = [];
  for (const field of fields) {
    if (!out.includes(field)) out.push(field);
  }
  return out;
}

// src/config.ts
var DEFAULT_PROFILE = "default";
var DEFAULT_BASE_URL = "https://api.integrator.io";
function configDir() {
  return join(homedir(), ".celigo");
}
function configFile() {
  return join(configDir(), "config.json");
}
var VALID_MODES = ["read", "operate", "full"];
var DEFAULT_MODE = "full";
var GLOBAL_SETTING_KEYS = /* @__PURE__ */ new Set([
  "auto_update",
  "skills_auto_install",
  "skills_auto_install_exclude"
]);
function readConfigFile() {
  if (!existsSync(configFile())) return { active_profile: DEFAULT_PROFILE, profiles: {} };
  try {
    const raw = JSON.parse(readFileSync(configFile(), "utf-8"));
    if (raw.profiles && typeof raw.profiles === "object") {
      return {
        active_profile: raw.active_profile || DEFAULT_PROFILE,
        profiles: raw.profiles,
        // Preserved on every read — writeConfigFile round-trips this object, so dropping
        // it here would erase the global settings on the next profile write.
        settings: raw.settings
      };
    }
    const { api_token, base_url, default_format, mode, ...rest } = raw;
    const legacy = {};
    if (api_token) legacy.api_token = api_token;
    if (base_url) legacy.base_url = base_url;
    if (default_format) legacy.default_format = default_format;
    if (mode !== void 0) legacy.mode = coerceMode(mode);
    Object.assign(legacy, rest);
    return { active_profile: DEFAULT_PROFILE, profiles: { [DEFAULT_PROFILE]: legacy } };
  } catch {
    console.error(
      "Warning: Could not parse config file. Using defaults. Run 'celigo config set' to fix."
    );
    return { active_profile: DEFAULT_PROFILE, profiles: {} };
  }
}
function writeConfigFile(cfg) {
  const dir = configDir();
  mkdirSync(dir, { recursive: true });
  const target = configFile();
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(cfg, null, 2)}
`);
  chmodSync(tmp, 384);
  renameSync(tmp, target);
}
var VALID_FORMATS = /* @__PURE__ */ new Set(["json", "table"]);
function normalizeBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid API base URL '${value}'.`);
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("API base URL must use HTTPS (HTTP is allowed only for localhost).");
  }
  if (url.username || url.password) {
    throw new Error("API base URL must not contain embedded credentials.");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("API base URL must be an origin without a path, query, or fragment.");
  }
  return url.origin;
}
function coerceMode(value) {
  if (typeof value !== "string") return DEFAULT_MODE;
  const normalized = value.trim().toLowerCase();
  return VALID_MODES.includes(normalized) ? normalized : DEFAULT_MODE;
}
function parseMode(value) {
  const normalized = value.trim().toLowerCase();
  if (!VALID_MODES.includes(normalized)) {
    throw new Error(`Invalid mode '${value}'. Valid modes: ${VALID_MODES.join(", ")}.`);
  }
  return normalized;
}
function parseAccountAlias(value) {
  const alias = value.trim();
  if (!/^[a-zA-Z0-9]{5,15}$/.test(alias)) {
    throw new Error(
      `Invalid account alias '${value}'. Must be 5-15 alphanumeric characters, matching the alias in your MCP server URLs.`
    );
  }
  return alias;
}
function parseBooleanSetting(key, value) {
  const normalized = value.trim().toLowerCase();
  if (normalized !== "true" && normalized !== "false") {
    throw new Error(`Invalid value '${value}' for ${key}. Use true or false.`);
  }
  return normalized;
}
var SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function parseSkillNames(key, value) {
  const names = value.split(",").map((name) => name.trim().toLowerCase()).filter((name) => name.length > 0);
  for (const name of names) {
    if (!SKILL_NAME.test(name)) {
      throw new Error(
        `Invalid skill name '${name}' for ${key}. Use the names 'celigo skills list' reports, comma-separated.`
      );
    }
  }
  return [...new Set(names)].sort((a, b) => a.localeCompare(b)).join(",");
}
function loadConfig(opts) {
  const multi = readConfigFile();
  const resolvedProfile = opts.profile || multi.active_profile || DEFAULT_PROFILE;
  const file = multi.profiles[resolvedProfile] ?? {};
  const rawFormat = opts.format || readEnv("CELIGO_FORMAT") || file.default_format || "json";
  const format = VALID_FORMATS.has(rawFormat) ? rawFormat : "json";
  const envMode = readEnv("CELIGO_MODE");
  return {
    apiToken: opts.token || readEnv("CELIGO_API_TOKEN") || file.api_token,
    baseUrl: normalizeBaseUrl(
      opts.baseUrl || readEnv("CELIGO_BASE_URL") || file.base_url || DEFAULT_BASE_URL
    ),
    format,
    verbose: opts.verbose ?? false,
    mode: envMode === void 0 ? coerceMode(file.mode) : parseMode(envMode),
    profile: resolvedProfile,
    accountAlias: readEnv("CELIGO_ACCOUNT_ALIAS") || file.account_alias,
    listFields: coerceListFields(file.list_fields)
  };
}
function listProfiles() {
  const file = readConfigFile();
  return Object.entries(file.profiles).map(([name, config2]) => ({
    name,
    active: name === file.active_profile,
    config: config2
  }));
}
function getActiveProfile() {
  return readConfigFile().active_profile || DEFAULT_PROFILE;
}
function useProfile(name) {
  const file = readConfigFile();
  if (!file.profiles[name]) {
    throw new Error(
      `Profile '${name}' does not exist. Available: ${Object.keys(file.profiles).join(", ") || "(none)"}`
    );
  }
  file.active_profile = name;
  writeConfigFile(file);
}
function addProfile(name, config2) {
  const file = readConfigFile();
  if (file.profiles[name]) {
    throw new Error(`Profile '${name}' already exists. Use 'config set' to modify it.`);
  }
  file.profiles[name] = config2;
  if (Object.keys(file.profiles).length === 1) {
    file.active_profile = name;
  }
  writeConfigFile(file);
}
function deleteProfile(name) {
  const file = readConfigFile();
  if (!file.profiles[name]) {
    throw new Error(`Profile '${name}' does not exist.`);
  }
  if (file.active_profile === name) {
    throw new Error(
      `Cannot delete the active profile '${name}'. Switch to another profile first with 'celigo profile use <name>'.`
    );
  }
  delete file.profiles[name];
  writeConfigFile(file);
  cleanupProfileData(name);
}
function renameProfile(oldName, newName) {
  const file = readConfigFile();
  if (!file.profiles[oldName]) {
    throw new Error(`Profile '${oldName}' does not exist.`);
  }
  if (file.profiles[newName]) {
    throw new Error(`Profile '${newName}' already exists.`);
  }
  file.profiles[newName] = file.profiles[oldName];
  delete file.profiles[oldName];
  if (file.active_profile === oldName) {
    file.active_profile = newName;
  }
  writeConfigFile(file);
  renameProfileData(oldName, newName);
}
function writeConfig(key, value, profileName) {
  const file = readConfigFile();
  const name = profileName || file.active_profile || DEFAULT_PROFILE;
  if (!file.profiles[name]) file.profiles[name] = {};
  file.profiles[name][key] = value;
  writeConfigFile(file);
}
function getConfig(key, profileName) {
  const file = readConfigFile();
  const name = profileName || file.active_profile || DEFAULT_PROFILE;
  const cfg = file.profiles[name] ?? {};
  if (!key) return cfg;
  return cfg[key];
}
function getGlobalSetting(key) {
  return readConfigFile().settings?.[key];
}
function writeGlobalSetting(key, value) {
  const file = readConfigFile();
  file.settings = { ...file.settings, [key]: value };
  writeConfigFile(file);
}
function excludedSkills() {
  const names = (getGlobalSetting("skills_auto_install_exclude") ?? "").split(",").map((name) => name.trim().toLowerCase()).filter((name) => SKILL_NAME.test(name));
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}
function cleanupProfileData(name) {
  try {
    const idxFile = join(configDir(), "indexes", `${name}.json`);
    if (existsSync(idxFile)) unlinkSync(idxFile);
  } catch {
  }
  try {
    const logDir = join(configDir(), "logs", name);
    if (existsSync(logDir)) rmSync(logDir, { recursive: true });
  } catch {
  }
}
function renameProfileData(oldName, newName) {
  try {
    const idxDir = join(configDir(), "indexes");
    const oldIdx = join(idxDir, `${oldName}.json`);
    const newIdx = join(idxDir, `${newName}.json`);
    if (existsSync(oldIdx)) renameSync(oldIdx, newIdx);
  } catch {
  }
  try {
    const logsBase = join(configDir(), "logs");
    const oldLog = join(logsBase, oldName);
    const newLog = join(logsBase, newName);
    if (existsSync(oldLog)) renameSync(oldLog, newLog);
  } catch {
  }
}
function redactToken(token) {
  if (!token) return "(not set)";
  if (token.length <= 8) return "****";
  return `${token.slice(0, 4)}****${token.slice(-4)}`;
}

// src/auto-skills.ts
var RETRY_INTERVAL_MS = 24 * 60 * 60 * 1e3;
var REF_CHECK_TIMEOUT_MS = 1e4;
var STATE_FILE = "skills-state.json";
var SKILLS_REMOTE = `https://github.com/${SKILLS_SOURCE}.git`;
var SKILLS_TREE_API = `https://api.github.com/repos/${SKILLS_SOURCE}/git/trees`;
var OPT_OUT = "Opt out with CELIGO_NO_SKILLS_INSTALL=1 or 'celigo config set skills_auto_install false'.";
function announcement(excluded) {
  const scope = excluded.length ? `, skipping ${excluded.join(", ")} (skills_auto_install_exclude)` : " (same as: celigo skills install --global --all -y)";
  return `\x1B[36mceligo: installing Celigo agent skills in the background${scope}. ${OPT_OUT}\x1B[0m`;
}
var SKIPPED_SUBCOMMANDS = /* @__PURE__ */ new Set(["skills", "config"]);
function stateFile() {
  return join2(configDir(), STATE_FILE);
}
function readState() {
  try {
    return JSON.parse(readFileSync2(stateFile(), "utf-8"));
  } catch {
    return { lastAttempt: 0 };
  }
}
function writeState(state) {
  const dir = configDir();
  if (!existsSync2(dir)) mkdirSync2(dir, { recursive: true });
  writeFileSync2(stateFile(), JSON.stringify(state), "utf-8");
}
function syncProgram(excluded) {
  const base = ["--yes", SKILLS_CLI_PACKAGE, "add", SKILLS_SOURCE, "--global"];
  const allArgs = [...base, "--all", "--yes"];
  const subsetArgs = [...base, "--agent", "*", "--skill"];
  return String.raw`
const { execFileSync, spawn } = require("node:child_process");
const { readFileSync, writeFileSync } = require("node:fs");
const stateFile = ${JSON.stringify(stateFile())};
const excluded = ${JSON.stringify(excluded)};
const stamp = ${JSON.stringify(excluded.join(","))};
const read = () => { try { return JSON.parse(readFileSync(stateFile, "utf-8")); } catch { return {}; } };
let ref = null;
try {
	const out = execFileSync("git", ["ls-remote", ${JSON.stringify(SKILLS_REMOTE)}, "HEAD"], {
		encoding: "utf-8",
		timeout: ${REF_CHECK_TIMEOUT_MS},
		stdio: ["ignore", "pipe", "ignore"],
		env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
	});
	const sha = out.trim().split(/\s/)[0];
	if (/^[0-9a-f]{7,64}$/.test(sha)) ref = sha;
} catch {}
const state = read();
if (ref && ref === state.installedRef && stamp === (state.installedExclude || "")) process.exit(0);
// Every skill celigo/ai holds, minus the excluded ones. A folder holding a SKILL.md is a skill
// wherever it sits, and a name the installer does not recognize is simply ignored by it, so this
// tolerates a layout change in either direction; the slug test keeps anything that could not be a
// skill name off the Windows command line. Empty on any doubt — an unreachable API, a truncated
// tree, an exclusion of everything — and an empty selection installs nothing.
const kept = async () => {
	try {
		const url = ${JSON.stringify(SKILLS_TREE_API)} + "/" + (ref || "HEAD") + "?recursive=1";
		const response = await fetch(url, {
			headers: { accept: "application/vnd.github+json", "user-agent": "celigo-cli" },
			signal: AbortSignal.timeout(${REF_CHECK_TIMEOUT_MS}),
		});
		if (!response.ok) return [];
		const body = await response.json();
		if (body.truncated) return [];
		const names = (body.tree || [])
			.filter((entry) => entry.type === "blob" && /(^|\/)SKILL\.md$/i.test(entry.path))
			.map((entry) => (entry.path.split("/").at(-2) || "").toLowerCase())
			.filter((name) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) && !excluded.includes(name));
		return [...new Set(names)].sort();
	} catch { return []; }
};
(async () => {
	let args = ${JSON.stringify(allArgs)};
	if (excluded.length) {
		const names = await kept();
		if (names.length === 0) return;
		args = [...${JSON.stringify(subsetArgs)}, ...names, "--yes"];
	}
	console.error(${JSON.stringify(announcement(excluded))});
	const win = process.platform === "win32";
	const install = spawn(win ? "npx.cmd" : "npx", args, { stdio: "ignore", shell: win, windowsHide: true });
	install.on("error", () => {});
	install.on("exit", (code) => {
		if (code !== 0 || !ref) return;
		const next = { ...read(), installedRef: ref, installedExclude: stamp };
		try { writeFileSync(stateFile, JSON.stringify(next), "utf-8"); } catch {}
	});
})().catch(() => {});
`;
}
function autoInstallSkills(argv = process.argv) {
  try {
    if (isCIEnvironment()) return;
    if (readEnv("CELIGO_NO_SKILLS_INSTALL")) return;
    if (SKIPPED_SUBCOMMANDS.has(firstSubcommand(argv) ?? "")) return;
    if (getGlobalSetting("skills_auto_install") === "false") return;
    const state = readState();
    const now = Date.now();
    if (now - state.lastAttempt < RETRY_INTERVAL_MS) return;
    writeState({ ...state, lastAttempt: now });
    spawnDetachedNode(syncProgram(excludedSkills()), process.stderr.isTTY ? "inherit" : "ignore");
  } catch {
  }
}

// src/auto-update.ts
import { execFileSync } from "child_process";
import { constants, accessSync, existsSync as existsSync3, mkdirSync as mkdirSync3, readFileSync as readFileSync3, writeFileSync as writeFileSync3 } from "fs";
import { dirname, join as join3 } from "path";
import { fileURLToPath } from "url";
var PKG = "@celigo/celigo-cli";
var CHECK_INTERVAL_MS = 4 * 60 * 60 * 1e3;
var STATE_FILE2 = "update-state.json";
function isNewerVersion(candidate, current) {
  const parse = (version) => {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
    return match ? match.slice(1).map(Number) : void 0;
  };
  const next = parse(candidate);
  const installed = parse(current);
  if (!next || !installed) return false;
  for (let i = 0; i < next.length; i++) {
    if (next[i] !== installed[i]) return next[i] > installed[i];
  }
  return false;
}
function stateFile2() {
  return join3(configDir(), STATE_FILE2);
}
function readState2() {
  try {
    return JSON.parse(readFileSync3(stateFile2(), "utf-8"));
  } catch {
    return { lastCheck: 0, latestVersion: null };
  }
}
function writeState2(state) {
  const dir = configDir();
  if (!existsSync3(dir)) mkdirSync3(dir, { recursive: true });
  writeFileSync3(stateFile2(), JSON.stringify(state), "utf-8");
}
function npmExecutable() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}
function fetchLatestVersion() {
  try {
    const result = execFileSync(npmExecutable(), ["view", PKG, "version"], {
      encoding: "utf-8",
      timeout: 1e4,
      stdio: ["pipe", "pipe", "pipe"]
    });
    return result.trim();
  } catch {
    return null;
  }
}
function unwritableInstallDir() {
  if (process.platform === "win32") return void 0;
  const packageDir = fileURLToPath(new URL("..", import.meta.url));
  try {
    accessSync(packageDir, constants.W_OK);
    accessSync(dirname(packageDir), constants.W_OK);
    return void 0;
  } catch {
    return packageDir;
  }
}
function cyan(text) {
  return `\x1B[36m${text}\x1B[0m`;
}
function autoUpdate(currentVersion, argv = process.argv) {
  if (isCIEnvironment()) return;
  if (readEnv("CELIGO_NO_UPDATE")) return;
  if (firstSubcommand(argv) === "config") return;
  const state = readState2();
  const now = Date.now();
  if (now - state.lastCheck < CHECK_INTERVAL_MS) return;
  const latest = fetchLatestVersion();
  writeState2({ lastCheck: now, latestVersion: latest, attemptedVersion: state.attemptedVersion });
  if (!latest) return;
  if (!isNewerVersion(latest, currentVersion)) return;
  const installCommand = `npm install -g ${PKG}@${latest}`;
  if (getGlobalSetting("auto_update") === "false") {
    console.error(
      cyan(`celigo: update available ${currentVersion} \u2192 ${latest}. Run: ${installCommand}`)
    );
    return;
  }
  const blockedDir = unwritableInstallDir();
  if (blockedDir) {
    console.error(
      cyan(
        `celigo: update available ${currentVersion} \u2192 ${latest}, but ${blockedDir} is not writable by your user, so the CLI cannot update itself. Run: sudo ${installCommand}`
      )
    );
    return;
  }
  if (state.attemptedVersion && isNewerVersion(state.attemptedVersion, currentVersion)) {
    console.error(
      cyan(
        `celigo: the last background update did not apply \u2014 still on ${currentVersion}. Retrying ${currentVersion} \u2192 ${latest}; if this repeats, run it yourself: ${installCommand}`
      )
    );
  } else {
    console.error(
      cyan(
        `celigo: updating ${currentVersion} \u2192 ${latest} in the background (same as: ${installCommand}); it should apply to your next command. Opt out with CELIGO_NO_UPDATE=1 or 'celigo config set auto_update false'.`
      )
    );
  }
  writeState2({ lastCheck: now, latestVersion: latest, attemptedVersion: latest });
  spawnDetached("npm", ["install", "-g", `${PKG}@${latest}`]);
}

// src/client.ts
import { readFileSync as readFileSync5 } from "fs";
import { dirname as dirname2, resolve } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { KNOWN_AGENTS, determineAgent } from "@vercel/detect-agent";
import chalk from "chalk";
import { ProxyAgent } from "undici";

// src/error-hints.ts
function firstResourceId(endpoint) {
  if (!endpoint) return void 0;
  const path = endpoint.replace(/^\//, "").split("?")[0];
  return /^v1\/[a-zA-Z]+\/([^/]+)/.exec(path)?.[1];
}
var RULES = [
  {
    // Flow runs/retries are rejected when the flow is disabled (documented code `inactive_flow`).
    // The code is the precise signal; the message fallback (for responses without it) must name the
    // *flow* as disabled so an unrelated "the connection is disabled" on a flow endpoint can't match.
    when: (c) => c.codes.includes("inactive_flow") || /^\/?v1\/flows\//.test(c.endpoint ?? "") && /\bflow\b[^.]*\bdisabled\b/i.test(c.message),
    hint: (c) => {
      const id = firstResourceId(c.endpoint);
      return `Enable the flow first: celigo flows set ${id ?? "<id>"} disabled=false`;
    }
  },
  {
    // Account lacks an entitlement (e.g. `environments` on an account without the feature).
    when: (c) => c.codes.includes("feature_not_enabled"),
    hint: () => "This feature isn't enabled on this account. Ask your Celigo account admin to enable it."
  },
  {
    // A referenced id in the payload doesn't resolve — the single most common validation code.
    when: (c) => c.codes.includes("invalid_ref"),
    hint: () => "A referenced id in the request doesn't exist. Verify the ids you passed (e.g. _connectionId, _exportId, _importId, _flowId)."
  },
  {
    // Action restricted to the API token's own user (e.g. assigning errors to another user).
    when: (c) => c.codes.includes("access_restricted"),
    hint: () => "This action is restricted to the API token's own user."
  }
];
function hintForError(c) {
  return RULES.find((rule) => rule.when(c))?.hint(c);
}

// src/errors.ts
import {
  appendFileSync,
  chmodSync as chmodSync2,
  existsSync as existsSync4,
  mkdirSync as mkdirSync4,
  readFileSync as readFileSync4,
  statSync,
  writeFileSync as writeFileSync4
} from "fs";
import { join as join4 } from "path";
var MAX_LOG_BYTES = 1048576;
var MAX_ENTRIES_AFTER_ROTATE = 500;
var MAX_MESSAGE_LENGTH = 2e3;
function sanitizeMessage(message) {
  return message.slice(0, MAX_MESSAGE_LENGTH).replaceAll(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]").replaceAll(
    /(["']?(?:password|token|api[_-]?key|client[_-]?secret)["']?\s*[:=]\s*["']?)[^"',\s;&}]+/gi,
    "$1[REDACTED]"
  );
}
function errorLogDir(profile) {
  const p = profile || getActiveProfile();
  return join4(configDir(), "logs", p);
}
function errorLogFile(profile) {
  return join4(errorLogDir(profile), "error-log.jsonl");
}
function logError(entry, profile) {
  const p = profile || getActiveProfile();
  const dir = errorLogDir(p);
  const file = errorLogFile(p);
  try {
    mkdirSync4(dir, { recursive: true });
    const fullEntry = {
      ...entry,
      message: sanitizeMessage(entry.message),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      profile: p
    };
    appendFileSync(file, `${JSON.stringify(fullEntry)}
`);
    chmodSync2(file, 384);
    if (existsSync4(file)) {
      const stat = statSync(file);
      if (stat.size > MAX_LOG_BYTES) {
        rotateLog(file);
      }
    }
  } catch {
  }
}
function rotateLog(file) {
  try {
    const lines = readFileSync4(file, "utf-8").trim().split("\n");
    const kept = lines.slice(-MAX_ENTRIES_AFTER_ROTATE);
    writeFileSync4(file, `${kept.join("\n")}
`);
  } catch {
  }
}

// src/client.ts
var __dirname = dirname2(fileURLToPath2(import.meta.url));
var pkg = JSON.parse(readFileSync5(resolve(__dirname, "..", "package.json"), "utf-8"));
var BASE_USER_AGENT = `celigo-cli/${pkg.version}`;
var USER_AGENT = BASE_USER_AGENT;
var KNOWN_AGENT_NAMES = new Set(Object.values(KNOWN_AGENTS));
async function initUserAgent() {
  const result = await determineAgent().catch(() => null);
  const name = result?.isAgent ? result.agent.name : "";
  USER_AGENT = KNOWN_AGENT_NAMES.has(name) ? `${BASE_USER_AGENT} (${name})` : BASE_USER_AGENT;
}
var MAX_PAGES = 50;
var REQUEST_TIMEOUT_MS = 3e4;
var LONG_REQUEST_TIMEOUT_MS = 36e4;
var LONG_RUNNING_ENDPOINTS = [/\/invoke$/, /\/test\/run(\/|$)/, /\/preview$/, /\/clone(\/|$)/];
var READ_ONLY_POST_ENDPOINTS = [
  /\/published\/combined$/,
  // templates marketplace / search (browse)
  /\/exports\/preview$/,
  // ad-hoc export preview
  /\/exports\/[^/]+\/(invoke|preview)$/,
  // export invoke/preview (reads source; no Celigo write)
  /\/getData$/,
  // lookup-cache get-data
  /\/ping$/,
  // connection ping (connectivity check)
  /\/logs\/(metadata|data)\/query$/,
  // flow job log queries
  /\/ediTransactions\/query$/,
  // EDI transaction query
  /\/(files|audit)\/signedURL$/,
  // download URLs (job files, audit logs)
  /\/audit$/,
  // multi-select audit queries (POST /v1/audit and /v1/{type}/{id}/audit)
  /\/processors\/[^/]+$/
  // stateless parser/generator transforms (structuredFileParser, csvParser, …)
];
var MAX_RETRIES = 3;
var RETRY_BASE_MS = 1e3;
function assertWellFormedEndpoint(method, endpoint) {
  const path = endpoint.replace(/^\//, "").split("?")[0];
  if (path.split("/").includes("")) {
    throw new Error(
      `Cannot ${method} '${endpoint}': the request path has an empty segment, which usually means an ID argument was blank. Pass a non-empty value.`
    );
  }
}
function timeoutForEndpoint(endpoint) {
  const path = endpoint.replace(/^\//, "").split("?")[0];
  return LONG_RUNNING_ENDPOINTS.some((re) => re.test(path)) ? LONG_REQUEST_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
}
function getProxyDispatcher() {
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) return void 0;
  return new ProxyAgent(proxyUrl);
}
var CeligoClient = class {
  config;
  constructor(config2) {
    if (!config2.apiToken) {
      throw new Error(
        "No API token configured.\nSet CELIGO_API_TOKEN or run: celigo config set api_token <token>"
      );
    }
    this.config = config2;
  }
  /** The API base URL this client targets (recorded in local-tree manifests). */
  get baseUrl() {
    return this.config.baseUrl;
  }
  get headers() {
    return {
      Authorization: `Bearer ${this.config.apiToken}`,
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT
    };
  }
  async get(endpoint) {
    return this.request("GET", endpoint);
  }
  async post(endpoint, data) {
    return this.request("POST", endpoint, data ?? {});
  }
  async tryPost(endpoint, data) {
    if (this.config.mode === "read" && !isReadOnlyPost("POST", endpoint)) {
      return { ok: false, error: readOnlyMessage("POST", endpoint) };
    }
    try {
      assertWellFormedEndpoint("POST", endpoint);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    const url = `${this.config.baseUrl}/${endpoint.replace(/^\//, "")}`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutForEndpoint(endpoint));
      const response = await fetch(url, {
        method: "POST",
        headers: this.headers,
        body: data === void 0 ? void 0 : JSON.stringify(data),
        signal: controller.signal,
        dispatcher: getProxyDispatcher()
      });
      clearTimeout(timer);
      if (response.ok) {
        if (response.status === 204) return { ok: true, data: null };
        const body = await response.json();
        return { ok: true, data: body };
      }
      const text = await response.text().catch(() => "");
      let msg = `HTTP ${response.status}`;
      if (text) {
        try {
          msg = parseApiError(JSON.parse(text)).message || text;
        } catch {
          msg = text;
        }
      }
      return { ok: false, status: response.status, error: msg };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
  async put(endpoint, data, extraHeaders) {
    return this.request("PUT", endpoint, data, extraHeaders);
  }
  async patch(endpoint, data, extraHeaders) {
    return this.request("PATCH", endpoint, data, extraHeaders);
  }
  async delete(endpoint, data) {
    return this.request("DELETE", endpoint, data);
  }
  async list(endpoint) {
    return (await this.listPaged(endpoint, MAX_PAGES)).items;
  }
  /**
   * Like `list`, but with a caller-chosen page cap and an explicit truncation flag —
   * consumers that must be complete-or-fail (e.g. `celigo pull`) raise the cap and
   * hard-error on `truncated` instead of silently keeping a partial list.
   */
  async listPaged(endpoint, maxPages) {
    let response = await this.rawRequest("GET", endpoint);
    const text = await response.text();
    if (!text) return { items: [], truncated: false };
    const body = JSON.parse(text);
    if (!Array.isArray(body)) return { items: [body], truncated: false };
    const all = [...body];
    for (let i = 0; i < maxPages - 1; i++) {
      const link = response.headers.get("link") || "";
      const nextUrl = parseLinkNext(link);
      if (!nextUrl) return { items: all, truncated: false };
      const path = nextUrl.pathname.replace(/^\//, "") + nextUrl.search;
      response = await this.rawRequest("GET", path);
      const page = await response.json();
      if (!Array.isArray(page)) return { items: all, truncated: false };
      all.push(...page);
    }
    return { items: all, truncated: !!parseLinkNext(response.headers.get("link") || "") };
  }
  /**
   * Paginate an `{ <itemsKey>: [...] }` envelope via the RFC-5988 `Link` rel="next" header — the
   * scheme `GET /v1/storage/items` uses (cursor in an opaque `after=` param, rows wrapped in an
   * `items` array). `list()` can't be reused: it expects each page to be a bare array, but here each
   * page is an object envelope. Follows the `next` link's path+query against our own baseUrl (the
   * header's host may differ), accumulating `itemsKey` until no `next` link or the MAX_PAGES cap.
   */
  async listEnvelope(endpoint, itemsKey = "items") {
    return (await this.listEnvelopePaged(endpoint, MAX_PAGES, itemsKey)).items;
  }
  /**
   * `listEnvelope` with a caller-chosen page cap and an explicit truncation flag — the
   * envelope twin of `listPaged`, for complete-or-fail consumers (`celigo pull`).
   */
  async listEnvelopePaged(endpoint, maxPages, itemsKey = "items") {
    let response = await this.rawRequest("GET", endpoint);
    const all = [];
    for (let i = 0; i < maxPages; i++) {
      const text = await response.text();
      if (!text) return { items: all, truncated: false };
      const body = JSON.parse(text);
      const items = body?.[itemsKey];
      if (Array.isArray(items)) all.push(...items);
      const next = parseLinkNext(response.headers.get("link") || "");
      if (!next) return { items: all, truncated: false };
      if (i === maxPages - 1) break;
      response = await this.rawRequest("GET", next.pathname.replace(/^\//, "") + next.search);
    }
    return { items: all, truncated: true };
  }
  async listBodyPaginated(endpoint, opts) {
    const method = opts?.method ?? "GET";
    const response = method === "POST" ? await this.rawRequest("POST", endpoint, opts?.data ?? {}) : await this.rawRequest("GET", endpoint);
    if (response.status === 204) return [];
    const text = await response.text();
    if (!text) return [];
    const body = JSON.parse(text);
    const itemsKey = opts?.itemsKey ?? detectItemsKey(body);
    if (!itemsKey) return Array.isArray(body) ? body : [body];
    return this.followNextPages(body, itemsKey);
  }
  /**
   * Walk `nextPageURL` links starting from `firstBody`, accumulating each page's `itemsKey` array.
   * Stops at the first page that lacks a usable `nextPageURL`/items, a 204/empty response, or the
   * `MAX_PAGES` cap. Extracted from `listBodyPaginated` to keep that method's complexity in check.
   */
  async followNextPages(firstBody, itemsKey) {
    let body = firstBody;
    const all = [...body[itemsKey] ?? []];
    for (let i = 0; i < MAX_PAGES - 1; i++) {
      const nextUrl = body.nextPageURL;
      if (!nextUrl || typeof nextUrl !== "string") break;
      const resp = await this.rawRequest("GET", nextUrl.replace(/^\//, ""));
      if (resp.status === 204) break;
      const pageText = await resp.text();
      if (!pageText) break;
      body = JSON.parse(pageText);
      const items = body[itemsKey];
      if (!items) break;
      all.push(...items);
    }
    return all;
  }
  /**
   * Paginate a "newest-first" list endpoint via the `createdAt_lte` cursor — the only forward-paging
   * scheme `GET /v1/jobs` and `GET /v1/syncs/:id/syncJobs` actually honor (`page`/`offset` are
   * ignored; syncJobs hard-caps `pageSize` at 100). Handles both a bare-array response and a
   * `{ data, totalCount }` envelope.
   *
   * The cursor is the last row's exact `createdAt` (inclusive `_lte`), NOT `createdAt − 1 ms`:
   * subtracting a millisecond silently drops rows that share the boundary millisecond when they
   * straddle a full page. Using the inclusive value re-returns the boundary rows on the next page,
   * so we dedupe by `_id`. Stops on a short/empty page, once `limit` rows are collected, when a full
   * page yields no new rows (more rows than `pageSize` share one millisecond — unresolvable without
   * a tiebreaker), or at the `MAX_PAGES` cap; the last two report `truncated` so the caller can warn.
   */
  async listByCreatedCursor(path, opts) {
    const params = opts?.params ?? new URLSearchParams();
    if (opts?.pageSize) params.set("pageSize", String(opts.pageSize));
    const limit = opts?.limit;
    const all = [];
    const seen = /* @__PURE__ */ new Set();
    let pageSize = opts?.pageSize;
    for (let page = 0; page < MAX_PAGES; page++) {
      const rows = rowsFromResponse(await this.request("GET", withQuery(path, params)));
      if (page === 0 && !pageSize) pageSize = rows.length;
      const { added, reachedLimit } = collectNewRows(rows, all, seen, limit);
      if (reachedLimit) return { items: all, truncated: false };
      const isShortPage = pageSize ? rows.length < pageSize : rows.length === 0;
      if (isShortPage) return { items: all, truncated: false };
      if (added === 0) return { items: all, truncated: true };
      const cursor = lastCreatedAt(rows);
      if (!cursor) return { items: all, truncated: false };
      params.set("createdAt_lte", cursor);
    }
    return { items: all, truncated: true };
  }
  async request(method, endpoint, data, extraHeaders) {
    const response = await this.rawRequest(method, endpoint, data, extraHeaders);
    if (response.status === 204) return null;
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  async rawRequest(method, endpoint, data, extraHeaders) {
    if (this.config.mode === "read" && method.toUpperCase() !== "GET" && !isReadOnlyPost(method, endpoint)) {
      throw new Error(readOnlyMessage(method, endpoint));
    }
    assertWellFormedEndpoint(method, endpoint);
    const url = `${this.config.baseUrl}/${endpoint.replace(/^\//, "")}`;
    const errorContext = { method, endpoint };
    const timeoutMs = timeoutForEndpoint(endpoint);
    if (this.config.verbose) {
      console.error(chalk.dim(`  ${method} ${url}`));
    }
    let lastError;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await this.waitForRetry(attempt);
      }
      const result = await this.attemptFetch(method, url, data, extraHeaders, timeoutMs);
      if (result instanceof Error) {
        lastError = result;
        continue;
      }
      if (result.ok) return result;
      if (result.status === 429 || result.status >= 500) {
        lastError = new Error(await this.formatHttpError(result, errorContext));
        continue;
      }
      return this.handleHttpError(result, errorContext);
    }
    throw lastError ?? new Error(`Request failed after ${MAX_RETRIES} retries.`);
  }
  async waitForRetry(attempt) {
    const delay = RETRY_BASE_MS * 2 ** (attempt - 1);
    if (this.config.verbose) {
      console.error(chalk.dim(`  Retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`));
    }
    await new Promise((r) => setTimeout(r, delay));
  }
  async attemptFetch(method, url, data, extraHeaders, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        method,
        headers: { ...this.headers, ...extraHeaders },
        body: data === void 0 ? void 0 : JSON.stringify(data),
        signal: controller.signal,
        dispatcher: getProxyDispatcher()
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return new Error(`Request timed out after ${timeoutMs / 1e3}s: ${method} ${url}`);
      }
      if (err instanceof TypeError && err.message.includes("fetch")) {
        throw new Error(`Cannot reach ${this.config.baseUrl}. Check your network and base URL.`);
      }
      throw new Error(err instanceof Error ? err.message : String(err));
    } finally {
      clearTimeout(timer);
    }
  }
  async formatHttpError(response, context) {
    const status = response.status;
    let msg = `HTTP ${status}`;
    let codes = [];
    try {
      const text = await response.text();
      if (text) {
        try {
          const parsed = parseApiError(JSON.parse(text));
          if (parsed.message) msg = parsed.message;
          codes = parsed.codes;
        } catch {
          msg = text;
        }
      }
    } catch {
    }
    const messages = {
      401: "Authentication failed. Check your API token with `celigo config show`.",
      403: `Forbidden: ${msg}`,
      404: `Not found: ${msg}`,
      422: `Validation error: ${msg}`,
      429: "Rate limited. Please wait and try again."
    };
    let formatted = `(${status}): ${messages[status] ?? msg}`;
    const hint = hintForError({
      status,
      codes,
      message: msg,
      method: context?.method,
      endpoint: context?.endpoint
    });
    if (hint) formatted += `
Hint: ${hint}`;
    if (context) {
      logError({
        method: context.method,
        endpoint: context.endpoint,
        status,
        message: msg
      });
    }
    return formatted;
  }
  async handleHttpError(response, context) {
    throw new Error(await this.formatHttpError(response, context));
  }
};
function parseApiError(detail) {
  if (typeof detail === "string") return { message: detail, codes: [] };
  if (!detail || typeof detail !== "object") return { message: "", codes: [] };
  const d = detail;
  if (Array.isArray(d.errors) && d.errors.length > 0) {
    const errs = d.errors;
    const message2 = errs.map(
      (e) => typeof e === "string" ? e : e.message || e.code || JSON.stringify(e)
    ).join("; ");
    const codes2 = errs.map((e) => typeof e === "object" && e ? e.code : "").filter(Boolean);
    return { message: message2, codes: codes2 };
  }
  const message = d.message || d.error || JSON.stringify(d);
  const codes = typeof d.code === "string" ? [d.code] : [];
  return { message, codes };
}
function readOnlyMessage(method, endpoint) {
  return `Read mode: blocked ${method.toUpperCase()} ${endpoint.replace(/^\//, "")}. Switch with 'celigo config set mode operate' (or 'full'), or use a different profile.`;
}
function isReadOnlyPost(method, endpoint) {
  if (method.toUpperCase() !== "POST") return false;
  const path = `/${endpoint.replace(/^\//, "").split("?")[0]}`;
  return READ_ONLY_POST_ENDPOINTS.some((re) => re.test(path));
}
function parseLinkNext(header) {
  if (!header) return void 0;
  for (const part of header.split(",")) {
    const start = part.indexOf("<");
    const end = part.indexOf(">", start);
    if (start === -1 || end === -1) continue;
    if (!part.includes('rel="next"')) continue;
    try {
      return new URL(part.slice(start + 1, end));
    } catch {
      return void 0;
    }
  }
  return void 0;
}
function detectItemsKey(body) {
  if (!body || typeof body !== "object") return void 0;
  for (const key of ["errors", "resolved"]) {
    if (key in body) return key;
  }
  return void 0;
}
function rowsFromResponse(raw) {
  if (Array.isArray(raw)) return raw;
  const data = raw?.data;
  return Array.isArray(data) ? data : [];
}
function lastCreatedAt(rows) {
  const last = rows.at(-1);
  return last?.createdAt ?? null;
}
function rowId(row) {
  const id = row?._id;
  return typeof id === "string" ? id : void 0;
}
function collectNewRows(rows, all, seen, limit) {
  let added = 0;
  for (const row of rows) {
    const id = rowId(row);
    if (id !== void 0) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    all.push(row);
    added++;
    if (limit !== void 0 && all.length >= limit) return { added, reachedLimit: true };
  }
  return { added, reachedLimit: false };
}
function withQuery(path, params) {
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

// src/commands/account.ts
import { chmodSync as chmodSync3, existsSync as existsSync5, mkdirSync as mkdirSync5, readFileSync as readFileSync6, writeFileSync as writeFileSync5 } from "fs";
import { join as join6 } from "path";
import chalk4 from "chalk";
import { Command as Command2 } from "commander";

// src/local/refs.ts
import chalk2 from "chalk";

// src/local/types.ts
var COMMON_VOLATILE = ["lastModified", "lastExecutedAt", "debugDate", "debugUntil"];
var toolBindingRefs = (prefix) => [
  { path: `${prefix}.overrides.connections[]._id`, targetType: "connection" },
  { path: `${prefix}.overrides.connections[]._abstractId`, targetType: "connection" },
  {
    path: `${prefix}.overrides.connections[]._borrowConcurrencyFromConnectionId`,
    targetType: "connection"
  },
  { path: `${prefix}.overrides.exports[]._abstractId`, targetType: "export" },
  // A binding may also swap in a concrete export, the way `connections[]._id` swaps in a
  // concrete connection. The import side has no counterpart in the spec — it overrides an
  // abstract import's fields rather than replacing the resource — so declaring one would be
  // a claim the schema does not make.
  { path: `${prefix}.overrides.exports[]._id`, targetType: "export" },
  { path: `${prefix}.overrides.imports[]._abstractId`, targetType: "import" },
  // An overridden step can also be repointed at a different connection of its own.
  { path: `${prefix}.overrides.exports[]._connectionId`, targetType: "connection" },
  { path: `${prefix}.overrides.imports[]._connectionId`, targetType: "connection" }
];
var PROVIDER_BLOCKS = ["openai", "litellm._overrides.gemini", "litellm._overrides.anthropic"];
var promptPaths = (root) => ({
  openai: `${root}.openai.instructions`,
  gemini: `${root}.litellm._overrides.gemini.systemInstruction`,
  anthropic: `${root}.litellm._overrides.anthropic.systemInstruction`
});
var agentCapabilityRefs = (root) => PROVIDER_BLOCKS.flatMap((block) => {
  const p = `${root}.${block}`;
  return [
    { path: `${p}.tools[].tool._toolId`, targetType: "tool" },
    ...toolBindingRefs(`${p}.tools[].tool`),
    { path: `${p}.tools[].mcp._mcpConnectionId`, targetType: "connection" },
    { path: `${p}.prompts[].mcp._mcpConnectionId`, targetType: "connection" },
    // Governed read-only MCP resources, on every block: `tools`, `prompts`, and
    // `resources` all appear under openai AND under each litellm override. An earlier
    // comment here claimed resources[] was openai-only and skipped the other two —
    // wrong, and invisible because the name sweep caught `_mcpConnectionId` anyway.
    { path: `${p}.resources[].mcp._mcpConnectionId`, targetType: "connection" }
  ];
});
var IMPORT_REFS = [
  { path: "_connectionId", targetType: "connection" },
  { path: "file.fileDefinition._fileDefinitionId", targetType: "filedefinition" },
  { path: "http._asyncHelperId", targetType: "asynchelper" },
  // Wrapper adaptors run on a stack (stack-type hooks are swept by field name).
  { path: "wrapper._stackId", targetType: "stack" },
  { path: "_ediProfileId", targetType: "ediprofile" },
  // Tool-call imports (adaptorType ToolImport): a flow/api/tool step invokes a
  // tool through an import, with per-call bindings keyed by real ids. Higher-tier
  // target — the import↔tool pair is a legal cycle (see KNOWN_FORWARD_REFS), since
  // tools reference imports back via steps[].
  { path: "tool._toolId", targetType: "tool" },
  ...toolBindingRefs("tool"),
  // The agent config, at both places the platform puts it (see agentCapabilityRefs).
  ...agentCapabilityRefs("aiAgent"),
  ...agentCapabilityRefs("guardrail.aiAgent"),
  // Mapping lookups can resolve through a lookup cache — at the top level, and again
  // per transport, since each adaptor block carries its own `lookups[]`.
  { path: "lookups[]._lookupCacheId", targetType: "lookupcache" },
  { path: "http.lookups[]._lookupCacheId", targetType: "lookupcache" },
  { path: "jdbc.lookups[]._lookupCacheId", targetType: "lookupcache" },
  { path: "rdbms.lookups[]._lookupCacheId", targetType: "lookupcache" },
  { path: "wrapper.lookups[]._lookupCacheId", targetType: "lookupcache" },
  {
    path: "responseTransform.expression.rulesTwoDotZero.lookups[]._lookupCacheId",
    targetType: "lookupcache"
  },
  // See the export entry: a Celigo APIs file step's `directoryId` pathMode points at
  // a Celigo Storage folder, while the same field on other file providers is theirs.
  {
    path: "file.directory.id",
    targetType: "storage",
    when: { path: "assistant", equals: "integratorceligoapi" }
  }
];
var T = (spec) => ({
  ...spec,
  volatileStrip: [...COMMON_VOLATILE, ...spec.volatileStrip ?? []]
});
var TYPE_REGISTRY = {
  iclient: T({
    type: "iclient",
    endpoint: "iclients",
    dir: "iclients",
    tier: 1,
    refs: [],
    promote: "map"
  }),
  mcpoauthprovider: T({
    type: "mcpoauthprovider",
    endpoint: "mcpoauthproviders",
    dir: "mcp-oauth-providers",
    // Next to iclients — both are account-level OAuth registrations. The platform
    // model references nothing tree-tracked (its only ref is the owning user), so
    // any tier below mcpserver's works; providers must exist before the MCP
    // servers that reference them.
    tier: 2,
    refs: [],
    promote: "create"
  }),
  storage: T({
    type: "storage",
    // Envelope-paginated (`{ items }` + Link header) and folder-scoped
    // (`?_parentId=`) — pull walks the folder tree instead of the generic list.
    endpoint: "storage/items",
    dir: "storage",
    tier: 3,
    // PULL-ONLY: the tree mirrors Celigo Storage metadata (never file contents);
    // push refuses every storage plan item — the write path is `celigo storage
    // upload/replace/set/move/delete`, out-of-band S3 transfers included.
    pullOnly: true,
    refs: [
      // Structural: the containing folder — encoded by directory nesting, never a link.
      { path: "_parentId", targetType: "storage" },
      // Containment (unobserved non-null so far — the API returns the field but drops
      // it on create, so integration-scoped storage roots are not settable yet).
      { path: "_integrationId", targetType: "integration" }
    ],
    // size flaps with every content replace; __v bumps per write; __ancestorIds
    // duplicates the _parentId chain (the directory nesting shows it already).
    volatileStrip: ["size", "__v", "__ancestorIds"],
    promote: "skip"
  }),
  stack: T({
    type: "stack",
    endpoint: "stacks",
    dir: "stacks",
    tier: 4,
    refs: [],
    promote: "map"
  }),
  agent: T({
    type: "agent",
    endpoint: "agents",
    dir: "on-premise-agents",
    tier: 5,
    refs: [],
    volatileStrip: ["lastHeartbeatAt", "online"],
    promote: "map"
  }),
  connection: T({
    type: "connection",
    endpoint: "connections",
    dir: "connections",
    // Above scripts: an AS2 connection can reference its routing script at create time.
    tier: 7,
    refs: [
      // An iClient is named per TRANSPORT, never at the top level — that path was fiction
      // (0 of 164 live connections carried it, while 39 carried `http._iClientId` and 4
      // the deprecated `rest._iClientId`). One entry per transport the schema gives an
      // iClient, plus `rest`, the deprecated mirror of `http` that real documents still use.
      { path: "http._iClientId", targetType: "iclient" },
      { path: "rest._iClientId", targetType: "iclient" },
      { path: "mcp.http._iClientId", targetType: "iclient" },
      { path: "netsuite._iClientId", targetType: "iclient" },
      { path: "salesforce._iClientId", targetType: "iclient" },
      { path: "rdbms._iClientId", targetType: "iclient" },
      { path: "s3._iClientId", targetType: "iclient" },
      { path: "_agentId", targetType: "agent" },
      { path: "_borrowConcurrencyFromConnectionId", targetType: "connection" },
      // AS2 connections route inbound documents through a script.
      { path: "contentBasedFlowRouter._scriptId", targetType: "script" },
      // A wrapper connection runs its handler on a stack, the same way a wrapper
      // export or import does.
      { path: "wrapper._stackId", targetType: "stack" },
      // Containment edge (IA-owned connections) — structural, stripped on write.
      { path: "_integrationId", targetType: "integration" }
    ],
    volatileStrip: ["offline", "queueSize"],
    promote: "map"
  }),
  script: T({
    type: "script",
    endpoint: "scripts",
    dir: "scripts",
    tier: 6,
    // A hook script is not a leaf: it can call back into the platform, and the id it
    // calls lives inside `content` — its own source. `deepUriScan` reads the
    // `/v1/exports/<id>` form (live-observed: a script invoking a virtual export), which
    // is the only shape resolvable without executing the code. Ids passed some other way
    // — a bare string, a concatenation — are unresolvable by schema and surface through
    // findHardcodedRefs instead, reported for a human to remap.
    //
    // This points FORWARD in creation order (a script is tier 6, an export tier 11), so a
    // hook script that invokes the resource hooking it forms a cycle; topoSort defers the
    // forward half and repairs it with a fixup PUT.
    refs: [],
    deepUriScan: true,
    listOmits: ["content"],
    contentField: { path: "content", ext: ".js" },
    promote: "create"
  }),
  filedefinition: T({
    type: "filedefinition",
    endpoint: "filedefinitions",
    dir: "file-definitions",
    tier: 8,
    refs: [],
    promote: "create"
  }),
  ediprofile: T({
    type: "ediprofile",
    endpoint: "ediprofiles",
    dir: "edi-profiles",
    tier: 9,
    // Trading-partner EDI profiles carry no references to other tree resources.
    refs: [],
    promote: "create"
  }),
  lookupcache: T({
    type: "lookupcache",
    endpoint: "lookupcaches",
    dir: "lookup-caches",
    tier: 10,
    refs: [
      // Containment — the folder nesting IS the edge, so it never becomes a link.
      { path: "_integrationId", targetType: "integration" },
      { path: "_stackId", targetType: "stack" }
    ],
    // size/sizeInMB flap with every data write; the sibling .data.json carries the signal.
    volatileStrip: ["size", "sizeInMB"],
    promote: "create"
  }),
  export: T({
    type: "export",
    endpoint: "exports",
    dir: "exports",
    tier: 11,
    refs: [
      { path: "_connectionId", targetType: "connection" },
      // The file definition is named at two paths: the modern one, and the `simple`
      // adaptor's own copy.
      { path: "file.fileDefinition._fileDefinitionId", targetType: "filedefinition" },
      { path: "simple.file.fileDefinition._fileDefinitionId", targetType: "filedefinition" },
      { path: "http._asyncHelperId", targetType: "asynchelper" },
      // A wrapper adaptor runs on a stack. Stack-filled HOOK slots are a different
      // thing, walked at any depth beside their `_scriptId` twin — see refs.ts pass 2.
      //
      // Spec-declared but INERT here: the platform sources a wrapper's stack from the
      // wrapper CONNECTION, and drops this field on create (live-verified) — 0 of 5,382
      // live exports/imports across two accounts carry one, while the connection's
      // `wrapper._stackId` persists. Kept because the schema declares it, so a document
      // that does carry one still links and remaps; the real edge is on the connection.
      { path: "wrapper._stackId", targetType: "stack" },
      // B2B: the trading-partner EDI profile, and the post-parse listener chain
      // (an export handing parsed documents to another listener export).
      { path: "_ediProfileId", targetType: "ediprofile" },
      { path: "_postParseListenerId", targetType: "export" },
      // Transformation 2.0 lookups can resolve through a lookup cache. `rulesTwoDotZero` is
      // an OBJECT holding `lookups[]`, not an array — the stray `[]` made this path match
      // nothing (live: 3 exports carry it at the corrected path).
      {
        path: "transform.expression.rulesTwoDotZero.lookups[]._lookupCacheId",
        targetType: "lookupcache"
      },
      // A Celigo APIs (assistant `integratorceligoapi`) file/blob step addresses Celigo
      // Storage; in `directoryId` pathMode `file.directory.id` IS a storage item id
      // (live-verified). The SAME field on a googledrive/box/dropbox assistant holds
      // the provider's own folder id, so the guard is load-bearing — without it the
      // tree would fabricate links and promote would remap a foreign id.
      {
        path: "file.directory.id",
        targetType: "storage",
        when: { path: "assistant", equals: "integratorceligoapi" }
      }
    ],
    deepUriScan: true,
    promote: "create"
  }),
  import: T({
    type: "import",
    endpoint: "imports",
    dir: "imports",
    tier: 12,
    refs: IMPORT_REFS,
    deepUriScan: true,
    promote: "create"
  }),
  // AI agents and guardrails: `/v1/imports` rows the platform treats as their own
  // resource kind, so the tree does too (see TypeSpec.variant). Same tier and the same
  // reference set as a plain import — they are import documents, and both carry the
  // `_connectionId` (a BYOK provider connection) and `lookups[]` that set declares.
  aiagent: T({
    type: "aiagent",
    endpoint: "imports",
    dir: "ai-agents",
    tier: 12,
    variant: { of: "import", adaptorType: "AiAgentImport" },
    refs: IMPORT_REFS,
    deepUriScan: true,
    textPayload: {
      file: "instructions.md",
      discriminator: "aiAgent.provider",
      paths: promptPaths("aiAgent")
    },
    promote: "create"
  }),
  guardrail: T({
    type: "guardrail",
    endpoint: "imports",
    dir: "guardrails",
    tier: 12,
    variant: { of: "import", adaptorType: "GuardrailImport" },
    refs: IMPORT_REFS,
    deepUriScan: true,
    // Only an `ai_agent` guardrail has a prompt; a pii/moderation one has no matching path,
    // so nothing is extracted and no file appears.
    textPayload: {
      file: "instructions.md",
      discriminator: "guardrail.aiAgent.provider",
      paths: promptPaths("guardrail.aiAgent")
    },
    promote: "create"
  }),
  asynchelper: T({
    type: "asynchelper",
    endpoint: "asynchelpers",
    dir: "async-helpers",
    tier: 13,
    refs: [
      { path: "http.status._exportId", targetType: "export" },
      { path: "http.result._exportId", targetType: "export" },
      { path: "http.result._importId", targetType: "import" },
      // The submit transform can resolve through a lookup cache, like any mapping.
      {
        path: "http.submit.transform.expression.rulesTwoDotZero.lookups[]._lookupCacheId",
        targetType: "lookupcache"
      },
      // Containment edge (IA-owned helpers) — structural, exempt from tier ordering.
      { path: "_integrationId", targetType: "integration" }
    ],
    promote: "create"
  }),
  integration: T({
    type: "integration",
    endpoint: "integrations",
    dir: "integrations",
    tier: 14,
    refs: [
      { path: "_registeredConnectionIds[]", targetType: "connection" },
      { path: "_registeredLookupCacheIds[]", targetType: "lookupcache" },
      // Connector (IA) lifecycle steps — declared so the sweep stays warning-free on
      // IA accounts and closures include the referenced resources. The schema carries
      // FIVE of these blocks, not one: `install[]` (the legacy array) plus the
      // per-phase `installSteps[]`, `uninstallSteps[]`, `changeEditionSteps[]`, and
      // the single-step `initChild` / `update` objects.
      { path: "install[]._connectionId", targetType: "connection" },
      { path: "install[]._stackId", targetType: "stack" },
      { path: "install[]._scriptId", targetType: "script" },
      { path: "installSteps[]._connectionId", targetType: "connection" },
      { path: "uninstallSteps[]._connectionId", targetType: "connection" },
      { path: "changeEditionSteps[]._connectionId", targetType: "connection" },
      // NOT declared: `installSteps[].sourceConnection._id`. That array is install-WIZARD
      // state (its entries carry `completed: false`) recording which connection the
      // clone/install flow would reuse — provenance, not a runtime dependency, like
      // `_sourceId` and an IA's `externalId`. Nothing reads it at run time, so promote has
      // no reason to remap it. It is invisible to the field-name sweep anyway (the field is
      // `_id`, which is a document's OWN id everywhere else), so leaving it undeclared
      // costs no warning noise — unlike `install[]` above, whose `_connectionId` the sweep
      // would flag on every pull.
      // Integration aliases, the same shape flows use: a stable name for a resource so
      // handlebars and scripts can reach it without hardcoding an id. Live-observed
      // naming connections, flows, exports, and lookup caches.
      { path: "aliases[]._connectionId", targetType: "connection" },
      { path: "aliases[]._exportId", targetType: "export" },
      { path: "aliases[]._importId", targetType: "import" },
      { path: "aliases[]._flowId", targetType: "flow" },
      { path: "aliases[]._lookupCacheId", targetType: "lookupcache" }
    ],
    // _registeredConnectionIds is read-only (re-registered after promote via
    // PUT /v1/integrations/{id}/connections/register); flowGroupings must round-trip —
    // a full PUT without it wipes every flow group.
    readOnlyOnWrite: ["_registeredConnectionIds", "_registeredLookupCacheIds"],
    neverStrip: ["flowGroupings"],
    promote: "create"
  }),
  flow: T({
    type: "flow",
    endpoint: "flows",
    dir: "flows",
    // Instance flows are hidden from the plain list; this (observed-working, not yet
    // in the published spec) flag surfaces them as their sparse docs.
    listQuery: "includeInstances=true",
    tier: 15,
    // numInstances flaps with instance lifecycle and is read-only on write.
    volatileStrip: ["logging.debugUntil", "numInstances"],
    // The abstract's property-picker metadata is writable — a full PUT without it
    // would wipe the picker, so it must round-trip from the file.
    neverStrip: ["overridesHelper"],
    refs: [
      { path: "_integrationId", targetType: "integration" },
      { path: "pageGenerators[]._exportId", targetType: "export" },
      // Delta page generators can order themselves behind another flow/export.
      { path: "pageGenerators[]._keepDeltaBehindFlowId", targetType: "flow" },
      { path: "pageGenerators[]._keepDeltaBehindExportId", targetType: "export" },
      { path: "pageProcessors[]._exportId", targetType: "export" },
      { path: "pageProcessors[]._importId", targetType: "import" },
      { path: "routers[].branches[].pageProcessors[]._exportId", targetType: "export" },
      { path: "routers[].branches[].pageProcessors[]._importId", targetType: "import" },
      // Flow chaining: run these flows when this one completes. The legacy shape is
      // a bare flow-id array; the newer one pairs the flow with a specific listener
      // export. Both also exist under instance `overrides`.
      { path: "_runNextFlowIds[]", targetType: "flow" },
      { path: "_runNextExportIds[]._flowId", targetType: "flow" },
      { path: "_runNextExportIds[]._exportId", targetType: "export" },
      { path: "overrides._runNextFlowIds[]", targetType: "flow" },
      { path: "overrides._runNextExportIds[]._flowId", targetType: "flow" },
      { path: "overrides._runNextExportIds[]._exportId", targetType: "export" },
      // Legacy single-step flows predate pageGenerators/pageProcessors.
      { path: "_exportId", targetType: "export" },
      { path: "_importId", targetType: "import" },
      { path: "_keepDeltaBehindFlowId", targetType: "flow" },
      { path: "_keepDeltaBehindExportId", targetType: "export" },
      // Flow aliases name a resource for handlebars/script lookups by alias id.
      { path: "aliases[]._connectionId", targetType: "connection" },
      { path: "aliases[]._exportId", targetType: "export" },
      { path: "aliases[]._importId", targetType: "import" },
      { path: "aliases[]._flowId", targetType: "flow" },
      { path: "aliases[]._lookupCacheId", targetType: "lookupcache" },
      // Multi-instance (abstract/instance) flows: the instance → parent edge, and the
      // component references buried in `overrides`/`overridesHelper`. `_abstractId`
      // values are the REAL ids of components in the parent's graph, and `_id` inside
      // overrides.connections[] swaps in a concrete connection — the heuristic sweep
      // cannot type either, so they are declared. Abstracts cannot reference other
      // abstracts, so the flow→flow edge cannot cycle.
      { path: "_abstractFlowId", targetType: "flow" },
      { path: "overrides.connections[]._id", targetType: "connection" },
      {
        path: "overrides.connections[]._borrowConcurrencyFromConnectionId",
        targetType: "connection"
      },
      { path: "overrides.exports[]._abstractId", targetType: "export" },
      { path: "overrides.exports[]._id", targetType: "export" },
      { path: "overrides.exports[]._connectionId", targetType: "connection" },
      { path: "overrides.exports[]._keepDeltaBehindFlowId", targetType: "flow" },
      { path: "overrides.exports[]._keepDeltaBehindExportId", targetType: "export" },
      {
        path: "overrides.exports[].file.fileDefinition._fileDefinitionId",
        targetType: "filedefinition"
      },
      { path: "overrides.imports[]._abstractId", targetType: "import" },
      { path: "overrides.imports[]._id", targetType: "import" },
      { path: "overrides.imports[]._connectionId", targetType: "connection" },
      {
        path: "overrides.imports[].file.fileDefinition._fileDefinitionId",
        targetType: "filedefinition"
      },
      { path: "overridesHelper.connections[]._abstractId", targetType: "connection" },
      { path: "overridesHelper.exports[]._abstractId", targetType: "export" },
      { path: "overridesHelper.imports[]._abstractId", targetType: "import" }
    ],
    promote: "create"
  }),
  sync: T({
    type: "sync",
    endpoint: "syncs",
    dir: "syncs",
    tier: 16,
    refs: [
      // Containment — a sync can only live inside a syncs:true integration.
      { path: "_integrationId", targetType: "integration" },
      // The replication pair: source application connection → destination warehouse
      // connection (create shape live-verified: `source: { _connectionId }`).
      { path: "source._connectionId", targetType: "connection" },
      { path: "destination._connectionId", targetType: "connection" }
    ],
    // Runtime state (lastExecutedAt) is covered by the common volatile set; the rest
    // of the doc is configuration.
    // PUT /v1/syncs/:id rejects _id/_userId echoes and refuses _integrationId even
    // when unchanged (live-verified in the CLI's `syncs set` sanitizer); the CREATE
    // body requires _integrationId, so these strip on update only.
    readOnlyOnUpdate: ["_id", "_userId", "_integrationId"],
    promote: "create"
  }),
  tool: T({
    type: "tool",
    endpoint: "tools",
    dir: "tools",
    tier: 17,
    // A tool's steps live in a router/branch tree, like a flow's routers — `steps[]` was
    // never a real field on any tool document. Note the difference from `api`, which nests
    // the same structure one level down under `builder`: a tool's `routers[]` is top-level.
    refs: [
      { path: "_integrationId", targetType: "integration" },
      { path: "routers[].branches[].pageProcessors[]._exportId", targetType: "export" },
      { path: "routers[].branches[].pageProcessors[]._importId", targetType: "import" },
      // A tool's input mapping can resolve through a lookup cache.
      {
        path: "input.transform.expression.rulesTwoDotZero.lookups[]._lookupCacheId",
        targetType: "lookupcache"
      }
    ],
    promote: "create"
  }),
  api: T({
    type: "api",
    endpoint: "apis",
    dir: "apis",
    tier: 18,
    // An API's steps are NOT shaped like a flow's, which is what these paths used to
    // claim. A builder API nests them under `builder`, one router level deeper —
    // `builder.routers[].branches[].pageProcessors[]` — and an API has no
    // `pageGenerators` at all (its request IS the trigger). The old top-level
    // `pageGenerators[]`/`pageProcessors[]` paths matched nothing on any real document;
    // the refs survived only because the field-NAME sweep catches `_exportId` and
    // `_importId` wherever they sit, silently, since the drift note keys on the name and
    // these very entries declared it. Script-mode APIs reference their script instead,
    // at `script._scriptId` plus a top-level `_scriptId` mirror — both found by the
    // deep handler walk.
    refs: [
      { path: "_integrationId", targetType: "integration" },
      { path: "builder.routers[].branches[].pageProcessors[]._exportId", targetType: "export" },
      { path: "builder.routers[].branches[].pageProcessors[]._importId", targetType: "import" }
    ],
    promote: "create"
  }),
  mcpserver: T({
    type: "mcpserver",
    endpoint: "mcpServers",
    dir: "mcp-servers",
    tier: 19,
    // Live documents carry `tools[]`/`apis[]` (the older `toolMap` shape no longer
    // appears) plus per-tool connection overrides keyed by real ids.
    // `resources[]` exposes Celigo Storage FILES to MCP clients; the published
    // McpResource schema names exactly one reference field, `_fileId`
    // (`x-celigo-refModel: storageitems`, required — folder ids are rejected with
    // 422 mcp_server_file_not_found), alongside `title` and `disabled`. An
    // unanticipated shape still surfaces via the heuristic sweep.
    refs: [
      { path: "_integrationId", targetType: "integration" },
      { path: "tools[]._toolId", targetType: "tool" },
      ...toolBindingRefs("tools[]"),
      { path: "apis[]._apiId", targetType: "api" },
      { path: "oauth._mcpOAuthProviderId", targetType: "mcpoauthprovider" },
      { path: "resources[]._fileId", targetType: "storage" }
    ],
    promote: "create"
  })
};
var ENDPOINT_TYPES = new Map(
  Object.values(TYPE_REGISTRY).filter((t) => !t.variant && !t.endpoint.includes("/")).map((t) => [t.endpoint, t.type])
);
function typeForEndpoint(collection) {
  return ENDPOINT_TYPES.get(collection);
}
function variantsOf(type) {
  return Object.values(TYPE_REGISTRY).filter((t) => t.variant?.of === type);
}
var KNOWN_FORWARD_REFS = new Set(
  [
    "export\u2192asynchelper",
    "import\u2192asynchelper",
    "import\u2192tool",
    "integration\u2192flow",
    "script\u2192export",
    "script\u2192import"
  ].flatMap((edge) => {
    const [from, to] = edge.split("\u2192");
    return [edge, ...variantsOf(from).map((v) => `${v.type}\u2192${to}`)];
  })
);
var REF_FIELD_TYPES = {
  _connectionId: "connection",
  _exportId: "export",
  _importId: "import",
  _scriptId: "script",
  _stackId: "stack",
  _iClientId: "iclient",
  _agentId: "agent",
  _integrationId: "integration",
  _flowId: "flow",
  _abstractFlowId: "flow",
  _toolId: "tool",
  _apiId: "api",
  _fileDefinitionId: "filedefinition",
  _asyncHelperId: "asynchelper",
  _lookupCacheId: "lookupcache",
  _ediProfileId: "ediprofile",
  _mcpOAuthProviderId: "mcpoauthprovider",
  // Celigo Storage items (metadata mirrored under storage/; see the mcpserver note).
  _storageItemId: "storage",
  _storageFileId: "storage",
  // B2B: an export handing parsed documents to another listener export.
  _postParseListenerId: "export",
  // AI-agent imports reference MCP servers' connections at several depths.
  _mcpConnectionId: "connection",
  // Delta steps can order themselves behind a flow/export (flow doc, pageGenerators,
  // and instance overrides).
  _keepDeltaBehindFlowId: "flow",
  _keepDeltaBehindExportId: "export"
};
var REF_ARRAY_FIELD_TYPES = {
  _registeredConnectionIds: "connection",
  _registeredLookupCacheIds: "lookupcache",
  _runNextFlowIds: "flow"
};

// src/local/refs.ts
var esc = (seg) => String(seg).replaceAll("~", "~0").replaceAll("/", "~1");
function walkDeclaredPath(node, segments, pointer, spec, out) {
  if (node === null || node === void 0) return;
  if (segments.length === 0) {
    if (typeof node === "string" && node) out.push({ pointer, type: spec.targetType, id: node });
    return;
  }
  const [head, ...rest] = segments;
  if (head.endsWith("[]")) {
    const arr = node[head.slice(0, -2)];
    if (!Array.isArray(arr)) return;
    for (const [i, item] of arr.entries()) {
      walkDeclaredPath(item, rest, `${pointer}/${esc(head.slice(0, -2))}/${i}`, spec, out);
    }
  } else {
    walkDeclaredPath(node[head], rest, `${pointer}/${esc(head)}`, spec, out);
  }
}
var SKIPPED_SUBTREES = /* @__PURE__ */ new Set([
  "mockOutput",
  "mockResponse",
  "sampleData",
  "sampleResponseData"
]);
function deepWalk(node, pointer, visit) {
  if (Array.isArray(node)) {
    for (const [i, v] of node.entries()) deepWalk(v, `${pointer}/${i}`, visit);
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    if (SKIPPED_SUBTREES.has(k)) continue;
    deepWalkField(k, v, pointer, visit);
  }
}
function deepWalkField(k, v, pointer, visit) {
  if (typeof v === "string") {
    if (v) visit(k, v, `${pointer}/${esc(k)}`);
    return;
  }
  if (Array.isArray(v) && REF_ARRAY_FIELD_TYPES[k]) {
    for (const [i, item] of v.entries()) {
      if (typeof item === "string" && item) visit(k, item, `${pointer}/${esc(k)}/${i}`);
    }
    return;
  }
  deepWalk(v, `${pointer}/${esc(k)}`, visit);
}
var URI_REF_PATTERN = /(?:^|\/)v1\/([a-z]+)\/([0-9a-f]{24})/g;
function walkStrings(node, pointer, visit) {
  if (typeof node === "string") {
    if (node) visit(node, pointer);
  } else if (Array.isArray(node)) {
    for (const [i, v] of node.entries()) walkStrings(v, `${pointer}/${i}`, visit);
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (SKIPPED_SUBTREES.has(k)) continue;
      walkStrings(v, `${pointer}/${esc(k)}`, visit);
    }
  }
}
function collectUriRefs(doc, out) {
  walkStrings(doc, "", (value, pointer) => {
    if (!value.includes("v1/")) return;
    for (const match of value.matchAll(URI_REF_PATTERN)) {
      const target = typeForEndpoint(match[1]);
      if (target) out.push({ pointer, type: target, id: match[2], embedded: true });
    }
  });
}
var warnedUndeclared = /* @__PURE__ */ new Set();
function valueAtDottedPath(doc, path) {
  let cur = doc;
  for (const seg of path.split(".")) {
    if (cur === null || typeof cur !== "object") return void 0;
    cur = cur[seg];
  }
  return cur;
}
function guardPasses(doc, ref) {
  if (!ref.when) return true;
  const actual = valueAtDottedPath(doc, ref.when.path);
  const { equals } = ref.when;
  return Array.isArray(equals) ? equals.includes(actual) : actual === equals;
}
var HANDLER_FIELD_TYPES = {
  _scriptId: "script",
  _stackId: "stack"
};
function extractRefs(type, doc) {
  const spec = TYPE_REGISTRY[type];
  const out = [];
  for (const ref of spec.refs) {
    if (!guardPasses(doc, ref)) continue;
    walkDeclaredPath(doc, ref.path.split("."), "", ref, out);
  }
  const declared = new Set(out.map((r) => r.pointer));
  deepWalk(doc, "", (key, value, pointer) => {
    if (declared.has(pointer)) return;
    const handler = HANDLER_FIELD_TYPES[key];
    if (handler) {
      out.push({ pointer, type: handler, id: value });
      return;
    }
    const target = REF_FIELD_TYPES[key] ?? REF_ARRAY_FIELD_TYPES[key];
    if (!target) return;
    out.push({ pointer, type: target, id: value });
    const warnKey = `${type}:${key}`;
    if (!warnedUndeclared.has(warnKey) && !spec.refs.some((r) => r.path.endsWith(key))) {
      warnedUndeclared.add(warnKey);
      console.error(
        chalk2.yellow(
          `note: ${type} documents carry an undeclared reference field '${key}' (at ${pointer}) \u2014 captured, but consider declaring it in the type registry.`
        )
      );
    }
  });
  if (spec.deepUriScan) collectUriRefs(doc, out);
  const seen = /* @__PURE__ */ new Set();
  return out.filter((r) => {
    const k = `${r.pointer}|${r.type}|${r.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// src/output.ts
import chalk3 from "chalk";

// src/jq.ts
import { execFileSync as execFileSync2 } from "child_process";
import { createRequire } from "module";
import { platform } from "os";
import { dirname as dirname3, join as join5 } from "path";
var nodeRequire = createRequire(import.meta.url);
var cachedBinPath = null;
function resolveJqBinary() {
  if (cachedBinPath) return cachedBinPath;
  const pkgPath = nodeRequire.resolve("node-jq/package.json");
  cachedBinPath = join5(dirname3(pkgPath), "bin", platform() === "win32" ? "jq.exe" : "jq");
  return cachedBinPath;
}
function applyJq(value, expression) {
  const binPath = resolveJqBinary();
  const input = JSON.stringify(value ?? null);
  let output;
  try {
    output = execFileSync2(binPath, [expression], {
      input,
      encoding: "utf-8",
      maxBuffer: 64 * 1024 * 1024,
      env: {},
      stdio: ["pipe", "pipe", "pipe"]
    });
  } catch (err) {
    const e = err;
    let stderr = "";
    if (typeof e.stderr === "string") {
      stderr = e.stderr;
    } else if (e.stderr) {
      stderr = e.stderr.toString("utf-8");
    }
    const message = stderr.trim() || e.message?.trim() || "unknown error";
    throw new Error(`jq: ${message}`);
  }
  return parseJqOutput(output);
}
function parseJqOutput(raw) {
  let end = raw.length;
  while (end > 0 && raw[end - 1] === "\n") end--;
  const trimmed = raw.slice(0, end);
  if (!trimmed) return void 0;
  try {
    return JSON.parse(trimmed);
  } catch {
  }
  const lines = trimmed.split("\n");
  const parsed = [];
  for (const line of lines) {
    try {
      parsed.push(JSON.parse(line));
    } catch {
      return trimmed;
    }
  }
  return parsed.length === 1 ? parsed[0] : parsed;
}

// src/output.ts
var activeJqExpression;
function setJqExpression(expression) {
  activeJqExpression = expression?.trim() || void 0;
}
function isJqActive() {
  return activeJqExpression !== void 0;
}
function transform(data) {
  if (!activeJqExpression) return { data, raw: false };
  const result = applyJq(data, activeJqExpression);
  return { data: result, raw: typeof result === "string" };
}
function applyActiveTransform(data) {
  const { data: transformed, raw } = transform(data);
  if (raw) {
    console.log(transformed);
    return { done: true };
  }
  if (transformed === void 0) return { done: true };
  return { done: false, value: transformed };
}
function toDisplayString(value) {
  if (value == null) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[Circular]";
    }
  }
  return `${value}`;
}
function jsonIndent() {
  return process.stdout.isTTY ? 2 : 0;
}
function printJsonValue(data) {
  try {
    console.log(JSON.stringify(data, null, jsonIndent()));
  } catch {
    console.error(chalk3.yellow("Warning: Data contains circular references. Printing flat keys."));
    if (data && typeof data === "object") {
      const safe = {};
      for (const [k, v] of Object.entries(data)) {
        try {
          JSON.stringify(v);
          safe[k] = v;
        } catch {
          safe[k] = "[Circular]";
        }
      }
      console.log(JSON.stringify(safe, null, jsonIndent()));
    } else {
      console.log(String(data));
    }
  }
}
function printJson(data) {
  const t = applyActiveTransform(data);
  if (t.done) return;
  printJsonValue(t.value);
}
function printTable(items, columns) {
  if (items.length === 0) {
    console.log(chalk3.dim("No results."));
    return;
  }
  const termWidth = process.stdout.columns || 120;
  const maxColWidth = Math.min(Math.max(Math.floor(termWidth / columns.length) - 3, 20), 60);
  const widths = columns.map(
    (col) => Math.max(
      col.length,
      ...items.map((item) => {
        return Math.min(toDisplayString(item[col]).length, maxColWidth);
      })
    )
  );
  const divider = widths.map((w) => "\u2500".repeat(w + 2)).join("\u253C");
  const header = columns.map((col, i) => ` ${chalk3.bold(col.padEnd(widths[i]))} `).join("\u2502");
  console.log(header);
  console.log(divider);
  for (const item of items) {
    const row = columns.map((col, i) => {
      let val = toDisplayString(item[col]);
      if (val.length > maxColWidth) val = `${val.slice(0, maxColWidth - 3)}...`;
      return ` ${val.padEnd(widths[i])} `;
    }).join("\u2502");
    console.log(row);
  }
}
function printDetail(item) {
  const maxKey = Math.max(...Object.keys(item).map((k) => k.length));
  for (const [key, value] of Object.entries(item)) {
    let display;
    if (typeof value === "object" && value !== null) {
      try {
        display = JSON.stringify(value, null, 2);
      } catch {
        display = "[Circular]";
      }
    } else {
      display = toDisplayString(value);
    }
    console.log(`${chalk3.bold(key.padEnd(maxKey))}  ${display}`);
  }
}
function formatOutput(data, format, opts) {
  const t = applyActiveTransform(data);
  if (t.done) return;
  const transformed = t.value;
  if (format === "json") {
    printJsonValue(transformed);
    return;
  }
  if (opts?.isList) {
    const items = Array.isArray(transformed) ? transformed : [transformed];
    printTable(
      items,
      opts.columns ?? autoColumns(items)
    );
  } else if (Array.isArray(transformed)) {
    printTable(transformed, opts?.columns ?? autoColumns(transformed));
  } else if (transformed && typeof transformed === "object") {
    printDetail(transformed);
  } else {
    printJsonValue(transformed);
  }
}
function autoColumns(items) {
  if (items.length === 0) return [];
  const preferred = ["_id", "name", "_integrationId", "disabled", "lastModified"];
  const first = items[0];
  if (first == null || typeof first !== "object") return [];
  const cols = preferred.filter((c) => c in first);
  return cols.length > 0 ? cols : Object.keys(first).slice(0, 5);
}
function success(message) {
  console.error(chalk3.green(message));
}

// src/commands/account.ts
var STALE_THRESHOLD_MS = readPositiveNumberEnv("CELIGO_INDEX_STALE_MINUTES", 15) * 60 * 1e3;
function indexDir() {
  return join6(configDir(), "indexes");
}
function indexFile(profile) {
  return join6(indexDir(), `${profile}.json`);
}
var RESOURCE_TYPES = [
  { name: "integration", endpoint: "integrations" },
  { name: "flow", endpoint: "flows" },
  { name: "connection", endpoint: "connections" },
  { name: "export", endpoint: "exports" },
  { name: "import", endpoint: "imports" },
  { name: "script", endpoint: "scripts" },
  { name: "stack", endpoint: "stacks" },
  { name: "api", endpoint: "apis" },
  { name: "iclient", endpoint: "iclients" }
];
function buildGraph(resources) {
  const uses = {};
  const usedBy = {};
  const addEdge = (from, to) => {
    if (!uses[from]) uses[from] = [];
    if (!uses[from].includes(to)) uses[from].push(to);
    if (!usedBy[to]) usedBy[to] = [];
    if (!usedBy[to].includes(from)) usedBy[to].push(from);
  };
  for (const type of ["flow", "export", "import"]) {
    for (const record of resources[type] ?? []) {
      for (const ref of extractRefs(type, record)) {
        addEdge(`${type}:${record._id}`, `${ref.type}:${ref.id}`);
      }
    }
  }
  return { uses, usedBy };
}
function loadIndex(profile) {
  const file = indexFile(profile);
  const legacyFile = join6(configDir(), "account-index.json");
  if (existsSync5(file)) {
    try {
      return JSON.parse(readFileSync6(file, "utf-8"));
    } catch {
      return null;
    }
  }
  if (profile === "default" && existsSync5(legacyFile)) {
    try {
      const index = JSON.parse(readFileSync6(legacyFile, "utf-8"));
      saveIndex(index, profile);
      return index;
    } catch {
      return null;
    }
  }
  return null;
}
function saveIndex(index, profile) {
  const dir = indexDir();
  const file = indexFile(profile);
  mkdirSync5(dir, { recursive: true });
  writeFileSync5(file, `${JSON.stringify(index, null, 2)}
`);
  chmodSync3(file, 384);
}
function requireIndex(profile) {
  const index = loadIndex(profile);
  if (!index) {
    throw new Error("No account index found. Run `celigo account snapshot` first.");
  }
  return index;
}
function isIndexStale(profile) {
  const index = loadIndex(profile);
  if (!index) return true;
  return Date.now() - new Date(index.timestamp).getTime() > STALE_THRESHOLD_MS;
}
async function runSnapshot(ctx) {
  const profile = ctx.getProfile();
  const client2 = ctx.getClient();
  console.error(chalk4.dim("Fetching resources..."));
  const settled = await Promise.allSettled(
    RESOURCE_TYPES.map(async ({ name, endpoint }) => {
      const items = await client2.list(`v1/${endpoint}`);
      console.error(chalk4.dim(`  ${name}: ${items.length}`));
      return { name, items };
    })
  );
  const results = [];
  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    if (s.status === "fulfilled") {
      results.push(s.value);
    } else {
      const rName = RESOURCE_TYPES[i].name;
      console.error(chalk4.yellow(`  ${rName}: failed (${s.reason})`));
      results.push({ name: rName, items: [] });
    }
  }
  const resources = {};
  for (const { name, items } of results) {
    resources[name] = items;
  }
  const graph = buildGraph(resources);
  const index = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    resources,
    graph
  };
  saveIndex(index, profile);
  return index;
}
async function ensureFreshIndex(ctx) {
  const p = ctx.getProfile();
  if (!isIndexStale(p)) return;
  const index = loadIndex(p);
  const staleNote = index ? `Account index is stale (last updated: ${index.timestamp}). Refreshing...` : "No account index found. Building...";
  console.error(chalk4.dim(staleNote));
  await runSnapshot(ctx);
}
function searchIndex(index, query) {
  const terms = query.toLowerCase().split(/\s+/);
  const results = [];
  for (const [type, resources] of Object.entries(index.resources)) {
    for (const r of resources) {
      const searchable = [
        r.name ?? "",
        r._id,
        r.type ?? "",
        r.adaptorType ?? "",
        r._connectionId ?? ""
      ].join(" ").toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (searchable.includes(term)) score++;
      }
      if (score > 0) {
        results.push({ type, resource: r, score });
      }
    }
  }
  return results.sort((a, b) => b.score - a.score);
}
function addConnectionFlowEntry(map, connId, flowLabel) {
  if (!map.has(connId)) map.set(connId, []);
  const arr = map.get(connId) ?? [];
  if (!arr.includes(flowLabel)) arr.push(flowLabel);
}
function collectTransitiveConnections(dep, flowLabel, graph, map) {
  for (const td of graph.uses[dep] ?? []) {
    if (td.startsWith("connection:")) addConnectionFlowEntry(map, td.split(":")[1], flowLabel);
  }
}
function buildConnectionFlowMap(index) {
  const map = /* @__PURE__ */ new Map();
  for (const flow of index.resources.flow ?? []) {
    if (flow.disabled) continue;
    const flowLabel = flow.name ?? flow._id;
    for (const dep of index.graph.uses[`flow:${flow._id}`] ?? []) {
      if (dep.startsWith("connection:")) {
        addConnectionFlowEntry(map, dep.split(":")[1], flowLabel);
      }
      if (dep.startsWith("export:") || dep.startsWith("import:")) {
        collectTransitiveConnections(dep, flowLabel, index.graph, map);
      }
    }
  }
  return map;
}
function lintOfflineConnections(index) {
  const issues = [];
  const connectionFlowMap = buildConnectionFlowMap(index);
  for (const conn of index.resources.connection ?? []) {
    if (!conn.offline) continue;
    const flows = connectionFlowMap.get(conn._id);
    if (flows && flows.length > 0) {
      issues.push({
        rule: "offline-connection-in-use",
        severity: "error",
        resourceType: "connection",
        resourceId: conn._id,
        resourceName: conn.name ?? conn._id,
        message: `Offline connection used by ${flows.length} enabled flow(s): ${flows.slice(0, 3).join(", ")}${flows.length > 3 ? "..." : ""}`
      });
    }
  }
  return issues;
}
function findOrphans(resources, referencedIds, rule, resourceType, message) {
  return resources.filter((r) => !referencedIds.has(r._id)).map((r) => ({
    rule,
    severity: "warning",
    resourceType,
    resourceId: r._id,
    resourceName: r.name ?? r._id,
    message
  }));
}
function lintOrphanedResources(index) {
  const referencedExports = /* @__PURE__ */ new Set();
  const referencedImports = /* @__PURE__ */ new Set();
  const usedConnections = /* @__PURE__ */ new Set();
  for (const flow of index.resources.flow ?? []) {
    for (const dep of index.graph.uses[`flow:${flow._id}`] ?? []) {
      if (dep.startsWith("export:")) referencedExports.add(dep.split(":")[1]);
      if (dep.startsWith("import:")) referencedImports.add(dep.split(":")[1]);
    }
  }
  for (const r of [...index.resources.export ?? [], ...index.resources.import ?? []]) {
    if (r._connectionId) usedConnections.add(r._connectionId);
  }
  return [
    ...findOrphans(
      index.resources.export ?? [],
      referencedExports,
      "orphaned-export",
      "export",
      "Export not referenced by any flow."
    ),
    ...findOrphans(
      index.resources.import ?? [],
      referencedImports,
      "orphaned-import",
      "import",
      "Import not referenced by any flow."
    ),
    ...findOrphans(
      index.resources.connection ?? [],
      usedConnections,
      "orphaned-connection",
      "connection",
      "Connection not used by any export or import."
    )
  ];
}
function lintNoTrigger(index) {
  const issues = [];
  for (const flow of index.resources.flow ?? []) {
    if (flow.disabled) continue;
    const hasSchedule = !!flow.schedule;
    const hasWebhook = extractRefs("flow", flow).some((ref) => {
      if (ref.type !== "export") return false;
      const exp = (index.resources.export ?? []).find((e) => e._id === ref.id);
      return exp?.adaptorType === "WebhookExport";
    });
    if (!hasSchedule && !hasWebhook) {
      issues.push({
        rule: "no-trigger",
        severity: "warning",
        resourceType: "flow",
        resourceId: flow._id,
        resourceName: flow.name ?? flow._id,
        message: "Enabled flow has no schedule and no webhook trigger."
      });
    }
  }
  return issues;
}
function lintIndex(index) {
  return [
    ...lintOfflineConnections(index),
    ...lintOrphanedResources(index),
    ...lintNoTrigger(index)
  ];
}
function registerAccount(program2, ctx) {
  const group = new Command2("account").description(
    "Account-wide operations: snapshot, search, dependencies, lint, stats."
  );
  group.command("snapshot").description("Fetch all resources and build a local account index.").action(async () => {
    const index = await runSnapshot(ctx);
    const total = Object.values(index.resources).reduce((sum, arr) => sum + arr.length, 0);
    success(`Snapshot saved: ${total} resources indexed at ${index.timestamp}`);
  });
  group.command("search <query>").description("Search the account index by keyword.").option("--type <type>", "Filter by resource type (e.g. flow, connection, export).").option("--limit <n>", "Max results.", "20").option("--no-refresh", "Skip auto-refresh of stale index.").action(async (query, opts) => {
    if (opts.refresh) await ensureFreshIndex(ctx);
    const index = requireIndex(ctx.getProfile());
    let results = searchIndex(index, query);
    if (opts.type) {
      results = results.filter((r) => r.type === opts.type);
    }
    const limit = Number.parseInt(opts.limit, 10) || 20;
    results = results.slice(0, limit);
    if (results.length === 0) {
      console.error(chalk4.dim("No matches."));
      return;
    }
    const items = results.map((r) => ({
      type: r.type,
      _id: r.resource._id,
      name: r.resource.name ?? "",
      score: r.score
    }));
    formatOutput(items, ctx.getFormat(), {
      columns: ["type", "_id", "name", "score"],
      isList: true
    });
  });
  group.command("dependencies <type> <id>").description("Show dependency graph for a resource.").option("--direction <dir>", "Direction: uses, used-by, or both.", "both").option("--no-refresh", "Skip auto-refresh of stale index.").action(async (type, id, opts) => {
    if (opts.refresh) await ensureFreshIndex(ctx);
    const index = requireIndex(ctx.getProfile());
    const key = `${type}:${id}`;
    const result = { resource: key };
    if (opts.direction === "uses" || opts.direction === "both") {
      result.uses = index.graph.uses[key] ?? [];
    }
    if (opts.direction === "used-by" || opts.direction === "both") {
      result.usedBy = index.graph.usedBy[key] ?? [];
    }
    formatOutput(result, ctx.getFormat());
  });
  group.command("lint").description("Run anomaly detection rules against the account index.").option("--no-refresh", "Skip auto-refresh of stale index.").action(async (opts) => {
    if (opts.refresh) await ensureFreshIndex(ctx);
    const index = requireIndex(ctx.getProfile());
    const issues = lintIndex(index);
    if (issues.length === 0) {
      success("No issues found.");
      return;
    }
    const errors = issues.filter((i) => i.severity === "error");
    const warnings = issues.filter((i) => i.severity === "warning");
    const errMsg = chalk4.red(`${errors.length} error(s)`);
    const warnMsg = chalk4.yellow(`${warnings.length} warning(s)`);
    console.error(`${errMsg} ${warnMsg}`);
    formatOutput(issues, ctx.getFormat(), {
      columns: ["severity", "rule", "resourceType", "resourceName", "message"],
      isList: true
    });
  });
  group.command("stats").description("Show resource counts from the account index.").option("--no-refresh", "Skip auto-refresh of stale index.").action(async (opts) => {
    if (opts.refresh) await ensureFreshIndex(ctx);
    const index = requireIndex(ctx.getProfile());
    const stats = {
      timestamp: index.timestamp
    };
    for (const [type, items] of Object.entries(index.resources)) {
      stats[type] = items.length;
    }
    stats.total = Object.values(index.resources).reduce((sum, arr) => sum + arr.length, 0);
    formatOutput(stats, ctx.getFormat());
  });
  program2.addCommand(group);
}

// src/commands/helpers.ts
import { randomInt } from "crypto";
import { writeFileSync as writeFileSync6 } from "fs";
import { resolve as resolve2 } from "path";
import chalk6 from "chalk";

// src/help.ts
var HELP = {
  flows: `Flows are data pipelines connecting exports (sources) to imports (destinations) with optional branching and transformation. Flows start themselves \u2014 on a cron schedule, on inbound events (webhooks/listeners), or chained after another flow \u2014 unlike apis (invoked over HTTP) and tools (invoked by a consumer). Create flows with disabled=true and enable after verifying; an enabled flow with a schedule runs immediately.

Skills: building-flows (Quick Reference, How to Build a Flow, Pre-Submit Checklist).
Troubleshooting: troubleshooting-flows (Diagnostic Workflow, Common Errors).`,
  exports: `Exports fetch data from an external system and feed it into a flow for processing.

Skills: configuring-exports (Quick Reference, Adaptor Decision Matrix, Pre-Submit Checklist).
Filters: configuring-filters (Expression syntax, Output filter, Input filter).
Mappings: writing-mappings (Transformation 2.0, Mapper 2.0 Workflow).`,
  imports: `Imports write data to an external system. Each import has an adaptorType, mapping config, and optional lookups.

Skills: configuring-imports (Quick Reference, Adaptor Decision Matrix, Pre-Submit Checklist).
Filters: configuring-filters (Expression syntax, Import filter).
Mappings: writing-mappings (Mapper 2.0 Workflow, Lookups).`,
  connections: `Connections hold credentials and configuration that authenticate Celigo to external systems. Every export and import references one.

Skills: configuring-connections (Quick Reference, Connection Type Decision Matrix, Pre-Submit Checklist).`,
  integrations: "Integrations are named containers that group related flows, tools, and resources.",
  scripts: `Scripts are JavaScript functions that run at specific points in the data pipeline (preSavePage, preMap, postMap, postSubmit, postResponseMap).

Skills: writing-scripts (Quick Reference, Hook Point Decision Matrix, Pre-Submit Checklist).`,
  stacks: `Custom execution environments for scripts and hooks. Two types: self-hosted HTTP servers and AWS Lambda functions.

Create requires 'server.hostURI' for type=server (e.g. {"name":"my-stack","type":"server","server":{"hostURI":"https://stack.example.com"}}).`,
  apis: `RESTful endpoints that expose integration logic for external consumption. The caller's HTTP request is the source record (no schedule, no listeners \u2014 scheduled work belongs in a flow that calls the API). Every builder API returns exactly one success, one fail, and optional custom responses; 'disabled: true' makes callers receive 404 without deleting the API.

Skills: building-apis (Quick Reference, The Request IS the Source Record, Pre-Submit Checklist).`,
  "lookup-caches": `Key-value stores used by imports to resolve references at runtime. Max 50 MB per cache. The resource (name, clone behavior) and its data (entries) have separate operations: "clear the cache" means purge-data (references stay valid), not delete (breaks every referencing lookup). Data loads are upserts \u2014 a true replace is purge + reload.

Skills: configuring-lookup-caches (Quick Reference, Static Map vs Cache vs Live Lookup, Gotchas).`,
  "edi-profiles": `X12 and EDIFACT interchange envelope settings for specific trading partners. One profile per partner covers every document type exchanged with them. ISA/GS (or UNB) interchange identity belongs here \u2014 never on the AS2 connection, which carries only transport identity (AS2 IDs, endpoint, certificates).

Skills: building-b2b (EDI Standards, How to Build an EDI Integration, Gotchas).`,
  "file-definitions": `Parsers and generators for structured file formats (CSV, fixed-width, XML, JSON, EDI).

Skills: building-b2b (How to Build an EDI Integration, Gotchas).`,
  "mcp-servers": `MCP server configurations that expose Celigo tools and APIs as MCP endpoints for AI agents.

Skills: building-mcp-servers (Quick Reference, How to Build an MCP Server, Pre-Submit Checklist).`,
  iclients: "OAuth2 app registrations (iClients) for OAuth authorization flows.",
  tags: "Labels for organizing and filtering resources across the account.",
  tools: `Reusable building blocks that encapsulate lookups, imports, transforms, and branching behind input/output contracts. Callable from flows, APIs, AI agents, MCP servers, and other tools. Tools run only when a consumer invokes them (no schedule/listeners), and the consumer supplies the connections at bind time \u2014 one tool can serve sandbox and production consumers without forking. Reachable from outside Celigo? That's an API (or a tool exposed behind one).

Skills: building-tools (Quick Reference, Pre-Submit Checklist).`,
  environments: "Environments (Production and non-production) on the account.",
  notifications: "Alert configurations for flow errors, job completions, and other events.",
  "ai-agents": `AI agent import configurations (AiAgentImport) for LLM-powered processing steps. Use an AI agent when the LLM does work whose output flows onward (classify, extract, generate, summarize); use a guardrail when it renders a verdict the pipeline branches on (verify, check, flag, screen).

Skills: configuring-ai-agents (Quick Reference, Provider Decision Matrix, How to Build an AI Agent).`,
  guardrails: `Safety and compliance checks (PII detection, content moderation, AI evaluation) applied to data flowing through integrations. Guardrails flag \u2014 they don't enforce: each returns a {flagged, reasoning} verdict and the parent flow/API/tool decides whether to block, route to review, or continue. PII 'mask: true' returns the redacted payload under a 'masked' response field; without a response-mapping write-back the raw PII still reaches the destination.

Skills: configuring-guardrails (Type Decision Matrix, Masking requires a write-back); configuring-ai-agents (How to Build a Guardrail).`,
  users: `Account users and their access levels.

Skills: managing-users (Quick Reference, Access Strategy Decision Matrix, Gotchas).`,
  jobs: `Flow execution records with status, timing, and record counts.

Choosing a command, in order: 'jobs current' for running/active jobs; 'jobs get <id>' for a specific run (children inlined); 'jobs run-stats' for aggregate history; 'jobs list' LAST. The generic GET /v1/jobs behind 'list' only supports two index-backed filter shapes \u2014 --type flow/retry scoped by --integration/--flow, and --type export/import scoped by --flow-job/--parent-job \u2014 and the CLI rejects every other combination to protect the shared database.

Skills: troubleshooting-flows (Quick Reference, Diagnostic Workflow, Common Errors).`,
  audit: "Audit log entries tracking changes to resources across the account.",
  subscriptions: "Account subscription and license information.",
  "on-premise-agents": "On-premise agents (OPA) for connecting to systems behind firewalls.",
  "http-connectors": "Pre-built guided connector definitions for HTTP/REST APIs.",
  "edi-transactions": `EDI document exchange records tracked by B2B Manager (X12 and EDIFACT).

Skills: building-b2b (Monitoring EDI Transactions).`,
  "trading-partner-connectors": `Pre-configured connection templates for onboarding EDI trading partners.

Skills: building-b2b (How to Build an EDI Integration).`,
  templates: "Published integration templates and connectors available in the marketplace.",
  metadata: "Application metadata (object types, fields, picklists) for connected systems.",
  processors: `Stateless parse/generate transforms (POST /v1/processors/*) \u2014 raw CSV/XML/EDI to JSON and back. Nothing is created or modified, so these run in read mode. 'parse <csv|edi|xml>' and 'generate <csv|edi>' take a format argument; 'invoke <name>' calls any catalog processor with a raw body. Use 'parse edi' as a pre-flow checkpoint: validate a raw EDI file against a file definition (by ID or inline) and inspect recordLevelErrors before building the flow. The parser wraps the definition (rules.fileDefinition / rules._fileDefinitionId); the generator takes definition fields directly in rules.

Skills: building-b2b (How to Build an EDI Integration, Gotchas).`,
  "async-helpers": "Background processing helpers for long-running operations.",
  syncs: `Syncs are Celigo Data Ingestion pipelines that continuously replicate data from source applications into a data warehouse. A sync belongs to an integration and pairs a source connection with a destination database/schema.

Related groups: 'datasets' selects which tables/objects a sync replicates; 'sync-jobs' inspects the executions produced by 'syncs run'.

Gotcha: a sync can only be created inside a syncs integration \u2014 an integration holds either flows or syncs, never both. Create one with: celigo integrations create <<< '{"name": "...", "syncs": true}'.`,
  datasets: `Datasets choose which tables/objects a sync replicates and how records load (append, replace, merge).

Workflow: 'datasets available <connectionId>' shows the menu of what could be synced (with --sync, annotated with what's already selected); 'datasets list --sync' shows the current selection; 'datasets upsert --sync' changes it; 'datasets fields' shows one table's columns.`
};

// src/commands/resource.ts
import { readFileSync as readFileSync7 } from "fs";
import { homedir as homedir2 } from "os";
import { join as join7 } from "path";
import chalk5 from "chalk";
import { Command as Command3 } from "commander";

// src/modes.ts
var FULL_ONLY_LAST_WORDS = /* @__PURE__ */ new Set(["create", "update", "delete"]);
var FULL_ONLY_PATHS = /* @__PURE__ */ new Set([
  "users invite",
  "users reinvite",
  "connectors install",
  "connectors push-update",
  "templates install",
  "apis set-group",
  "apis unset-group",
  "integrations clone",
  "integrations create-flow-group",
  "integrations delete-flow-group",
  "integrations create-api-group",
  "integrations delete-api-group",
  "flows set-group",
  "flows unset-group",
  "integrations register-connections",
  "integrations deregister-connections",
  "integrations create-snapshot",
  "flows clone",
  "flows add-processor",
  "flows remove-processor",
  "flows add-generator",
  "flows remove-generator",
  "flows replace-connection",
  "exports clone",
  "exports replace-connection",
  "imports clone",
  "imports replace-connection",
  "ai-agents clone",
  "ai-agents replace-connection",
  "guardrails clone",
  "guardrails replace-connection",
  "tools add-processor",
  "tools remove-processor",
  "apis clone",
  "apis add-processor",
  "apis remove-processor",
  "recycle-bin restore",
  "recycle-bin purge",
  "state purge",
  // Batch create-or-update of a sync's datasets — a structural write, like create/update.
  "datasets upsert",
  // Merge removes the source folder when it completes — folder deletion is full-only, so the
  // merge that implies it must not be easier than `storage delete`.
  "storage merge"
]);
var SET_OPERATE_FIELDS = /* @__PURE__ */ new Set([
  "disabled",
  "debugUntil",
  "debugDate",
  "schedule",
  "autoResolveAt",
  "logging.debugUntil"
]);
function commandRequirement(path) {
  const trimmed = path.trim();
  if (!trimmed) return "free";
  const tokens = trimmed.split(/\s+/);
  const last = tokens.at(-1);
  if (last === "set") return "set-gated";
  if (last && FULL_ONLY_LAST_WORDS.has(last)) return "full";
  if (FULL_ONLY_PATHS.has(trimmed)) return "full";
  return "free";
}
var UNGATED_PREFIXES = ["config ", "profile ", "skills "];
function assertCommandAllowedInMode(mode, path) {
  if (mode === "full") return;
  if (UNGATED_PREFIXES.some((p) => path.startsWith(p))) return;
  const req = commandRequirement(path);
  if (req === "full") {
    throw new Error(
      `Command '${path}' requires full mode. Current mode: ${mode}. Switch with 'celigo config set mode full' or use a different profile.`
    );
  }
  if (req === "set-gated" && mode === "read") {
    throw new Error(
      `Command '${path}' cannot run in read mode (it issues a PUT). Current mode: read. Switch to operate or full to modify resource fields.`
    );
  }
}
function isOperateAllowedField(fieldPath) {
  for (const allowed of SET_OPERATE_FIELDS) {
    if (fieldPath === allowed || fieldPath.startsWith(`${allowed}.`)) return true;
  }
  return false;
}
function assertSetFieldsAllowedInMode(mode, fieldPaths) {
  if (mode !== "operate") return;
  const disallowed = fieldPaths.filter((f) => !isOperateAllowedField(f));
  if (disallowed.length > 0) {
    const allowed = [...SET_OPERATE_FIELDS].sort((a, b) => a.localeCompare(b)).join(", ");
    throw new Error(
      `Field(s) not allowed in operate mode: ${disallowed.join(", ")}. Allowed fields: ${allowed}. Switch to full mode to modify other fields.`
    );
  }
}
function extractFieldPaths(assignments) {
  const paths = [];
  for (const a of assignments) {
    const eq = a.indexOf("=");
    if (eq > 0) paths.push(a.slice(0, eq));
  }
  return paths;
}

// src/commands/resource.ts
var PATCH_WHITELISTS = {
  apis: /* @__PURE__ */ new Set(["name", "description", "disabled"]),
  connections: /* @__PURE__ */ new Set(["name", "debugDate", "debugUntil"]),
  exports: /* @__PURE__ */ new Set(["assistantMetadata", "debugUntil"]),
  flows: /* @__PURE__ */ new Set([
    "name",
    "description",
    "aiDescription",
    "disabled",
    "runPageGeneratorsInParallel",
    "logging.debugUntil",
    "logging.mode",
    "schedule.cron",
    "schedule.days",
    "schedule.endDate",
    "schedule.frequency",
    "schedule.startDate"
  ]),
  imports: /* @__PURE__ */ new Set(["debugUntil"]),
  integrations: /* @__PURE__ */ new Set(["apiGroupings", "flowGroupings", "settings"]),
  lookupcaches: /* @__PURE__ */ new Set(["name", "description"]),
  mcpServers: /* @__PURE__ */ new Set(["name", "disabled"]),
  scripts: /* @__PURE__ */ new Set(["debugUntil"]),
  tags: /* @__PURE__ */ new Set(["tag"]),
  iclients: /* @__PURE__ */ new Set(["oauth2.failPath"])
};
var MASKED_CREDENTIAL_ENDPOINTS = /* @__PURE__ */ new Set([
  "connections",
  "iclients",
  "mcpoauthproviders"
]);
function selectSetStrategy(endpoint, fieldPaths) {
  const whitelist = PATCH_WHITELISTS[endpoint];
  if (whitelist && fieldPaths.every((f) => whitelist.has(f))) return "patch";
  if (MASKED_CREDENTIAL_ENDPOINTS.has(endpoint)) return "error";
  return "put";
}
function buildPatchOps(assignments) {
  return assignments.map((assign) => {
    const eqIdx = assign.indexOf("=");
    if (eqIdx < 1) throw new Error(`Invalid assignment '${assign}'. Use key=value.`);
    const key = assign.slice(0, eqIdx);
    const value = resolveAssignmentValue(key, assign.slice(eqIdx + 1));
    const path = `/${parseKeyPath(key).join("/")}`;
    return value === null ? { op: "remove", path } : { op: "replace", path, value };
  });
}
async function getAndPrint(ctx, path, listColumns) {
  const data = await ctx.getClient().get(path);
  formatOutput(
    data,
    ctx.getFormat(),
    listColumns ? { columns: listColumns, isList: true } : void 0
  );
}
function reportCursorList(ctx, result, listColumns, narrowHint) {
  formatOutput(result.items, ctx.getFormat(), { columns: listColumns, isList: true });
  if (result.truncated)
    console.error(
      chalk5.yellow(
        `Note: stopped at the pagination safety cap \u2014 results may be incomplete. ${narrowHint}`
      )
    );
}
async function listAndPrint(ctx, path, listColumns) {
  const data = await ctx.getClient().list(path);
  formatOutput(
    data,
    ctx.getFormat(),
    listColumns ? { columns: listColumns, isList: true } : void 0
  );
}
async function writeFromBody(ctx, method, path, file) {
  const body = await readBody(file);
  const data = await ctx.getClient()[method](path, body);
  formatOutput(data, ctx.getFormat());
}
async function writeAndReport(ctx, method, path, body, successMessage) {
  const result = await ctx.getClient()[method](path, body);
  if (result) formatOutput(result, ctx.getFormat());
  else success(successMessage);
}
async function confirmThen(opts, message, action) {
  if (!opts.yes && !await confirm(message)) return;
  await action();
}
async function removeWithConfirm(ctx, path, opts, confirmMessage, successMessage) {
  if (!opts.yes && !await confirm(confirmMessage)) return;
  await ctx.getClient().delete(path);
  success(successMessage);
}
function addWriteCommands(group, ctx, spec) {
  const { endpoint, descNoun, confirmNoun } = spec;
  group.command("create").description(`Create ${descNoun}.`).option("-f, --file <path>", "JSON body file (or pipe via stdin).").action((opts) => writeFromBody(ctx, "post", `v1/${endpoint}`, opts.file));
  group.command("update <id>").description(`Update ${descNoun}.`).option("-f, --file <path>", "JSON body file (or pipe via stdin).").action(
    (id, opts) => writeFromBody(ctx, "put", `v1/${endpoint}/${id}`, opts.file)
  );
  group.command("delete <id>").description(`Delete ${descNoun}.`).option("-y, --yes", "Skip confirmation.").action(
    (id, opts) => removeWithConfirm(
      ctx,
      `v1/${endpoint}/${id}`,
      opts,
      `Delete ${confirmNoun} ${id}?`,
      "Delete complete."
    )
  );
}
function isAllAsterisks(s) {
  return s.length > 0 && /^\*+$/.test(s);
}
function findMaskedPaths(value, path = "") {
  if (typeof value === "string") return isAllAsterisks(value) ? [path || "(root)"] : [];
  if (value === null || typeof value !== "object") return [];
  const found = [];
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      found.push(...findMaskedPaths(value[i], `${path}[${i}]`));
    }
  } else {
    for (const [k, v] of Object.entries(value)) {
      found.push(...findMaskedPaths(v, path ? `${path}.${k}` : k));
    }
  }
  return found;
}
function assertNoMaskedCredentials(body, name, id, force) {
  if (force) return;
  const masked = findMaskedPaths(body);
  if (masked.length === 0) return;
  const list = masked.map((p) => `  \u2022 ${p}`).join("\n");
  throw new Error(
    `Refusing to update ${name.replace(/s$/, "")} ${id}: payload contains masked credential values (e.g. "******") at:
${list}

Submitting these placeholders would overwrite the real credentials. Replace them with actual values (or "" to clear), or pass --force to submit anyway.`
  );
}
function parseRowLimit(raw) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1 || String(n) !== raw.trim()) {
    throw new Error(`Invalid --limit '${raw}'. Use a positive integer.`);
  }
  return n;
}
function makeResourceGroup(name, endpoint, opts) {
  const skip = new Set(opts.exclude ?? []);
  const group = new Command3(name).description(opts.description ?? `Manage ${name}.`);
  const singular = name.replace(/s$/, "");
  const article2 = /^[aeiou]/i.test(singular) ? "an" : "a";
  if (opts.helpText) {
    group.addHelpText("after", `
--- Reference ---
${opts.helpText}`);
  }
  if (!skip.has("list")) {
    const listCmd = group.command("list").description(
      `List all ${name}. Rows are projected to id, name, and the table columns by default; use --fields all for complete documents.`
    ).option(FIELDS_OPTION_FLAGS, FIELDS_OPTION_DESCRIPTION).option("--limit <n>", "Return at most <n> rows (fetches a single page).");
    if (opts.integrationSubpath)
      listCmd.option("--integration <id>", "List only resources belonging to this integration.");
    listCmd.action(async (cmdOpts) => {
      let path = opts.integrationSubpath && cmdOpts.integration ? `v1/integrations/${cmdOpts.integration}/${opts.integrationSubpath}` : `v1/${endpoint}`;
      const limit = cmdOpts.limit === void 0 ? void 0 : parseRowLimit(cmdOpts.limit);
      const fields = resolveListFields({
        fields: cmdOpts.fields,
        jqActive: isJqActive(),
        setting: opts.getListFields?.(),
        defaults: defaultProjection(opts.listColumns, opts.projectionExtras)
      });
      if (limit !== void 0) path = withQueryParam(path, "limit", String(limit));
      path = withListProjection(path, fields);
      if (limit !== void 0) {
        const { items, truncated } = await opts.getClient().listPaged(path, 1);
        formatOutput(projectRows(items.slice(0, limit), fields), opts.getFormat(), {
          columns: opts.listColumns,
          isList: true
        });
        if (truncated || items.length > limit) {
          console.error(chalk5.yellow(`Note: more rows exist beyond --limit ${limit}.`));
        }
        return;
      }
      const data = await opts.getClient().list(path);
      formatOutput(projectRows(data, fields), opts.getFormat(), {
        columns: opts.listColumns,
        isList: true
      });
    });
  }
  if (!skip.has("get"))
    group.command("get <id>").description(`Get ${article2} ${singular} by ID.`).action(async (id) => {
      const data = await opts.getClient().get(`v1/${endpoint}/${id}`);
      formatOutput(data, opts.getFormat());
    });
  if (!skip.has("create"))
    group.command("create").description(`Create ${article2} ${singular} from a JSON body (stdin, or --file).`).option(
      "-f, --file <path>",
      "Read the JSON body from a file instead of stdin ('-' also means stdin)."
    ).action(async (cmdOpts) => {
      const body = await readBody(cmdOpts.file);
      const result = await opts.getClient().post(`v1/${endpoint}`, body);
      formatOutput(result, opts.getFormat());
    });
  if (!skip.has("update"))
    group.command("update <id>").description(`Update ${article2} ${singular} from a JSON body (stdin, or --file).`).option(
      "-f, --file <path>",
      "Read the JSON body from a file instead of stdin ('-' also means stdin)."
    ).option(
      "--force",
      "Submit even if the body contains masked credential values (***) copied from a GET."
    ).action(async (id, cmdOpts) => {
      const body = await readBody(cmdOpts.file);
      assertNoMaskedCredentials(body, name, id, cmdOpts.force);
      const result = await opts.getClient().put(`v1/${endpoint}/${id}`, body);
      formatOutput(result, opts.getFormat());
    });
  if (!skip.has("set"))
    group.command("set <id> [assignments...]").description(
      `Set field(s) on ${article2} ${singular}.
Whitelisted fields (e.g. name, debugUntil, schedule.*) are applied via an atomic PATCH;
other fields go through GET + modify + PUT. For credential-masked resources (connections,
iclients) only the PATCH-whitelisted fields can be set \u2014 others must use 'update'.
Usage: set <id> key=value [key2=value2 ...]
Values are auto-parsed: disabled=false \u2192 boolean, debugUntil=null \u2192 removes field.
Dot notation supported: http.relativeURI=/api/v2/items
Array index supported: pageGenerators[0]._exportId=abc123
Combined: routers[0].branches[1].pageProcessors[0]._importId=xyz
Load a value from a file: content=file://./hook.js (avoids hand-escaping multi-line content like script source or SQL; ~ and relative paths are supported).
Example: celigo ${name} set <id> disabled=false debugUntil=null`
    ).action(async (id, assignments) => {
      if (assignments.length === 0) {
        throw new Error("Provide at least one key=value assignment.");
      }
      const fieldPaths = extractFieldPaths(assignments);
      assertSetFieldsAllowedInMode(opts.getMode(), fieldPaths);
      const client2 = opts.getClient();
      const strategy = selectSetStrategy(endpoint, fieldPaths);
      if (strategy === "error") {
        const whitelist = PATCH_WHITELISTS[endpoint];
        const disallowed = fieldPaths.filter((f) => !whitelist?.has(f)).join(", ");
        const guidance = whitelist ? `Fields safe to set here (applied via PATCH): ${[...whitelist].sort((a, b) => a.localeCompare(b)).join(", ")}.
To change any other field, use '${name} update' with the real credential values.` : `No field can be set on ${article2} ${singular}. Use '${name} update' with the real credential values instead.`;
        throw new Error(
          `Cannot set ${disallowed} on ${article2} ${singular} via 'set': its credentials are masked, so a GET+PUT would overwrite them with "******".
${guidance}`
        );
      }
      if (strategy === "patch") {
        const result2 = await client2.patch(`v1/${endpoint}/${id}`, buildPatchOps(assignments));
        if (result2) formatOutput(result2, opts.getFormat());
        else success(`Updated ${singular} ${id}.`);
        return;
      }
      const resource = await client2.get(`v1/${endpoint}/${id}`);
      applyAssignments(resource, assignments);
      for (const field of opts.putSanitizeFields ?? []) delete resource[field];
      const result = await client2.put(`v1/${endpoint}/${id}`, resource);
      formatOutput(result, opts.getFormat());
    });
  if (!skip.has("delete"))
    group.command("delete <id>").description(`Delete ${article2} ${singular} by ID.`).option("-y, --yes", "Skip confirmation.").action(async (id, cmdOpts) => {
      if (!cmdOpts.yes) {
        const ok = await confirm(`Delete ${singular} ${id}?`);
        if (!ok) return;
      }
      await opts.getClient().delete(`v1/${endpoint}/${id}`);
      success(`Deleted ${id}`);
    });
  return group;
}
function parseKeyPath(key) {
  const segments = [];
  const keyPathRegex = /^([^[]*)((?:\[\d+\])*)$/;
  const bracketRegex = /\[(\d+)\]/g;
  for (const part of key.split(".")) {
    const match = keyPathRegex.exec(part);
    if (match) {
      if (match[1]) segments.push(match[1]);
      for (const m of match[2].matchAll(bracketRegex)) segments.push(Number(m[1]));
    } else {
      segments.push(part);
    }
  }
  return segments;
}
function assignOrDelete(target, key, value) {
  if (value === null) {
    if (typeof key === "number" && Array.isArray(target)) target.splice(key, 1);
    else delete target[key];
  } else {
    target[key] = value;
  }
}
function setValueAtPath(resource, segments, value) {
  if (segments.length === 1) {
    assignOrDelete(resource, segments[0], value);
    return;
  }
  let target = resource;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const next = segments[i + 1];
    if (target[seg] === void 0 || target[seg] === null || typeof target[seg] !== "object") {
      target[seg] = typeof next === "number" ? [] : {};
    }
    target = target[seg];
  }
  const lastSeg = segments.at(-1);
  if (lastSeg !== void 0) assignOrDelete(target, lastSeg, value);
}
function expandHome(path) {
  if (path === "~") return homedir2();
  if (path.startsWith("~/") || path.startsWith("~\\")) return join7(homedir2(), path.slice(2));
  return path;
}
function parseScalar(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
var FILE_PREFIX = "file://";
function resolveAssignmentValue(key, rawValue) {
  if (!rawValue.startsWith(FILE_PREFIX)) return parseScalar(rawValue);
  const path = expandHome(rawValue.slice(FILE_PREFIX.length));
  if (!path) throw new Error(`Empty file path in assignment '${key}=${rawValue}'.`);
  let contents;
  try {
    contents = readFileSync7(path, "utf-8");
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot read file '${path}' for '${key}': ${reason}`);
  }
  return parseScalar(contents);
}
function applyAssignments(resource, assignments) {
  const DANGEROUS_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
  for (const assign of assignments) {
    const eqIdx = assign.indexOf("=");
    if (eqIdx < 1) throw new Error(`Invalid assignment '${assign}'. Use key=value.`);
    const key = assign.slice(0, eqIdx);
    const rawValue = assign.slice(eqIdx + 1);
    const value = resolveAssignmentValue(key, rawValue);
    const segments = parseKeyPath(key);
    for (const seg of segments) {
      if (typeof seg === "string" && DANGEROUS_KEYS.has(seg))
        throw new Error(`Invalid key segment '${seg}'.`);
    }
    setValueAtPath(resource, segments, value);
  }
}
function collectProcessorSteps(processors) {
  if (!Array.isArray(processors)) return [];
  const steps = [];
  for (const pp of processors) {
    if (pp._importId) steps.push({ id: String(pp._importId), type: "import" });
    if (pp._exportId) steps.push({ id: String(pp._exportId), type: "export" });
  }
  return steps;
}
function collectRouterSteps(routers) {
  if (!Array.isArray(routers)) return [];
  const steps = [];
  for (const router of routers) {
    const branches = router.branches;
    if (!Array.isArray(branches)) continue;
    for (const branch of branches) {
      steps.push(...collectProcessorSteps(branch.pageProcessors));
    }
  }
  return steps;
}
function collectFlowStepIds(flow) {
  const generators = Array.isArray(flow.pageGenerators) ? flow.pageGenerators.filter((pg) => pg._exportId).map((pg) => ({
    id: String(pg._exportId),
    type: "export"
  })) : [];
  return [
    ...generators,
    ...collectProcessorSteps(flow.pageProcessors),
    ...collectRouterSteps(flow.routers)
  ];
}
async function readBody(file) {
  if (!file || file === "-") return readStdin();
  const path = expandHome(file);
  let raw;
  try {
    raw = readFileSync7(path, "utf-8");
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot read file '${path}': ${reason}`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw invalidJsonError(raw, path);
  }
}
var NO_INPUT_MESSAGE = "No input received. Pipe JSON via stdin, or pass --file <path> (where supported).";
var BODY_SHAPE_HINT = "create/update expect a complete JSON body. To set a single field from a file (e.g. a script's content), use: set <id> <field>=file://<path>.";
function invalidJsonError(raw, source) {
  const base = source ? `Invalid JSON in file '${source}'.` : "Invalid JSON input.";
  const trimmed = raw.trimStart();
  const looksLikeJson = trimmed.startsWith("{") || trimmed.startsWith("[");
  return new Error(looksLikeJson ? base : `${base} ${BODY_SHAPE_HINT}`);
}
async function readStdin() {
  if (process.stdin.isTTY) {
    throw new Error(NO_INPUT_MESSAGE);
  }
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) {
    throw new Error(NO_INPUT_MESSAGE);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw invalidJsonError(raw);
  }
}
async function tryReadStdin() {
  if (process.stdin.isTTY || !process.stdin.readable || process.stdin.readableEnded)
    return void 0;
  return new Promise((resolve5, reject) => {
    const chunks = [];
    let settled = false;
    const settle = (outcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      process.stdin.off("data", onData);
      process.stdin.off("end", onEnd);
      process.stdin.off("error", onError);
      process.stdin.pause();
      outcome();
    };
    const timer = setTimeout(() => settle(() => resolve5(void 0)), 50);
    const onData = (chunk) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    };
    const onEnd = () => {
      const raw = Buffer.concat(chunks).toString("utf-8").trim();
      if (!raw) return settle(() => resolve5(void 0));
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return settle(() => reject(invalidJsonError(raw)));
      }
      settle(() => resolve5(body));
    };
    const onError = () => settle(() => resolve5(void 0));
    process.stdin.on("data", onData);
    process.stdin.on("end", onEnd);
    process.stdin.on("error", onError);
    process.stdin.resume();
  });
}
async function confirm(message) {
  if (!process.stdin.isTTY) {
    process.stderr.write(`${message}
Confirmation requires a TTY; pass --yes to proceed.
`);
    process.exitCode = 1;
    return false;
  }
  process.stderr.write(`${message} [y/N] `);
  return new Promise((resolve5) => {
    const settle = (answer) => {
      process.stdin.off("data", onData);
      process.stdin.off("end", onEnd);
      process.stdin.off("close", onEnd);
      process.stdin.pause();
      resolve5(answer);
    };
    const onData = (data) => {
      const answer = data.toString().trim().toLowerCase();
      settle(answer === "y" || answer === "yes");
    };
    const onEnd = () => settle(false);
    process.stdin.setRawMode?.(false);
    process.stdin.resume();
    process.stdin.on("data", onData);
    process.stdin.on("end", onEnd);
    process.stdin.on("close", onEnd);
  });
}
async function promptSecret(message) {
  const { createInterface } = await import("readline");
  const rl = createInterface({ input: process.stdin, output: void 0, terminal: true });
  try {
    process.stderr.write(message);
    return await new Promise((resolve5) => {
      rl.once("close", () => resolve5(""));
      rl.question("", (answer) => resolve5(answer.trim()));
    });
  } finally {
    rl.close();
    process.stderr.write("\n");
  }
}

// src/commands/helpers.ts
var BATCH_SIZE = 1e3;
function addKnowledgeHelp(group, name) {
  const text = HELP[name];
  if (text) group.addHelpText("after", `
--- Reference ---
${text}`);
}
async function detectProcessorType(client2, exportOrImportId) {
  let type;
  try {
    await client2.get(`v1/imports/${exportOrImportId}`);
    type = "import";
  } catch {
    try {
      await client2.get(`v1/exports/${exportOrImportId}`);
      type = "export";
    } catch {
      throw new TypeError(`'${exportOrImportId}' is not a valid import or export ID.`);
    }
  }
  const processor = { type };
  if (type === "import") processor._importId = exportOrImportId;
  else processor._exportId = exportOrImportId;
  return { type, processor };
}
function resolveBranch(routers, opts, resourceLabel) {
  if (!opts.router && routers.length > 1) {
    const ids = routers.map((r) => r.id).join(", ");
    throw new Error(`${resourceLabel} has ${routers.length} routers (${ids}). Specify --router.`);
  }
  const router = opts.router ? routers.find((r) => r.id === opts.router) : routers[0];
  if (!router) throw new Error(`Router '${opts.router}' not found.`);
  const branches = router.branches;
  if (!Array.isArray(branches) || branches.length === 0) {
    throw new Error("Router has no branches.");
  }
  if (!opts.branch && branches.length > 1) {
    const names = branches.map((b) => b.name || "(unnamed)").join(", ");
    throw new Error(
      `Router '${router.id}' has ${branches.length} branches (${names}). Specify --branch.`
    );
  }
  const branch = opts.branch ? branches.find((b) => b.name === opts.branch) : branches[0];
  if (!branch) throw new Error(`Branch '${opts.branch}' not found.`);
  return branch;
}
function findProcessorList(routers, exportOrImportId, opts) {
  if (opts.router) {
    const router = routers.find((r) => r.id === opts.router);
    if (!router) throw new Error(`Router '${opts.router}' not found.`);
    const branches = router.branches;
    const branch = opts.branch ? branches.find((b) => b.name === opts.branch) : branches[0];
    if (!branch) throw new Error(`Branch '${opts.branch}' not found.`);
    return branch.pageProcessors ?? [];
  }
  for (const router of routers) {
    const branches = router.branches;
    if (!Array.isArray(branches)) continue;
    for (const branch of branches) {
      const pps = branch.pageProcessors ?? [];
      if (pps.some((pp) => pp._importId === exportOrImportId || pp._exportId === exportOrImportId))
        return pps;
    }
  }
  throw new Error(`No page processor with _importId or _exportId '${exportOrImportId}' found.`);
}
function randomRouterId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 11; i++) id += chars[randomInt(chars.length)];
  return id;
}
function article(word) {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}
function parseIds(csv) {
  return csv.split(",").map((s) => s.trim()).filter(Boolean);
}
function withProcessorOptions(cmd) {
  return cmd.option("--router <routerId>", "Target a specific router.").option("--branch <branchName>", "Target a specific branch.").option("-y, --yes", "Skip confirmation.");
}
async function addProcessorToBranch(opts) {
  const { client: client2, branch, processor, confirmMsg, doc, putEndpoint, yes, format } = opts;
  if (!yes) {
    const ok = await confirm(confirmMsg);
    if (!ok) return;
  }
  if (!Array.isArray(branch.pageProcessors)) branch.pageProcessors = [];
  branch.pageProcessors.push(processor);
  const result = await client2.put(putEndpoint, doc);
  formatOutput(result, format);
}
async function removeProcessorAndPut(opts) {
  const { client: client2, pps, exportOrImportId, doc, putEndpoint, confirmMsg, yes, format } = opts;
  const idx = pps.findIndex(
    (pp) => pp._importId === exportOrImportId || pp._exportId === exportOrImportId
  );
  if (idx === -1) {
    throw new Error(`No page processor with _importId or _exportId '${exportOrImportId}' found.`);
  }
  if (!yes) {
    const ok = await confirm(confirmMsg);
    if (!ok) return;
  }
  pps.splice(idx, 1);
  const result = await client2.put(putEndpoint, doc);
  formatOutput(result, format);
}
async function replaceConnection(client2, endpoint, body, label, format) {
  const result = await client2.put(endpoint, body);
  if (result === null) {
    success(label);
  } else {
    formatOutput(result, format);
  }
}
async function runClone(ctx, collection, singular, id, nameOpt, selfMap, extraBody = {}) {
  const stdin = await tryReadStdin() ?? {};
  let connectionMap = stdin.connectionMap;
  let name = nameOpt;
  if (!connectionMap || !name) {
    const source = await ctx.getClient().get(`v1/${collection}/${id}`);
    connectionMap ??= selfMap(source);
    if (!name) {
      if (typeof source.name !== "string" || !source.name) {
        throw new Error(
          `Source ${singular} ${id} has no name \u2014 cannot auto-generate a clone name. Provide --name explicitly.`
        );
      }
      name = `Clone - ${source.name}`;
    }
  }
  const body = { name, connectionMap, ...extraBody };
  const result = await ctx.getClient().post(`v1/${collection}/${id}/clone`, body);
  formatOutput(result, ctx.getFormat());
}
function addCloneCommand(group, ctx, collection, singular) {
  group.command("clone <id>").description(
    [
      `Clone an ${singular}.`,
      `Same-env clone: no stdin needed \u2014 the CLI auto-builds a self-map from the ${singular}'s connection.`,
      'Cross-env clone: pipe the source\u2192target map via stdin: {"connectionMap":{"sourceConnId":"targetConnId",...}}'
    ].join("\n")
  ).option(
    "--name <name>",
    `Name for the cloned ${singular}. Defaults to "Clone - <source name>" (matches the UI).`
  ).action(async (id, opts) => {
    await runClone(ctx, collection, singular, id, opts.name, (source) => {
      const cid = source._connectionId;
      return typeof cid === "string" && cid ? { [cid]: cid } : {};
    });
  });
}
function buildUrl(endpoint, params) {
  const qs = params.toString();
  return qs ? `${endpoint}?${qs}` : endpoint;
}
function addDebugCommands(group, ctx, resourceLabel, endpoint, fieldPath = "/debugUntil", fetchHint) {
  const hintSuffix = fetchHint ? `
${fetchHint}` : "";
  group.command("enable-debug <id>").description(
    `Enable debug logging on ${article(resourceLabel)} ${resourceLabel} (sets ${fieldPath.slice(1)} via PATCH).${hintSuffix}`
  ).option("--duration <minutes>", "Debug duration in minutes (max 60).", "60").action(async (id, opts) => {
    const minutes = Math.min(Number.parseInt(opts.duration, 10) || 60, 60);
    const value = new Date(Date.now() + minutes * 6e4).toISOString();
    await ctx.getClient().patch(`v1/${endpoint}/${id}`, [{ op: "replace", path: fieldPath, value }]);
    success(`Debug enabled on ${resourceLabel} ${id} until ${value}.`);
  });
  group.command("disable-debug <id>").description(
    `Disable debug logging on ${article(resourceLabel)} ${resourceLabel} (clears ${fieldPath.slice(1)} via PATCH).`
  ).action(async (id) => {
    await ctx.getClient().patch(`v1/${endpoint}/${id}`, [{ op: "remove", path: fieldPath }]);
    success(`Debug disabled on ${resourceLabel} ${id}.`);
  });
}
function addDependenciesCommand(group, ctx, endpoint) {
  const singular = group.name().replace(/s$/, "");
  group.command("dependencies <id>").alias("used-by").description(
    `List resources that depend on this ${singular} (GET /v1/${endpoint}/<id>/dependencies).
Use this to check whether the ${singular} is safe to delete \u2014 empty means no dependents.`
  ).action(async (id) => {
    const data = await ctx.getClient().get(`v1/${endpoint}/${id}/dependencies`);
    if (ctx.getFormat() === "json") {
      printJson(data ?? {});
      return;
    }
    const rows = Object.entries(data ?? {}).flatMap(
      ([type, items]) => (items ?? []).map((d) => ({
        type,
        _id: d.id,
        name: d.name ?? "",
        paths: (d.paths ?? []).join(", "),
        accessLevel: d.accessLevel ?? ""
      }))
    );
    if (rows.length === 0) {
      console.error(chalk6.dim("No dependents."));
      return;
    }
    formatOutput(rows, ctx.getFormat(), {
      columns: ["type", "_id", "name", "paths", "accessLevel"],
      isList: true
    });
  });
}
function addAuditCommand(group, ctx, endpoint) {
  const singular = group.name().replace(/s$/, "");
  group.command("audit <id>").description(
    `Show the audit log (change history) for one ${singular} (GET /v1/${endpoint}/<id>/audit).`
  ).action(async (id) => {
    const data = await ctx.getClient().get(`v1/${endpoint}/${id}/audit`);
    formatOutput(data, ctx.getFormat(), {
      columns: ["_id", "event", "source", "byUser.email", "time"],
      isList: true
    });
  });
}
function tryDecodeBase64Json(value) {
  if (typeof value !== "string" || value.length < 20) return value;
  if (/\s/.test(value) || !/^[A-Za-z0-9+/]+=*$/.test(value)) return value;
  try {
    return JSON.parse(Buffer.from(value, "base64").toString("utf-8"));
  } catch {
    return value;
  }
}
function addTestRunCommands(group, ctx, basePath) {
  group.command("test-run <id>").description(
    "Start a test run and return stage-by-stage results.\nFor flows, --export (a page generator export ID) is required, and the flow must be disabled\n(the API returns 403 for enabled flows \u2014 set disabled=true first).\nReturns metadata (stages per step), flowJob, and childJobs."
  ).option("--export <exportId>", "Export ID (page generator). Required for flows.").action(async (id, opts) => {
    const body = { triggeredAt: (/* @__PURE__ */ new Date()).toISOString() };
    if (opts.export) body._exportId = opts.export;
    const result = await ctx.getClient().post(`v1/${basePath}/${id}/test/run`, body);
    formatOutput(result, ctx.getFormat());
  });
  group.command("test-run-step-results <id> <runId> <exportOrImportId>").description(
    "Get stage-by-stage results for a test run step.\nStep IDs and run ID come from the test-run response.\nBase64-encoded responses are automatically decoded."
  ).action(async (id, runId, exportOrImportId) => {
    const raw = await ctx.getClient().get(`v1/${basePath}/${id}/test/run/${runId}/${exportOrImportId}`);
    const result = tryDecodeBase64Json(raw);
    formatOutput(result, ctx.getFormat());
  });
  group.command("test-run-step-logs <id> <runId> <exportOrImportId>").description(
    "List HTTP request/response logs for a test run step.\nLogs are only recorded for steps that issued outbound HTTP calls (exports, imports, lookups).\nRouters and stages that didn't make HTTP requests return 404 by design \u2014 check the test-run metadata\nto find the step ID with a 'lookup' or 'request' stage."
  ).action(async (id, runId, exportOrImportId) => {
    try {
      const raw = await ctx.getClient().get(
        `v1/${basePath}/${id}/test/run/${runId}/${exportOrImportId}/logs/requestAndResponse`
      );
      const result = tryDecodeBase64Json(raw);
      formatOutput(result, ctx.getFormat());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("req_res_logs_not_found") || msg.includes("resource_not_found")) {
        throw new Error(
          `No request/response logs for step ${exportOrImportId} in run ${runId}. Logs are only recorded for steps that issued outbound HTTP calls. Check the test-run metadata for a step with a 'lookup' or 'request' stage.`
        );
      }
      throw err;
    }
  });
}
async function fetchSignedZip(ctx, templatePath, defaultName, output) {
  const result = await ctx.getClient().get(templatePath);
  const signedURL = result.signedURL ?? result.signedUrl ?? result.url;
  if (!signedURL) {
    throw new Error(
      `Template endpoint did not return a download URL. Response: ${JSON.stringify(result)}`
    );
  }
  const resp = await fetch(signedURL);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status} ${resp.statusText}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const safeName = defaultName.replaceAll(/[^a-zA-Z0-9_-]/g, "_");
  const outPath = output ?? resolve2(process.cwd(), `${safeName}.zip`);
  writeFileSync6(outPath, buf);
  success(`Downloaded to ${outPath} (${(buf.length / 1024).toFixed(1)} KB)`);
}
function addDebugRequestCommands(group, ctx, basePath) {
  group.command("debug-requests <id> <exportOrImportId>").description(
    "List debug request log entries for an export or import.\nRequires debugUntil to be set on the export or import (use enable-debug)."
  ).option("--since <minutes>", "Show requests from the last N minutes.", "60").action(async (id, exportOrImportId, opts) => {
    const minutes = Number.parseInt(opts.since, 10) || 60;
    const timeGt = Date.now() - minutes * 6e4;
    const data = await ctx.getClient().get(`v1/${basePath}/${id}/${exportOrImportId}/requests?time_gt=${timeGt}`);
    formatOutput(data, ctx.getFormat());
  });
  group.command("debug-request-detail <id> <exportOrImportId> <key>").description("Get full request/response detail for a debug log entry.").action(async (id, exportOrImportId, key) => {
    const data = await ctx.getClient().get(`v1/${basePath}/${id}/${exportOrImportId}/requests/${key}`);
    formatOutput(data, ctx.getFormat());
  });
}
function crud(program2, name, endpoint, columns, ctx, description, integrationSubpath) {
  const group = makeResourceGroup(name, endpoint, {
    listColumns: columns,
    description,
    integrationSubpath,
    helpText: HELP[name],
    ...ctx
  });
  program2.addCommand(group);
  return group;
}

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

// src/commands/users.ts
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
