// EP-25.06 RF3: the Canvas accepts the personal workspace (_pessoal) and still rejects reserved and unknown projects.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-scope-canvas-"));
fs.mkdirSync(path.join(dir, "alfa"), { recursive: true });
process.env.HARNESS_PROJECTS_DIR = dir;
delete process.env.HARNESS_DB_PATH;

const { createTestDatabase } = require("../ui/server/db/connection");
const { createArtifactRepo } = require("../ui/server/db/repos/artifact.repo");
const registry = require("../ui/server/services/artifacts/artifact-registry.service");
const store = require("../ui/server/services/canvas/canvas-store");

const db = createTestDatabase();
const repo = createArtifactRepo(db);
registry.setStore(repo);
test.after(() => {
  registry.setStore(undefined);
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const code = (c) => (e) => e.code === c;

test("a board can be created, listed, read, updated and deleted in the personal workspace", () => {
  const created = store.createBoard("_pessoal", { kind: "mindmap", title: "Solto" });
  assert.ok(fs.existsSync(path.join(dir, "_pessoal", "canvas", `${created.id}.json`)));
  assert.ok(fs.existsSync(path.join(dir, "_pessoal", "instructions.md")), "the workspace was created on first use");
  assert.deepEqual(store.listBoards("_pessoal").boards.map((b) => b.id), [created.id]);
  assert.equal(store.readBoard("_pessoal", created.id).title, "Solto");
  const updated = store.updateBoard("_pessoal", created.id, { rev: 1, title: "Solto 2" });
  assert.equal(updated.rev, 2);
  store.deleteBoard("_pessoal", created.id);
  assert.deepEqual(store.listBoards("_pessoal").boards, []);
});

test("a board created without a project is registered with the personal workspace as owner", () => {
  const created = store.createBoard("_pessoal", { kind: "board", title: "Quadro solto" });
  const [artifact] = repo.listByOwner("_pessoal", { type: "canvas.board" });
  assert.equal(artifact.sourceKey, `canvas:_pessoal:${created.id}`);
});

test("real projects keep working and stay separate from the personal workspace", () => {
  const inProject = store.createBoard("alfa", { kind: "board", title: "Do projeto" });
  assert.ok(store.listBoards("alfa").boards.some((b) => b.id === inProject.id));
  assert.ok(!store.listBoards("_pessoal").boards.some((b) => b.id === inProject.id));
});

test("reserved and unknown projects are still rejected", () => {
  assert.throws(() => store.listBoards("_template"), code("PROJECT_NOT_FOUND"));
  assert.throws(() => store.createBoard("nao-existe", { kind: "board", title: "x" }), code("PROJECT_NOT_FOUND"));
  assert.throws(() => store.listBoards(""), code("PROJECT_REQUIRED"));
});
