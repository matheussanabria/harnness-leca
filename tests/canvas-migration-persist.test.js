// @ts-check
// The store rewrites a migrated board on read, keeping one .v<N>.bak.json copy of the original.
// canvas-migrate is stubbed BEFORE the store is required, because the store binds migrateBoard at load time.
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-canvas-migrate-"));
const PROJECTS = path.join(ROOT, "projects");
const SLUG = "projeto-teste";
process.env.HARNESS_ROOT = ROOT;
process.env.HARNESS_PROJECTS_DIR = PROJECTS;
fs.mkdirSync(path.join(PROJECTS, SLUG), { recursive: true });

const migrate = require("../ui/server/services/canvas/canvas-migrate");
let migrations = 0;
migrate.migrateBoard = (raw) => {
  const needs = raw.title !== "migrated";
  if (needs) migrations += 1;
  return { board: { ...raw, title: "migrated" }, from: 1, changed: needs };
};
const { createBoard, readBoard } = require("../ui/server/services/canvas/canvas-store");

test.after(() => fs.rmSync(ROOT, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }));

test("reading a board that needs migration keeps one .bak of the original and rewrites the file", () => {
  const created = createBoard(SLUG, { title: "original", kind: "board", data: { a: 1 } });
  const dir = path.join(PROJECTS, SLUG, "canvas");
  const file = path.join(dir, `${created.id}.json`);
  const originalText = fs.readFileSync(file, "utf8");
  const base = migrations; // creating a board rebuilds the index, which also passes through migrateBoard

  const first = readBoard(SLUG, created.id);
  assert.equal(first.title, "migrated");
  assert.equal(migrations, base + 1);
  const bak = path.join(dir, `${created.id}.v1.bak.json`);
  assert.equal(fs.readFileSync(bak, "utf8"), originalText, "the backup is the untouched original");
  assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).title, "migrated");

  const bakAfterFirst = fs.readFileSync(bak, "utf8");
  readBoard(SLUG, created.id);
  assert.equal(migrations, base + 1, "an already migrated file is not migrated again");
  assert.equal(fs.readFileSync(bak, "utf8"), bakAfterFirst, "the backup is never overwritten");
});
