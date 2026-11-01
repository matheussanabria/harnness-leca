// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { makeTempDir } = require("./helpers/temp-dir");
const service = require("../tools/lib/coordination/service");
const { PROVIDERS } = require("../tools/lib/coordination/config");
const { parseScopes, globsOverlap, findConflicts } = require("../tools/lib/coordination/scopes");
const flow = require("../tools/lib/coordination/flow");

const story = (id, fileScopes, dependencies = [], status = "planned") => ({ id, title: id, fileScopes, dependencies, status, document: null });

function withActiveProviders(fn) {
  const previous = Object.fromEntries(Object.entries(PROVIDERS).map(([id, p]) => [id, p.enabled]));
  for (const p of Object.values(PROVIDERS)) p.enabled = true;
  try { return fn(); } finally { for (const [id, enabled] of Object.entries(previous)) PROVIDERS[id].enabled = enabled; }
}

function ledger(docs) {
  const root = makeTempDir("harness-flow-", test);
  fs.mkdirSync(path.join(root, "projects", "demo", "context"), { recursive: true });
  const dir = path.join(root, "docs", "harness-evolution", "02-epics");
  fs.mkdirSync(dir, { recursive: true });
  const lines = [];
  for (const [id, body] of Object.entries(docs)) {
    fs.writeFileSync(path.join(dir, `${id}.md`), body);
    lines.push(`- [ ] [${id}](02-epics/${id}.md) Story ${id}`);
  }
  fs.writeFileSync(path.join(root, "docs", "harness-evolution", "00-index.md"), lines.join("\n"));
  return root;
}

test("parseScopes reads owns: first, then the section 5 list, and drops shared files", () => {
  assert.deepEqual(parseScopes("---\nid: EP-01.01\nowns: [ui/server/**, \"tools/a.js\"]\n---\n# x"), ["ui/server/**", "tools/a.js"]);
  assert.deepEqual(parseScopes("---\nid: x\n---\n## 5. Arquivos\n- tools/a.js\n- `tests/a.test.js` (novo)\n- MAPA.md\n\n## 6. Testes"), ["tools/a.js", "tests/a.test.js"]);
  assert.deepEqual(parseScopes("# sem escopo"), []);
});

test("globsOverlap is conservative on prefixes and exact on literal paths", () => {
  assert.equal(globsOverlap("ui/server/**", "ui/server/x.js"), true);
  assert.equal(globsOverlap("ui/server/**", "ui/public/**"), false);
  assert.equal(globsOverlap("tools/a.js", "tools/b.js"), false);
  assert.equal(globsOverlap("tools/a.js", "tools/a.js"), true);
});

test("findConflicts treats a story without scope as unbounded", () => {
  assert.equal(findConflicts([story("A", ["x/**"]), story("B", ["y/**"])]).length, 0);
  assert.equal(findConflicts([story("A", ["x/**"]), story("B", [])]).length, 1);
});

test("claim is refused when the scope overlaps an active story, and allowed after it completes", () => withActiveProviders(() => {
  const root = ledger({
    "01.01": "---\nowns: [ui/server/**]\n---\n",
    "04.01": "---\nowns: [ui/server/api.js]\n---\n",
    "05.01": "---\nowns: [ui/public/**]\n---\n",
  });
  service.init(root, "demo");
  const claim = (id, provider) => service.mutate(root, "demo", { type: "story.claimed", provider, storyId: id, payload: {} });
  claim("EP-01.01", "codex");
  assert.throws(() => claim("EP-04.01", "codex"), /sobrepoe arquivos de EP-01.01/);
  assert.doesNotThrow(() => claim("EP-05.01", "codex"));
}));

test("claim records the worktree and branch in the ledger", () => withActiveProviders(() => {
  const root = ledger({ "01.01": "---\nowns: [a/**]\n---\n" });
  service.init(root, "demo");
  const r = service.mutate(root, "demo", { type: "story.claimed", provider: "codex", storyId: "EP-01.01", payload: { worktree: "C:/Temp/hl-x", branch: "agent/opencode/jira/EP-01.01" } });
  assert.deepEqual(r.state.stories["EP-01.01"].worktree, { dir: "C:/Temp/hl-x", branch: "agent/opencode/jira/EP-01.01" });
}));

test("planWaves runs disjoint stories together, defers overlaps and dependants, isolates unscoped", () => {
  const stories = { A: story("A", ["ui/server/**"]), B: story("B", ["ui/public/**"]), C: story("C", ["ui/server/x.js"]), D: story("D", [], ["A"]) };
  const { waves, unscoped } = flow.planWaves(stories, ["A", "B", "C", "D"]);
  assert.deepEqual(waves, [["A", "B"], ["C"], ["D"]]);
  assert.deepEqual(unscoped, ["D"]);
  assert.throws(() => flow.planWaves(stories, ["Z"]), /desconhecida/);
});

function repo() {
  const dir = makeTempDir("harness-flow-git-", test);
  const run = (...a) => { // A pre-commit hook exports GIT_DIR/GIT_INDEX_FILE; inheriting them would make these commands rewrite the real repository.
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
  const r = spawnSync("git", a, { cwd: dir, encoding: "utf8", env }); assert.equal(r.status, 0, r.stderr); };
  run("init", "-b", "main");
  run("config", "user.email", "t@t"); run("config", "user.name", "t"); run("config", "commit.gpgsign", "false"); run("config", "core.hooksPath", require("os").devNull); // the user-level hooks path must not run in this throwaway repo
  fs.writeFileSync(path.join(dir, "a.txt"), "1");
  run("add", "."); run("commit", "-m", "init");
  return { dir, run };
}

test("assertCommitted rejects a dirty tree and a branch without commits, then returns the SHA", () => {
  const { dir, run } = repo();
  const wt = { dir, branch: "main" };
  run("checkout", "-b", "agent/x/EP-1");
  assert.throws(() => flow.assertCommitted({ dir, branch: "agent/x/EP-1" }), /nao tem commits/);
  fs.writeFileSync(path.join(dir, "b.txt"), "2");
  assert.throws(() => flow.assertCommitted({ dir, branch: "agent/x/EP-1" }), /sem commit/);
  run("add", "."); run("commit", "-m", "work");
  assert.match(flow.assertCommitted({ dir, branch: "agent/x/EP-1" }), /^[0-9a-f]{7,}$/);
  void wt;
});

test("delegateStory sends the story to the implementation combo with write access in the worktree", () => {
  const dir = makeTempDir("harness-flow-wt-", test);
  let seen = null;
  const spawn = (bin, args, opts) => { seen = { args, opts }; return { status: 0, stdout: JSON.stringify({ type: "text", part: { type: "text", text: "done" } }) + "\n", stderr: "" }; };
  const audit = path.join(dir, "audit.jsonl");
  try {
    flow.delegateStory({ root: dir, story: story("EP-01.01", ["a/**"]), worktree: { dir } }, { spawnSync: /** @type {any} */ (spawn), resolveBin: () => "opencode", auditFile: audit });
  } catch (e) {
    assert.match(String(e.message), /empty answer|OpenCode/); // the fake stream format is not asserted here
  }
  assert.ok(seen, "opencode was invoked");
  assert.equal(seen.opts.cwd, dir);
  assert.match(seen.opts.input, /Implement story EP-01.01/);
  assert.match(JSON.stringify(seen.args), /harness-implementacao/);
  assert.match(fs.readFileSync(audit, "utf8"), /harness-implementacao/);
});
