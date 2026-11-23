// EP-25.03: one-time importer and the Canvas registration hook.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-artifacts-"));
process.env.HARNESS_PROJECTS_DIR = dir;
delete process.env.HARNESS_DB_PATH;

const { createTestDatabase } = require("../ui/server/db/connection");
const { createArtifactRepo } = require("../ui/server/db/repos/artifact.repo");
const { importArtifacts } = require("../tools/migrate/artifact-registry-import");
const registry = require("../ui/server/services/artifacts/artifact-registry.service");
const { createBoard } = require("../ui/server/services/canvas/canvas-store");
test.after(() => {
  registry.setStore(undefined);
  fs.rmSync(dir, { recursive: true, force: true });
});

function board(owner, kind, title) {
  const id = crypto.randomUUID();
  const canvas = path.join(dir, owner, "canvas");
  fs.mkdirSync(canvas, { recursive: true });
  fs.writeFileSync(path.join(canvas, `${id}.json`), JSON.stringify({ id, kind, title, createdAt: "2026-01-01T00:00:00.000Z", data: {} }));
  return id;
}

test("importer registers boards of every owner by kind, ignores index and junk, and never moves files", () => {
  const db = createTestDatabase();
  try {
    const repo = createArtifactRepo(db);
    const a = board("alfa", "board", "Quadro");
    board("alfa", "mindmap", "Mapa");
    board("_pessoal", "diagram", "Solto");
    fs.writeFileSync(path.join(dir, "alfa", "canvas", "index.json"), "{}");
    fs.writeFileSync(path.join(dir, "alfa", "canvas", `${crypto.randomUUID()}.json`), "{ not json");
    fs.mkdirSync(path.join(dir, "_template", "canvas"), { recursive: true });

    const totals = importArtifacts(repo, dir);
    assert.equal(totals.registered, 3);
    assert.equal(totals.failed.length, 1, "the unreadable file is reported, not fatal");
    assert.deepEqual(totals.byType, { "canvas.board": 1, "canvas.mindmap": 1, "canvas.diagram": 1 });
    assert.equal(repo.listByOwner("_pessoal").length, 1);
    assert.equal(repo.listByOwner("alfa", { type: "canvas.mindmap" })[0].title, "Mapa");
    const files = repo.filesOf(repo.getBySourceKey(`canvas:alfa:${a}`).id);
    assert.equal(files[0].path, `alfa/canvas/${a}.json`);
    assert.match(files[0].contentHash, /^[0-9a-f]{64}$/);
    assert.ok(fs.existsSync(path.join(dir, "alfa", "canvas", `${a}.json`)), "the source file is untouched");
  } finally {
    db.close();
  }
});

test("running the importer twice registers nothing new", () => {
  const db = createTestDatabase();
  try {
    const repo = createArtifactRepo(db);
    const first = importArtifacts(repo, dir);
    const second = importArtifacts(repo, dir);
    assert.equal(second.registered, 0);
    assert.equal(second.skipped, first.registered);
    assert.equal(repo.listByOwner("alfa").length, 2);
  } finally {
    db.close();
  }
});

test("the registry stays off when the projects dir is redirected without a database path", () => {
  registry.setStore(undefined);
  assert.equal(registry.getStore(), null);
});

test("creating a Canvas board registers it with the project as owner", () => {
  const db = createTestDatabase();
  try {
    const repo = createArtifactRepo(db);
    registry.setStore(repo);
    const created = createBoard("alfa", { kind: "mindmap", title: "Novo mapa" });
    const [artifact] = repo.listByOwner("alfa", { type: "canvas.mindmap" }).filter((x) => x.sourceKey === `canvas:alfa:${created.id}`);
    assert.equal(artifact.title, "Novo mapa");
    assert.equal(repo.history(artifact.id)[0].actor, "web");
  } finally {
    registry.setStore(undefined);
    db.close();
  }
});

test("a registry failure never breaks board creation", () => {
  registry.setStore({ register() { throw new Error("db down"); } });
  const warn = console.warn;
  console.warn = () => {};
  try {
    const created = createBoard("alfa", { kind: "board", title: "Sobrevive" });
    assert.ok(created.id);
  } finally {
    console.warn = warn;
    registry.setStore(undefined);
  }
});
