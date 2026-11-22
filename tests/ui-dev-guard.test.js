// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { isWatchMode, isMainCheckout, warnIfWatchOnMain } = require("../tools/lib/ui-dev-guard");
const { cleanGitEnv, sandboxGit, initSandboxRepo } = require("./helpers/git-sandbox");

// The pre-commit hook exports GIT_* vars; fixtures must not inherit them (tests/helpers/git-sandbox.js).
const env = cleanGitEnv();

const root = fs.mkdtempSync(path.join(os.tmpdir(), "ui-dev-guard-"));
const main = path.join(root, "main");
const wt = path.join(root, "wt");
fs.mkdirSync(main);
initSandboxRepo(main);
sandboxGit(main, ["commit", "-q", "--allow-empty", "-m", "init"]);
sandboxGit(main, ["worktree", "add", "-q", "-b", "feat-x", wt]);
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

// ---- the real thing: Node's watch mode runs the script in a child with different execArgv ----

test("isWatchMode reads what survives in the watch-mode child: --watch-preserve-output and WATCH_REPORT_DEPENDENCIES", () => {
  assert.equal(isWatchMode(["--watch-preserve-output"], {}), true);
  assert.equal(isWatchMode([], { WATCH_REPORT_DEPENDENCIES: "1" }), true);
  assert.equal(isWatchMode([], {}), false);
  assert.equal(isWatchMode(["--max-old-space-size=100"], { PATH: "x" }), false);
});

/**
 * Runs the guard inside a REAL `node --watch-path` child, the way `npm run ui:dev` does, and returns what it printed.
 * @param {string} cwd
 */
function realWatchRun(cwd) {
  const { spawn } = require("child_process");
  const script = path.join(root, "probe.js");
  fs.writeFileSync(script, `const g = require(${JSON.stringify(path.join(__dirname, "..", "tools", "lib", "ui-dev-guard"))});\nconst warned = g.warnIfWatchOnMain({ log: (m) => console.log("WARN:" + m) });\nconsole.log("RESULT:" + warned);\n`);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--watch-path=" + root, "--watch-preserve-output", script], { cwd, env });
    let out = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error(`no result in 10 s: ${out}`)); }, 10000);
    child.stdout.on("data", (chunk) => {
      out += chunk;
      if (out.includes("RESULT:")) { clearTimeout(timer); child.kill(); resolve(out); }
    });
  });
}

test("EP-23.01 in real watch mode: the warning appears in the main checkout and not in a worktree", async () => {
  const inMain = await realWatchRun(main);
  assert.match(inMain, /WARN:\[ui-dev-guard\] Auto restart \(--watch\) in the main checkout/);
  assert.match(inMain, /RESULT:true/);
  const inWorktree = await realWatchRun(wt);
  assert.doesNotMatch(inWorktree, /WARN:/);
  assert.match(inWorktree, /RESULT:false/);
});
