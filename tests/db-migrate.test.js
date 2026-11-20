// EP-17.01: forward-only migrations, refusal of unknown schemas and concurrent openers.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const { openDatabase } = require("../ui/server/db/connection");
const { migrate, schemaVersion, appliedMigrations, listMigrations } = require("../ui/server/db/migrate");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "harness-db-mig-"));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

/** Writes a temp migrations dir from { "002-x.js": "CREATE ..." } */
function migrationsDir(name, files) {
  const dir = path.join(TMP, name);
  fs.mkdirSync(dir, { recursive: true });
  for (const [file, sql] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, file), `exports.up = (db) => db.exec(${JSON.stringify(sql)});\n`);
  }
  return dir;
}

test("fresh database reaches the highest known version and re-running changes nothing", () => {
  const known = listMigrations();
  const latest = known[known.length - 1].number;
  const db = openDatabase({ path: path.join(TMP, "fresh.sqlite") });
  try {
    assert.equal(schemaVersion(db), latest);
    assert.deepEqual(appliedMigrations(db).map((m) => m.name), known.map((m) => m.name));
    const again = migrate(db);
    assert.deepEqual(again.applied, []);
    assert.equal(schemaVersion(db), latest);
    assert.equal(db.prepare("SELECT count(*) AS n FROM schema_migrations").get().n, known.length);
  } finally {
    db.close();
  }
});

test("a lower number merged later is still applied; user_version keeps the highest", () => {
  const file = path.join(TMP, "gaps.sqlite");
  const first = migrationsDir("gaps-a", { "001-a.js": "CREATE TABLE a (x)", "005-e.js": "CREATE TABLE e (x)" });
  const second = migrationsDir("gaps-b", { "001-a.js": "CREATE TABLE a (x)", "003-c.js": "CREATE TABLE c (x)", "005-e.js": "CREATE TABLE e (x)" });
  const db = openDatabase({ path: file, migrationsDir: first });
  try {
    assert.equal(schemaVersion(db), 5);
    assert.deepEqual(migrate(db, { dir: second }).applied, ["003-c"]);
    assert.equal(schemaVersion(db), 5);
  } finally {
    db.close();
  }
});

test("refuses a database holding a migration this code does not know", () => {
  const file = path.join(TMP, "newer.sqlite");
  const newer = migrationsDir("newer-a", { "001-a.js": "CREATE TABLE a (x)", "002-b.js": "CREATE TABLE b (x)" });
  const older = migrationsDir("newer-b", { "001-a.js": "CREATE TABLE a (x)" });
  openDatabase({ path: file, migrationsDir: newer }).close();
  assert.throws(() => openDatabase({ path: file, migrationsDir: older }), /does not know.*002-b/);
});

test("a failing migration rolls back everything, including its schema_migrations row", () => {
  const dir = migrationsDir("fail", { "001-a.js": "CREATE TABLE a (x)", "002-bad.js": "CREATE TABLE b (x); SELECT * FROM missing_table" });
  const file = path.join(TMP, "fail.sqlite");
  assert.throws(() => openDatabase({ path: file, migrationsDir: dir }));
  const db = openDatabase({ path: file, migrate: false });
  try {
    assert.deepEqual(appliedMigrations(db), []);
    assert.equal(schemaVersion(db), 0);
    assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name IN ('a','b')").get().n, 0);
  } finally {
    db.close();
  }
});

test("duplicate migration numbers are rejected", () => {
  const dir = migrationsDir("dup", { "001-a.js": "SELECT 1", "001-b.js": "SELECT 1" });
  assert.throws(() => listMigrations(dir), /Duplicate migration number 1/);
});

test("two processes migrating the same file at once end with one schema and no error", async () => {
  const file = path.join(TMP, "race.sqlite");
  const dir = migrationsDir("race", {
    "001-a.js": "CREATE TABLE a (x)",
    "002-b.js": "CREATE TABLE b (x)",
  });
  const script = `
    const { openDatabase } = require(${JSON.stringify(path.join(__dirname, "..", "ui", "server", "db", "connection.js"))});
    const { appliedMigrations } = require(${JSON.stringify(path.join(__dirname, "..", "ui", "server", "db", "migrate.js"))});
    const db = openDatabase({ path: process.argv[1], migrationsDir: process.argv[2] });
    console.log(JSON.stringify(appliedMigrations(db).map((m) => m.name)));
    db.close();`;
  const run = () => new Promise((resolve) => {
    const child = spawn(process.execPath, ["-e", script, file, dir], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    child.on("close", (code) => resolve({ code, out: out.trim(), err }));
  });
  const results = await Promise.all([run(), run(), run()]);
  for (const r of results) {
    assert.equal(r.code, 0, r.err);
    assert.deepEqual(JSON.parse(r.out), ["001-a", "002-b"]);
  }
  const db = openDatabase({ path: file, migrationsDir: dir });
  try {
    assert.equal(db.prepare("SELECT count(*) AS n FROM schema_migrations").get().n, 2);
    assert.equal(schemaVersion(db), 2);
  } finally {
    db.close();
  }
});
