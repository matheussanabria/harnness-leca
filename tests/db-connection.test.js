// EP-17.01: connection pragmas, path override and smoke check for node:sqlite.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "harness-db-conn-"));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

test("node:sqlite is available (smoke)", () => {
  assert.doesNotThrow(() => require("node:sqlite"), "node:sqlite is missing: use the Node version pinned in package.json engines");
});

const { openDatabase, resolveDbPath, createTestDatabase } = require("../ui/server/db/connection");

const pragma = (db, name) => Object.values(db.prepare(`PRAGMA ${name}`).get())[0];

test("pragmas: WAL, busy_timeout 5000, foreign_keys ON", () => {
  const file = path.join(TMP, "nested", "a.sqlite");
  const db = openDatabase({ path: file });
  try {
    assert.equal(pragma(db, "journal_mode"), "wal");
    assert.equal(pragma(db, "busy_timeout"), 5000);
    assert.equal(pragma(db, "foreign_keys"), 1);
    assert.ok(fs.existsSync(file), "creates the missing directory and the file");
  } finally {
    db.close();
  }
});

test("HARNESS_DB_PATH overrides the default location", () => {
  const prev = process.env.HARNESS_DB_PATH;
  try {
    process.env.HARNESS_DB_PATH = path.join(TMP, "override.sqlite");
    assert.equal(resolveDbPath(), path.join(TMP, "override.sqlite"));
    delete process.env.HARNESS_DB_PATH;
    assert.equal(resolveDbPath(), path.join(require("../tools/lib/root").ROOT, "data", "harness.sqlite"));
  } finally {
    if (prev === undefined) delete process.env.HARNESS_DB_PATH;
    else process.env.HARNESS_DB_PATH = prev;
  }
});

test("foreign keys are enforced", () => {
  const db = createTestDatabase();
  try {
    db.exec("CREATE TABLE p (id INTEGER PRIMARY KEY); CREATE TABLE c (pid INTEGER REFERENCES p(id))");
    assert.throws(() => db.exec("INSERT INTO c VALUES (99)"), /FOREIGN KEY/);
  } finally {
    db.close();
  }
});

test("the file is user-only where the OS supports POSIX modes", { skip: process.platform === "win32" }, () => {
  const file = path.join(TMP, "perm.sqlite");
  openDatabase({ path: file }).close();
  assert.equal(fs.statSync(file).mode & 0o077, 0);
});

test("repo-base: transaction commits, rolls back, nests and caches statements", () => {
  const { createRepoBase } = require("../ui/server/db/repo-base");
  const db = createTestDatabase();
  try {
    const repo = createRepoBase(db);
    db.exec("CREATE TABLE t (v TEXT)");
    const insert = (v) => repo.prepare("INSERT INTO t VALUES (?)").run(v);
    assert.equal(repo.prepare("SELECT 1"), repo.prepare("SELECT 1"));
    repo.transaction(() => insert("ok"));
    assert.throws(() => repo.transaction(() => { insert("lost"); throw new Error("boom"); }), /boom/);
    repo.transaction(() => {
      insert("outer");
      assert.throws(() => repo.transaction(() => { insert("inner-lost"); throw new Error("x"); }));
    });
    assert.deepEqual(db.prepare("SELECT v FROM t ORDER BY rowid").all().map((r) => r.v), ["ok", "outer"]);
    assert.throws(() => repo.transaction(async () => 1), /synchronous/);
    assert.equal(repo.fromJson(repo.toJson({ a: 1 })).a, 1);
    assert.equal(repo.fromJson("{bad", "dflt"), "dflt");
  } finally {
    db.close();
  }
});
