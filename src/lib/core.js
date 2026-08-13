
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
  return;
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
var pkg = JSON.parse(readFileSync5(resolve(__dirname, "..", "..", "package.json"), "utf-8"));
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


export {
  ALLOW_EMPTY_REQUIRED_ARG,
  BASE_USER_AGENT,
  BATCH_SIZE,
  BODY_SHAPE_HINT,
  CHECK_INTERVAL_MS,
  COMMON_VOLATILE,
  CeligoClient,
  DEFAULT_BASE_URL,
  DEFAULT_MODE,
  DEFAULT_PROFILE,
  ENDPOINT_TYPES,
  FIELDS_OPTION_DESCRIPTION,
  FIELDS_OPTION_FLAGS,
  FILE_PREFIX,
  FULL_ONLY_LAST_WORDS,
  FULL_ONLY_PATHS,
  GLOBAL_FLAGS_WITH_VALUE,
  GLOBAL_SETTING_KEYS,
  HANDLER_FIELD_TYPES,
  HELP,
  IDENTITY_FIELDS,
  IMPORT_REFS,
  KNOWN_AGENT_NAMES,
  KNOWN_FORWARD_REFS,
  LONG_REQUEST_TIMEOUT_MS,
  LONG_RUNNING_ENDPOINTS,
  MASKED_CREDENTIAL_ENDPOINTS,
  MAX_ENTRIES_AFTER_ROTATE,
  MAX_LOG_BYTES,
  MAX_MESSAGE_LENGTH,
  MAX_PAGES,
  MAX_RETRIES,
  NO_INPUT_MESSAGE,
  OPT_OUT,
  PATCH_WHITELISTS,
  PKG,
  PROVIDER_BLOCKS,
  READ_ONLY_POST_ENDPOINTS,
  REF_ARRAY_FIELD_TYPES,
  REF_CHECK_TIMEOUT_MS,
  REF_FIELD_TYPES,
  REQUEST_TIMEOUT_MS,
  RESOURCE_TYPES,
  RETRY_BASE_MS,
  RETRY_INTERVAL_MS,
  RULES,
  SET_OPERATE_FIELDS,
  SKILLS_CLI_PACKAGE,
  SKILLS_REMOTE,
  SKILLS_SOURCE,
  SKILLS_TREE_API,
  SKILL_NAME,
  SKIPPED_SUBCOMMANDS,
  SKIPPED_SUBTREES,
  STALE_THRESHOLD_MS,
  STATE_FILE,
  STATE_FILE2,
  T,
  TYPE_REGISTRY,
  UNGATED_PREFIXES,
  URI_REF_PATTERN,
  USER_AGENT,
  VALID_FORMATS,
  VALID_LIST_FIELDS,
  VALID_MODES,
  __dirname,
  activeJqExpression,
  addAuditCommand,
  addCloneCommand,
  addConnectionFlowEntry,
  addDebugCommands,
  addDebugRequestCommands,
  addDependenciesCommand,
  addKnowledgeHelp,
  addProcessorToBranch,
  addProfile,
  addTestRunCommands,
  addWriteCommands,
  agentCapabilityRefs,
  announcement,
  appendRepeated,
  applyActiveTransform,
  applyAssignments,
  applyJq,
  article,
  assertCommandAllowedInMode,
  assertNoMaskedCredentials,
  assertRequiredArgsNonEmpty,
  assertSetFieldsAllowedInMode,
  assertWellFormedEndpoint,
  assignOrDelete,
  autoColumns,
  autoInstallSkills,
  autoUpdate,
  buildConnectionFlowMap,
  buildGraph,
  buildPatchOps,
  buildUrl,
  cachedBinPath,
  cleanupProfileData,
  coerceListFields,
  coerceMode,
  collectFlowStepIds,
  collectNewRows,
  collectProcessorSteps,
  collectRouterSteps,
  collectTransitiveConnections,
  collectUriRefs,
  commandRequirement,
  configDir,
  configFile,
  confirm,
  confirmThen,
  copyPath,
  crud,
  cyan,
  dedupe,
  deepWalk,
  deepWalkField,
  defaultProjection,
  deleteProfile,
  detectItemsKey,
  detectProcessorType,
  ensureFreshIndex,
  errorLogDir,
  errorLogFile,
  esc,
  excludedSkills,
  expandHome,
  extractFieldPaths,
  extractRefs,
  fetchLatestVersion,
  fetchSignedZip,
  fieldsFromSpec,
  findMaskedPaths,
  findOrphans,
  findProcessorList,
  firstResourceId,
  firstSubcommand,
  formatOutput,
  getActiveProfile,
  getAndPrint,
  getConfig,
  getGlobalSetting,
  getProxyDispatcher,
  getProxyUrl,
  guardPasses,
  hintForError,
  indexDir,
  indexFile,
  initUserAgent,
  invalidJsonError,
  isAllAsterisks,
  isBlank,
  isCIEnvironment,
  isIndexStale,
  isJqActive,
  isNewerVersion,
  isOperateAllowedField,
  isReadOnlyPost,
  jsonIndent,
  lastCreatedAt,
  lintIndex,
  lintNoTrigger,
  lintOfflineConnections,
  lintOrphanedResources,
  listAndPrint,
  listProfiles,
  loadConfig,
  loadIndex,
  logError,
  makeResourceGroup,
  nodeRequire,
  normalizeBaseUrl,
  npmExecutable,
  parseAccountAlias,
  parseApiError,
  parseBooleanSetting,
  parseIds,
  parseJqOutput,
  parseKeyPath,
  parseLinkNext,
  parseListFields,
  parseMode,
  parsePositiveInt,
  parseRowLimit,
  parseScalar,
  parseSkillNames,
  pickPaths,
  pkg,
  printDetail,
  printJson,
  printJsonValue,
  printTable,
  projectRows,
  promptPaths,
  promptSecret,
  randomRouterId,
  readBody,
  readConfigFile,
  readEnv,
  readOnlyMessage,
  readPositiveNumberEnv,
  readState,
  readState2,
  readStdin,
  redactToken,
  registerAccount,
  registerSkills,
  release,
  removeProcessorAndPut,
  removeWithConfirm,
  renameProfile,
  renameProfileData,
  replaceConnection,
  reportCursorList,
  requireIndex,
  resolveAssignmentValue,
  resolveBranch,
  resolveJqBinary,
  resolveListFields,
  rotateLog,
  rowId,
  rowsFromResponse,
  runClone,
  runSkillsCli,
  runSnapshot,
  sanitizeMessage,
  saveIndex,
  searchIndex,
  selectSetStrategy,
  setJqExpression,
  setValueAtPath,
  spawnDetached,
  spawnDetachedNode,
  splitQuery,
  stateFile,
  stateFile2,
  success,
  syncProgram,
  timeoutForEndpoint,
  toDisplayString,
  toolBindingRefs,
  transform,
  tryDecodeBase64Json,
  tryReadStdin,
  typeForEndpoint,
  unwritableInstallDir,
  useProfile,
  valueAtDottedPath,
  variantsOf,
  walkDeclaredPath,
  walkStrings,
  warnedUndeclared,
  windowsLauncher,
  withListProjection,
  withProcessorOptions,
  withQuery,
  withQueryParam,
  writeAndReport,
  writeConfig,
  writeConfigFile,
  writeFromBody,
  writeGlobalSetting,
  writeState,
  writeState2
};
