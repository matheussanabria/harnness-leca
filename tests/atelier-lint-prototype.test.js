const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { parseArgs, biomeBin, CONFIG_DIR } = require("../tools/atelier-pilot/lint-prototype");

function runBiome(dir) {
  return spawnSync(process.execPath, [biomeBin(), "check", `--config-path=${CONFIG_DIR}`, dir], { encoding: "utf8" });
}

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lintproto-"));
  for (const [name, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), body);
  }
  return dir;
}

test("parseArgs reads project, proto and --fix", () => {
  assert.deepEqual(parseArgs(["--project", "p", "--proto", "x", "--fix"]), { fix: true, project: "p", proto: "x" });
  assert.equal(parseArgs(["--project", "p"]).fix, false);
});

test("a clean prototype passes", () => {
  const dir = fixture({ "styles/proto.css": ".a {\n  color: red;\n}\n", "scripts/app.js": "export const a = 1;\n" });
  try {
    assert.equal(runBiome(dir).status, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a lint error in a screen script fails the check", () => {
  const dir = fixture({ "scripts/app.js": "debugger;\n" });
  try {
    const r = runBiome(dir);
    assert.notEqual(r.status, 0);
    assert.match(r.stdout + r.stderr, /debugger/i);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("version history, trash, baselines and data are not checked", () => {
  const bad = "debugger;\n";
  const dir = fixture({
    "scripts/app.js": "export const a = 1;\n",
    ".versions/v1/scripts/app.js": bad,
    ".history/old.js": bad,
    ".trash/x/app.js": bad,
    "baselines/chrome/x.js": bad,
    "data/seed.js": bad,
  });
  try {
    assert.equal(runBiome(dir).status, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("malformed markup that the generator can emit is reported", () => {
  const dir = fixture({ "screens/home.html": '<svg><line class="axis"/ data-pid="p-1"></svg>\n' });
  try {
    assert.notEqual(runBiome(dir).status, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
