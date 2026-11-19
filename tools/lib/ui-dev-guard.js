// @ts-check
// Guard for `npm run ui:dev` (EP-23.01): auto restart in the main checkout drops live chat answers.
const { execFileSync } = require("child_process");
const path = require("path");

const WARNING =
  "Auto restart (--watch) in the main checkout drops live chat answers. Use `npm run ui` here; keep `npm run ui:dev` for worktrees.";

/** @param {string[]} [execArgv] */
function isWatchMode(execArgv = process.execArgv) {
  return (execArgv || []).some((a) => a === "--watch" || a.startsWith("--watch=") || a.startsWith("--watch-path"));
}

/**
 * True when cwd is the main checkout (git dir equals common dir). Returns false when git fails.
 * @param {string} [cwd]
 * @param {NodeJS.ProcessEnv} [env]
 */
function isMainCheckout(cwd = process.cwd(), env = process.env) {
  try {
    const git = (/** @type {string} */ flag) =>
      path.resolve(
        cwd,
        execFileSync("git", ["rev-parse", flag], { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
      );
    return git("--git-dir") === git("--git-common-dir");
  } catch {
    return false;
  }
}

/**
 * @param {{ execArgv?: string[], cwd?: string, env?: NodeJS.ProcessEnv, log?: (msg: string) => void }} [opts]
 * @returns {boolean} true when the warning was emitted
 */
function warnIfWatchOnMain({ execArgv = process.execArgv, cwd = process.cwd(), env = process.env, log = console.warn } = {}) {
  try {
    if (!isWatchMode(execArgv) || !isMainCheckout(cwd, env)) return false;
    log(`[ui-dev-guard] ${WARNING}`);
    return true;
  } catch {
    return false;
  }
}

module.exports = { isWatchMode, isMainCheckout, warnIfWatchOnMain, WARNING };
