// @ts-check
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { resolveOpencodeBin } = require("./opencode-bin");
const { parseOpencodeEvents, isFreeOpencodeModel, DEFAULT_OPENCODE_MODEL } = require("./llm");

const DENIED = ["webfetch", "websearch", "task", "skill", "lsp", "external_directory", "doom_loop"];
const MAX_BUFFER = 32 * 1024 * 1024;

/** @param {{write?: boolean, bash?: string[]}} options */
function buildPermissions(options = {}) {
  const permission = Object.fromEntries(DENIED.map((name) => [name, "deny"]));
  permission.read = { "*": "allow", "*.env": "deny", "*.env.*": "deny", "*.env.example": "allow" };
  permission.edit = options.write ? "allow" : "deny";
  permission.bash = { "*": "deny", ...Object.fromEntries((options.bash || []).map((rule) => [rule, "allow"])) };
  return permission;
}

/** @param {{write?: boolean, bash?: string[]}} options */
function buildConfig(options = {}) {
  const permission = buildPermissions(options);
  return {
    $schema: "https://opencode.ai/config.json",
    autoupdate: false,
    share: "disabled",
    permission,
    agent: { executor: { mode: "primary", description: "Executes one governed delegated task", permission } },
  };
}

/**
 * Runs one bounded task through a free OpenCode model. The inline config avoids workspace config files.
 * @param {{dir:string, promptFile:string, model?:string, write?:boolean, bash?:string[], timeoutMinutes?:number}} request
 * @param {{spawnSync?:typeof spawnSync, resolveBin?:typeof resolveOpencodeBin}} [deps]
 */
function delegate(request, deps = {}) {
  const dir = path.resolve(request.dir || "");
  const promptFile = path.resolve(request.promptFile || "");
  const model = request.model || DEFAULT_OPENCODE_MODEL;
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error(`Directory not found: ${dir}`);
  if (!fs.existsSync(promptFile) || !fs.statSync(promptFile).isFile()) throw new Error(`Prompt file not found: ${promptFile}`);
  const isExplicit = Boolean(request.model);
  const isAllowed = isFreeOpencodeModel(model) || (isExplicit && (request.allowPaid || /^(?:openrouter\/)?minimax\//i.test(model)));
  if (!isAllowed) throw new Error(`Refused non-free OpenCode model: ${model}`);
  const bin = (deps.resolveBin || resolveOpencodeBin)();
  if (!bin) throw new Error("OpenCode executable not found.");

  const config = buildConfig(request);
  const env = {
    ...process.env,
    OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
    OPENCODE_PERMISSION: JSON.stringify(config.permission),
    OPENCODE_DISABLE_AUTOUPDATE: "true",
    OPENCODE_DISABLE_DEFAULT_PLUGINS: "true",
    OPENCODE_DISABLE_LSP_DOWNLOAD: "true",
  };
  const run = deps.spawnSync || spawnSync;
  const result = run(bin, ["run", "--pure", "--dir", dir, "--agent", "executor", "-m", model, "--format", "json"], {
    cwd: dir,
    env,
    input: fs.readFileSync(promptFile, "utf8"),
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: Math.max(1, request.timeoutMinutes || 20) * 60_000,
    maxBuffer: MAX_BUFFER,
  });
  if (result.error?.code === "ETIMEDOUT") throw new Error(`OpenCode delegate timed out after ${request.timeoutMinutes || 20} minute(s).`);
  if (result.error) throw result.error;
  const answer = parseOpencodeEvents(result.stdout || "");
  if (result.status !== 0 && !answer) throw new Error(String(result.stderr || `OpenCode exited with ${result.status}`).slice(0, 500));
  if (!answer) throw new Error("OpenCode returned an empty answer.");
  return { answer, model, status: result.status ?? 0 };
}

module.exports = { buildPermissions, buildConfig, delegate };
