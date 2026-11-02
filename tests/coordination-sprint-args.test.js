// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { makeTempDir } = require("./helpers/temp-dir");

const CLI = path.resolve(__dirname, "..", "tools", "coordination.js");

// EP-01.01 and EP-02.01 overlap on a/; EP-03.01 is independent. Separate epics avoid the implicit previous-story dependency,
// so any wave split below comes from scope overlap alone.
const STORIES = {
  "EP-01.01": "---\nid: EP-01.01\nowns: [a/**]\n---\n# one",
  "EP-02.01": "---\nid: EP-02.01\nowns: [a/x.js]\n---\n# two",
  "EP-03.01": "---\nid: EP-03.01\nowns: [b/**]\n---\n# three",
};

function sandbox() {
  const root = makeTempDir("harness-sprint-args-", test);
  fs.mkdirSync(path.join(root, "projects", "demo", "context"), { recursive: true });
  const dir = path.join(root, "docs", "harness-evolution", "02-epics");
  fs.mkdirSync(dir, { recursive: true });
  const lines = Object.entries(STORIES).map(([id, body]) => {
    fs.writeFileSync(path.join(dir, `${id}.md`), body);
    return `- [ ] [${id.slice(3)}](02-epics/${id}.md) Story ${id}`;
  });
  fs.writeFileSync(path.join(root, "docs", "harness-evolution", "00-index.md"), lines.join("\n"));
  return root;
}

/** Runs the real CLI against an isolated root; GIT_* is dropped so a pre-commit hook cannot leak in. */
function sprint(root, ...args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
  const r = spawnSync(process.execPath, [CLI, "sprint", ...args], { encoding: "utf8", env: { ...env, HARNESS_ROOT: root } });
  return { status: r.status, out: r.stdout, err: r.stderr };
}

test("sprint keeps the first id and puts overlapping stories in different waves", () => {
  const r = sprint(sandbox(), "EP-01.01", "EP-02.01", "EP-03.01", "--project", "demo");
  assert.equal(r.status, 0, r.err);
  assert.match(r.out, /Wave 1 \(parallel\): EP-01.01, EP-03.01/);
  assert.match(r.out, /Wave 2 \(parallel\): EP-02.01/);
});

test("sprint ignores non-id tokens such as pilot and flag values without dropping real ids", () => {
  const root = sandbox();
  const plain = sprint(root, "EP-01.01", "EP-03.01", "--project", "demo");
  const noisy = sprint(root, "pilot", "EP-01.01", "--project", "demo", "EP-03.01", "--verbose");
  assert.equal(noisy.status, 0, noisy.err);
  assert.equal(noisy.out, plain.out);
  assert.match(noisy.out, /EP-01\.01/);
});

test("sprint reads ids placed after the flags and never mistakes the project slug for an id", () => {
  const r = sprint(sandbox(), "--project", "demo", "EP-03.01", "EP-01.01");
  assert.equal(r.status, 0, r.err);
  assert.match(r.out, /Wave 1 \(parallel\): EP-03.01, EP-01\.01/);
});

test("sprint rejects an empty selection and malformed ids instead of guessing", () => {
  const root = sandbox();
  for (const args of [["pilot"], ["EP-1.1", "EP-01.1", "EP-01.01x"], []]) {
    const r = sprint(root, ...args, "--project", "demo");
    assert.notEqual(r.status, 0, `expected failure for ${JSON.stringify(args)}`);
    assert.match(r.err, /Informe as historias do sprint/);
  }
});

test("sprint reports an unknown but well-formed id", () => {
  const r = sprint(sandbox(), "EP-09.99", "--project", "demo");
  assert.notEqual(r.status, 0);
  assert.match(r.err, /Historia desconhecida: EP-09\.99/);
});
