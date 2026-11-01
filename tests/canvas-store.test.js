// @ts-check
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-canvas-store-"));
const PROJECTS = path.join(ROOT, "projects");
const SLUG = "projeto-teste";
const SYMLINK_SLUG = "projeto-symlink";
process.env.HARNESS_ROOT = ROOT;
process.env.HARNESS_PROJECTS_DIR = PROJECTS;
fs.mkdirSync(path.join(PROJECTS, SLUG), { recursive: true });
fs.mkdirSync(path.join(PROJECTS, SYMLINK_SLUG), { recursive: true });

// A canvas directory that is a symlink must be rejected by the storage layer.
let symlinkError = null;
try {
  fs.mkdirSync(path.join(ROOT, "outside-target"), { recursive: true });
  fs.symlinkSync(path.join(ROOT, "outside-target"), path.join(PROJECTS, SYMLINK_SLUG, "canvas"), "dir");
} catch (error) {
  symlinkError = error;
}

const store = require("../ui/server/services/canvas/canvas-store");
const canvasDir = () => path.join(PROJECTS, SLUG, "canvas");
const indexFile = () => path.join(canvasDir(), "index.json");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const CREATE = (title, extra = {}) => store.createBoard(SLUG, { kind: "board", title, ...extra });

const expectError = (fn, code, status, check) =>
  assert.throws(fn, (error) => {
    assert.equal(error.name, "CanvasError");
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    if (check) check(error);
    return true;
  });

const diskBoardIds = () =>
  fs.readdirSync(canvasDir()).filter((name) => name.endsWith(".json") && name !== "index.json").map((name) => name.slice(0, -5)).sort();

const expectRebuiltIndex = () => {
  assert.deepEqual(store.listBoards(SLUG).boards.map((entry) => entry.id).sort(), diskBoardIds());
  assert.ok(fs.existsSync(indexFile()));
};

test.after(() => fs.rmSync(ROOT, { recursive: true, force: true }));

test("createBoard returns rev 1, a uuid id and writes the board file", () => {
  const board = CREATE("Primeiro", { data: { a: 1 } });
  assert.equal(board.rev, 1);
  assert.equal(board.kind, "board");
  assert.match(board.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  const file = path.join(canvasDir(), `${board.id}.json`);
  assert.ok(fs.existsSync(file));
  const stored = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(stored.id, board.id);
  assert.equal(stored.rev, 1);
});

test("readBoard returns the same board that was created", () => {
  const board = CREATE("Leitura", { data: { n: 2 } });
  assert.deepEqual(store.readBoard(SLUG, board.id), board);
});

test("update with the right rev bumps rev and updatedAt, kind and id never change", async () => {
  const board = CREATE("Original", { data: { step: 1 } });
  await sleep(10);
  const updated = store.updateBoard(SLUG, board.id, { rev: 1, title: "Trocado" });
  assert.equal(updated.rev, 2);
  assert.ok(String(updated.updatedAt) > String(board.updatedAt));
  assert.equal(updated.kind, board.kind);
  assert.equal(updated.id, board.id);
  assert.deepEqual(store.readBoard(SLUG, board.id), updated);
});

test("a stale rev throws REVISION_CONFLICT with status 409 and details.currentRev", () => {
  const board = CREATE("Stale");
  store.updateBoard(SLUG, board.id, { rev: 1, title: "Nivel 2" });
  expectError(() => store.updateBoard(SLUG, board.id, { rev: 1, title: "Atrasado" }), "REVISION_CONFLICT", 409, (error) => assert.equal(error.details.currentRev, 2));
});

test("an update without rev throws REVISION_REQUIRED", () => {
  const board = CREATE("Sem rev");
  expectError(() => store.updateBoard(SLUG, board.id, { title: "Sem revisao" }), "REVISION_REQUIRED", 400);
});

test("two updates with the same rev: the first wins and the second conflicts", () => {
  const board = CREATE("Corrida");
  const first = store.updateBoard(SLUG, board.id, { rev: 1, title: "Primeira" });
  expectError(() => store.updateBoard(SLUG, board.id, { rev: 1, title: "Perdedora" }), "REVISION_CONFLICT", 409);
  const after = store.readBoard(SLUG, board.id);
  assert.equal(after.rev, 2);
  assert.deepEqual(after, first);
});

test("creating a board with an unknown kind throws INVALID_KIND", () => {
  expectError(() => store.createBoard(SLUG, { kind: "note", title: "Tipo ruim" }), "INVALID_KIND", 400);
});

test("creating a board with an invalid title throws INVALID_TITLE", () => {
  for (const title of ["", "x".repeat(121), "ruim\u0001texto"]) {
    expectError(() => store.createBoard(SLUG, { kind: "board", title }), "INVALID_TITLE", 400);
  }
});

test("creating a board with array or null data throws INVALID_DATA", () => {
  for (const data of [[], null]) {
    expectError(() => store.createBoard(SLUG, { kind: "board", title: "Dado", data }), "INVALID_DATA", 400);
  }
});

test("data over 4 MB throws BOARD_TOO_LARGE with status 413", () => {
  expectError(() => CREATE("Pesado", { data: { big: "x".repeat(4 * 1024 * 1024) } }), "BOARD_TOO_LARGE", 413);
});

test("an empty project slug throws PROJECT_REQUIRED", () => {
  expectError(() => store.createBoard("", { kind: "board", title: "Sem projeto" }), "PROJECT_REQUIRED", 400);
});

test("an unknown project slug throws PROJECT_NOT_FOUND with status 404", () => {
  expectError(() => store.createBoard("projeto-inexistente", { kind: "board", title: "Fantasma" }), "PROJECT_NOT_FOUND", 404);
});

test("a malformed id and an uppercase uuid throw INVALID_ID", () => {
  expectError(() => store.readBoard(SLUG, "../../x"), "INVALID_ID", 400);
  expectError(() => store.readBoard(SLUG, randomUUID().toUpperCase()), "INVALID_ID", 400);
});

test("a well-formed unknown uuid throws BOARD_NOT_FOUND with status 404", () => {
  expectError(() => store.readBoard(SLUG, randomUUID()), "BOARD_NOT_FOUND", 404);
});

test("deleteBoard moves the file to .trash and drops it from listBoards", () => {
  const board = CREATE("Jogar fora");
  assert.deepEqual(store.deleteBoard(SLUG, board.id), { ok: true, id: board.id });
  assert.ok(!fs.existsSync(path.join(canvasDir(), `${board.id}.json`)));
  const trashed = fs.readdirSync(path.join(canvasDir(), ".trash"));
  assert.equal(trashed.length, 1);
  assert.ok(trashed[0].startsWith(board.id));
  const listed = store.listBoards(SLUG).boards.map((entry) => entry.id);
  assert.ok(!listed.includes(board.id));
});

test("listBoards sorts by updatedAt descending", async () => {
  const older = CREATE("Sort A");
  const newer = CREATE("Sort B");
  await sleep(10);
  store.updateBoard(SLUG, older.id, { rev: 1, title: "Sort A atualizado" });
  const boards = store.listBoards(SLUG).boards;
  const ids = boards.map((entry) => entry.id);
  assert.ok(ids.indexOf(older.id) < ids.indexOf(newer.id));
  for (let i = 1; i < boards.length; i += 1) {
    assert.ok(String(boards[i - 1].updatedAt) >= String(boards[i].updatedAt));
  }
});

test("listBoards still lists every board and rebuilds the index after index.json is deleted", () => {
  fs.rmSync(indexFile());
  expectRebuiltIndex();
});

test("listBoards still lists every board and rebuilds the index after index.json is corrupted", () => {
  fs.writeFileSync(indexFile(), "{definitely not json");
  expectRebuiltIndex();
});

test("a symlinked canvas directory makes createBoard throw STORAGE_ERROR without leaking paths", (t) => {
  if (symlinkError) {
    if (symlinkError.code === "EPERM") { t.skip("symlink creation not permitted on this platform (EPERM)"); return; }
    throw symlinkError;
  }
  expectError(() => store.createBoard(SYMLINK_SLUG, { kind: "board", title: "Link" }), "STORAGE_ERROR", 500, (error) => {
    for (const leak of [ROOT, PROJECTS, os.tmpdir(), path.sep]) assert.ok(!error.message.includes(leak));
  });
});

test("an index.json larger than its cap is rebuilt from the board files instead of failing", () => {
  const board = CREATE("keeps listing");
  const indexPath = path.join(canvasDir(), "index.json");
  // Valid JSON, but over the 4 MiB cache cap because of trailing whitespace.
  fs.writeFileSync(indexPath, `${JSON.stringify({ v: 1, boards: [] })}${" ".repeat(4 * 1024 * 1024 + 1)}`);
  const listed = store.listBoards(SLUG).boards.map((entry) => entry.id);
  assert.ok(listed.includes(board.id));
  assert.ok(fs.statSync(indexPath).size < 4 * 1024 * 1024, "the oversized cache was replaced by a compact one");
});
