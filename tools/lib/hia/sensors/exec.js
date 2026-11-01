// @ts-check
// Small async process runner and temp-dir helper for the answer sensors. Async on purpose: the chat server must not
// block its event loop while a checker runs. Nothing here executes the code under inspection; callers only pass it
// to parsers and compilers (javac -proc:none, python ast, biome).
const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

/**
 * @typedef {{ code: number | null, stdout: string, stderr: string, timedOut: boolean, missing: boolean }} RunResult
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ input?: string, cwd?: string, timeoutMs?: number }} [o]
 * @returns {Promise<RunResult>}
 */
function run(cmd, args, o = {}) {
  return new Promise((resolve) => {
    // Git hooks and test runners often export FORCE_COLOR; Python 3.13+ then colors its tracebacks with ANSI codes
    // and the line numbers we parse get wrapped in escapes. Checkers always run without color.
    /** @type {NodeJS.ProcessEnv} */
    const env = { ...process.env, NO_COLOR: "1", PYTHON_COLORS: "0" };
    delete env.FORCE_COLOR;
    const child = execFile(cmd, args, { cwd: o.cwd, env, timeout: o.timeoutMs ?? 8000, windowsHide: true, maxBuffer: 2 * 1024 * 1024, encoding: "utf8" }, (err, stdout, stderr) => {
      const e = /** @type {any} */ (err);
      resolve({
        code: e ? (typeof e.code === "number" ? e.code : null) : 0,
        stdout: String(stdout || ""),
        stderr: String(stderr || ""),
        timedOut: Boolean(e && (e.killed || e.signal) && e.code !== 0 && typeof e.code !== "number"),
        missing: Boolean(e && e.code === "ENOENT"),
      });
    });
    if (o.input !== undefined) child.stdin?.end(o.input);
  });
}

/**
 * Runs `fn(dir)` in a fresh temp directory outside the repository and always removes it.
 * @template T
 * @param {(dir: string) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hia-sensor-"));
  try {
    return await fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { run, withTempDir };
