// @ts-check
// Guard: a test that runs git must isolate it from the real repository. The pre-commit hook exports
// GIT_DIR/GIT_INDEX_FILE, so a child git that inherits them rewrites the real index, branches and
// core.bare (this corrupted main once). Use tests/helpers/git-sandbox.js (or envLimpo) for every git spawn.
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { cleanGitEnv } = require("./helpers/git-sandbox");

const TESTS_DIR = __dirname;
const GIT_SPAWN = /(?:spawnSync|spawn|execFileSync|execFile)\(\s*["']git["']|(?:execSync|exec)\(\s*[`"']git\s/;
const ISOLATION = /git-sandbox|cleanGitEnv|sandboxGit|initSandboxRepo|envLimpo/;
// Files that only read the real repository (never write): allowed to call git directly.
const READ_ONLY = new Set(["precommit.test.js"]);

test("every test that spawns git uses the sandbox helper (no inherited GIT_*)", () => {
  const offenders = [];
  for (const name of fs.readdirSync(TESTS_DIR)) {
    if (!name.endsWith(".test.js") || name === path.basename(__filename) || READ_ONLY.has(name)) continue;
    const source = fs.readFileSync(path.join(TESTS_DIR, name), "utf8");
    if (GIT_SPAWN.test(source) && !ISOLATION.test(source)) offenders.push(name);
  }
  assert.deepEqual(offenders, [], `tests spawning git without isolation: ${offenders.join(", ")}. Use tests/helpers/git-sandbox.js`);
});

test("cleanGitEnv drops every GIT_* variable and keeps the rest", () => {
  const saved = { dir: process.env.GIT_DIR, index: process.env.GIT_INDEX_FILE, keep: process.env.LECA_KEEP_ME };
  process.env.GIT_DIR = "/real/.git";
  process.env.GIT_INDEX_FILE = "/real/.git/index";
  process.env.LECA_KEEP_ME = "1";
  try {
    const env = cleanGitEnv({ EXTRA: "x" });
    assert.equal(Object.keys(env).some((key) => key.startsWith("GIT_")), false);
    assert.equal(env.LECA_KEEP_ME, "1");
    assert.equal(env.EXTRA, "x");
  } finally {
    for (const [key, value] of [["GIT_DIR", saved.dir], ["GIT_INDEX_FILE", saved.index], ["LECA_KEEP_ME", saved.keep]]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
