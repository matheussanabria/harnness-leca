// @ts-check
// Guard for `npm run ui:dev` (EP-23.01): auto restart in the main checkout drops live chat answers.
const { execFileSync } = require("child_process");
const path = require("path");

const WARNING =
  "Auto restart (--watch) in the main checkout drops live chat answers. Use `npm run ui` here; keep `npm run ui:dev` for worktrees.";

/**
 * In watch mode Node runs the script in a CHILD process whose execArgv no longer has --watch or --watch-path (only
 * --watch-preserve-output survives) and which has WATCH_REPORT_DEPENDENCIES set. The first version of this guard looked
 * only at --watch and --watch-path, so the warning never appeared in a real `npm run ui:dev` (found while checking
 * the EP-23.01 acceptance criteria); both signals are read now.
 * @param {string[]} [execArgv] @param {NodeJS.ProcessEnv} [env]
 */
function isWatchMode(execArgv = process.execArgv, env = process.env) {
  const flags = (execArgv || []).some((a) => a === "--watch" || a.startsWith("--watch=") || a.startsWith("--watch-path") || a === "--watch-preserve-output");
  return flags || Boolean(env && env.WATCH_REPORT_DEPENDENCIES);
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
    if (!isWatchMode(execArgv, env) || !isMainCheckout(cwd, env)) return false;
    log(`[ui-dev-guard] ${WARNING}`);
    return true;
  } catch {
    return false;
  }
}

module.exports = { isWatchMode, isMainCheckout, warnIfWatchOnMain, WARNING };
