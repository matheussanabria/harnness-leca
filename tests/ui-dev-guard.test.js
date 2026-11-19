// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { isWatchMode, isMainCheckout, warnIfWatchOnMain } = require("../tools/lib/ui-dev-guard");

// The pre-commit hook exports GIT_* vars; fixtures must not inherit them.
const env = { ...process.env };
for (const k of Object.keys(env)) if (k.startsWith("GIT_")) delete env[k];

const git = (/** @type {string[]} */ args, /** @type {string} */ cwd) => execFileSync("git", args, { cwd, env, stdio: "ignore" });

const root = fs.mkdtempSync(path.join(os.tmpdir(), "ui-dev-guard-"));
const main = path.join(root, "main");
const wt = path.join(root, "wt");
fs.mkdirSync(main);
git(["init", "-q"], main);
git(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "init"], main);
git(["worktree", "add", "-q", "-b", "feat-x", wt], main);
test.after(() => fs.rmSync(root, { recursive: true, force: true }));

/** @param {string[]} execArgv @param {string} cwd */
function run(execArgv, cwd) {
  /** @type {string[]} */
  const logs = [];
  const warned = warnIfWatchOnMain({ execArgv, cwd, env, log: (m) => logs.push(m) });
  return { warned, logs };
}

test("isWatchMode detects --watch and --watch-path", () => {
  assert.equal(isWatchMode(["--watch"]), true);
  assert.equal(isWatchMode(["--watch-path=ui/server"]), true);
  assert.equal(isWatchMode(["--max-old-space-size=100"]), false);
  assert.equal(isWatchMode([]), false);
});

test("isMainCheckout distinguishes main from worktree", () => {
  assert.equal(isMainCheckout(main, env), true);
  assert.equal(isMainCheckout(wt, env), false);
});

test("watch on main warns", () => {
  const r = run(["--watch-path=ui/server"], main);
  assert.equal(r.warned, true);
  assert.match(r.logs[0], /Use `npm run ui` here/);
});

test("watch in a worktree does not warn", () => {
  const r = run(["--watch"], wt);
  assert.equal(r.warned, false);
  assert.equal(r.logs.length, 0);
});

test("no watch does not warn", () => {
  assert.equal(run([], main).warned, false);
});

test("git failure does not throw and does not warn", () => {
  const notRepo = fs.mkdtempSync(path.join(os.tmpdir(), "ui-dev-guard-nogit-"));
  try {
    assert.equal(run(["--watch"], notRepo).warned, false);
    assert.doesNotThrow(() => warnIfWatchOnMain({ execArgv: ["--watch"], cwd: path.join(notRepo, "missing"), env, log() {} }));
  } finally {
    fs.rmSync(notRepo, { recursive: true, force: true });
  }
});
