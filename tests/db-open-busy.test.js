// Opening the database while another process holds a lock on it must wait, not fail with "database is locked".
// Found when tests/db-migrate.test.js (three processes opening one new file) failed about once in 40 runs under CPU
// load: the very first statement of the connection setup ran before any busy timeout existed. The web server and the
// engine host both open this database when they start, so the same race could hit a real start.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { openDatabase } = require("../ui/server/db/connection");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "harness-db-busy-"));
test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* Windows may hold a handle */ } });

const HOLD_MS = 600;

/** A separate process that creates the file, takes an exclusive lock, says so, holds it for HOLD_MS, then commits. */
function holdExclusiveLock(file) {
  const script = `
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(process.argv[1]);
    db.exec("BEGIN EXCLUSIVE");
    db.exec("CREATE TABLE held (x)");
    console.log("locked");
    setTimeout(() => { db.exec("COMMIT"); db.close(); }, ${HOLD_MS});`;
  const child = spawn(process.execPath, ["-e", script, file], { stdio: ["ignore", "pipe", "pipe"] });
  const locked = new Promise((resolve, reject) => {
    let out = "";
    child.stdout.on("data", (chunk) => { out += chunk; if (out.includes("locked")) resolve(undefined); });
    child.on("exit", (code) => reject(new Error(`lock holder exited ${code} before locking`)));
  });
  const done = new Promise((resolve) => child.on("exit", resolve));
  return { locked, done };
}

test("openDatabase waits for another process's lock instead of failing with 'database is locked'", async () => {
  const file = path.join(TMP, "contended.sqlite");
  const holder = holdExclusiveLock(file);
  await holder.locked;

  const started = Date.now();
  const db = openDatabase({ path: file }); // synchronous: the holder is another process, so it keeps running meanwhile
  const waited = Date.now() - started;
  try {
    assert.ok(waited >= HOLD_MS / 3, `it should have waited for the lock, but returned after ${waited} ms`);
    assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'held'").get().n, 1, "it sees what the holder committed");
  } finally {
    db.close();
  }
  await holder.done;
});

// ---- the retry around the WAL switch, with a database that fails on purpose (no luck needed) ----

const { execRetryingBusy, isBusy, applyPragmas, BUSY_TIMEOUT_MS } = require("../ui/server/db/connection");

const busyError = (message = "database is locked", errcode = 5) => Object.assign(new Error(message), { errcode });

/** A database whose exec fails `failures` times with `error`, then works; records every statement. */
function flakyDb(failures, error = busyError()) {
  const calls = [];
  let left = failures;
  return { calls, exec(sql) { calls.push(sql); if (sql.includes("journal_mode") && left > 0) { left -= 1; throw error; } } };
}

test("isBusy recognises SQLITE_BUSY and SQLITE_LOCKED by code or message, and nothing else", () => {
  assert.equal(isBusy(busyError()), true);
  assert.equal(isBusy(busyError("anything", 6)), true);
  assert.equal(isBusy(new Error("SQLITE_BUSY: database is locked")), true);
  assert.equal(isBusy(new Error("no such table: x")), false);
  assert.equal(isBusy(Object.assign(new Error("constraint failed"), { errcode: 19 })), false);
  assert.equal(isBusy(null), false);
  assert.equal(isBusy(undefined), false);
});

test("execRetryingBusy retries a busy statement with growing pauses until it works", () => {
  const db = flakyDb(4);
  const pauses = [];
  execRetryingBusy(db, "PRAGMA journal_mode = WAL", { sleep: (ms) => pauses.push(ms), now: () => 0 });
  assert.equal(db.calls.length, 5, "four failures and then the success");
  assert.deepEqual(pauses, [5, 10, 20, 40], "pauses double");
  const long = [];
  execRetryingBusy(flakyDb(9), "PRAGMA journal_mode = WAL", { sleep: (ms) => long.push(ms), now: () => 0 });
  assert.deepEqual(long.slice(-3), [100, 100, 100], "pauses stop growing at 100 ms");
});

test("execRetryingBusy gives up after the timeout with the original busy error, and never retries other errors", () => {
  let clock = 0;
  const stuck = flakyDb(Infinity);
  assert.throws(
    () => execRetryingBusy(stuck, "PRAGMA journal_mode = WAL", { timeoutMs: 100, sleep: (ms) => { clock += ms; }, now: () => clock }),
    (error) => error.message === "database is locked",
  );
  assert.ok(stuck.calls.length > 2 && clock >= 100, `it kept trying until the deadline (${stuck.calls.length} tries, ${clock} ms)`);

  const broken = flakyDb(5, new Error("disk I/O error"));
  assert.throws(() => execRetryingBusy(broken, "PRAGMA journal_mode = WAL", { sleep: () => assert.fail("must not wait"), now: () => 0 }), /disk I\/O error/);
  assert.equal(broken.calls.length, 1, "a non-busy error is not retried");
});

test("applyPragmas sets the busy timeout first, retries the WAL switch, then the other pragmas", () => {
  const db = flakyDb(2);
  // The real sleep is used here: two retries cost 5 + 10 ms.
  applyPragmas(db);
  assert.deepEqual(db.calls, [
    `PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`,
    "PRAGMA journal_mode = WAL", "PRAGMA journal_mode = WAL", "PRAGMA journal_mode = WAL",
    "PRAGMA synchronous = NORMAL",
    "PRAGMA foreign_keys = ON",
  ]);
});
