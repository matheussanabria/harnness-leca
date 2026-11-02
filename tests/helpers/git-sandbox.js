"use strict";
// Isolates throwaway git repos from the real one. The pre-commit hook exports GIT_DIR and
// GIT_INDEX_FILE; a child git inheriting them would rewrite the real repository's index.
const os = require("os");
const { spawnSync } = require("child_process");

/** process.env without any GIT_* variable (plus optional overrides). */
function cleanGitEnv(extra = {}) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith("GIT_") && typeof value === "string") env[key] = value;
  }
  return Object.assign(env, extra);
}

/** Runs git in cwd with a clean environment; returns the spawnSync result. */
function sandboxGit(cwd, args) {
  return spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true, env: cleanGitEnv() });
}

/** Local identity, no signing, and no hooks (the user-level hooksPath must not run in throwaway repos). */
function configureSandboxRepo(cwd, { name = "t", email = "t@t" } = {}) {
  const set = (key, value) => sandboxGit(cwd, ["config", key, value]);
  set("user.name", name);
  set("user.email", email);
  set("commit.gpgsign", "false");
  set("core.hooksPath", os.devNull);
}

/** git init + configureSandboxRepo; returns the init result. */
function initSandboxRepo(cwd, { branch, quiet = true, ...identity } = {}) {
  const args = ["init"];
  if (quiet) args.push("-q");
  if (branch) args.push("-b", branch);
  const result = sandboxGit(cwd, args);
  configureSandboxRepo(cwd, identity);
  return result;
}

module.exports = { cleanGitEnv, sandboxGit, configureSandboxRepo, initSandboxRepo };
