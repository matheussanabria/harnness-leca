// @ts-check
// Shared SQLite connection for data/harness.sqlite (EP-17.01, ADR-012).
// Every process (web server, engine host, CLIs) opens its OWN connection through this module, with the same
// pragmas and the same migration check. Nothing else outside ui/server/db/ may require node:sqlite.
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { ROOT } = require("../../../tools/lib/root");
const { migrate } = require("./migrate");

const BUSY_TIMEOUT_MS = 5000;
const DEFAULT_REL = path.join("data", "harness.sqlite");

/** @returns {string} absolute database path; HARNESS_DB_PATH overrides data/harness.sqlite under the root. */
function resolveDbPath() {
  const override = process.env.HARNESS_DB_PATH;
  return override ? path.resolve(override) : path.join(ROOT, DEFAULT_REL);
}

/**
 * Best effort: user-only access. On Windows chmod only toggles the read-only bit, so failures are ignored.
 * @param {string} file
 * @param {number} mode
 */
function restrictPermissions(file, mode) {
  try {
    fs.chmodSync(file, mode);
  } catch {
    /* the OS or filesystem does not support it */
  }
}

/** True for the errors SQLite raises when another connection holds a lock (SQLITE_BUSY 5, SQLITE_LOCKED 6). @param {unknown} error */
const isBusy = (error) => {
  const e = /** @type {{ message?: unknown, errcode?: unknown } | null} */ (error);
  return e?.errcode === 5 || e?.errcode === 6 || /database is locked|SQLITE_BUSY/i.test(String(e?.message ?? ""));
};

/** Blocks the thread for `ms` without spinning (the connection setup is synchronous). @param {number} ms */
const sleepSync = (ms) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

/**
 * Runs a statement and retries while the database is busy, for up to `timeoutMs`. Needed for the switch to WAL: when
 * several connections race to change the journal mode of a new file, SQLite refuses the loser at once, without calling
 * the busy handler (to avoid a deadlock), so `busy_timeout` does not cover it. Seen about once in 40 runs of three
 * processes opening one new file under CPU load (tests/db-migrate.test.js).
 * @param {{ exec: (sql: string) => unknown }} db
 * @param {string} sql
 * @param {{ timeoutMs?: number, sleep?: (ms: number) => void, now?: () => number }} [options] injectable for tests
 */
function execRetryingBusy(db, sql, { timeoutMs = BUSY_TIMEOUT_MS, sleep = sleepSync, now = Date.now } = {}) {
  const deadline = now() + timeoutMs;
  let delay = 5;
  for (;;) {
    try {
      db.exec(sql);
      return;
    } catch (error) {
      if (!isBusy(error) || now() >= deadline) throw error;
      sleep(delay);
      delay = Math.min(delay * 2, 100);
    }
  }
}

/**
 * Applies the connection pragmas. busy_timeout goes first so every later statement waits for a concurrent opener
 * instead of failing with SQLITE_BUSY; the journal_mode switch is retried by hand because busy_timeout does not cover it.
 * @param {DatabaseSync} db
 */
function applyPragmas(db) {
  db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
  execRetryingBusy(db, "PRAGMA journal_mode = WAL");
  // NORMAL is the usual WAL setting: no fsync per commit (FULL measured ~13 ms p95 per small commit, EP-23.02).
  // Survives a process crash; only a power loss or OS crash may drop the last commits, never corrupt the file.
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA foreign_keys = ON");
}

/**
 * Opens a new connection (never cached) and migrates unless `migrate: false`.
 * @param {{ path?: string, migrate?: boolean, migrationsDir?: string }} [options] path ":memory:" gives a private database.
 * @returns {DatabaseSync}
 */
function openDatabase(options = {}) {
  const file = options.path || resolveDbPath();
  const inMemory = file === ":memory:";
  if (!inMemory) fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(file);
  try {
    applyPragmas(db);
    if (options.migrate !== false) migrate(db, options.migrationsDir ? { dir: options.migrationsDir } : {});
  } catch (error) {
    db.close();
    throw error;
  }
  if (!inMemory) restrictPermissions(file, 0o600);
  return db;
}

/** @type {DatabaseSync | null} */
let shared = null;

/** Process-wide connection used by the web server (opened lazily, migrated once). */
function getDb() {
  if (!shared) shared = openDatabase();
  return shared;
}

/** Closes the process-wide connection (tests and shutdown; Windows cannot delete an open file). */
function closeDb() {
  if (shared) {
    shared.close();
    shared = null;
  }
}

/** Fixture helper (RF4): a fresh, fully migrated in-memory database. The caller closes it. */
function createTestDatabase() {
  return openDatabase({ path: ":memory:" });
}

module.exports = { BUSY_TIMEOUT_MS, execRetryingBusy, isBusy, resolveDbPath, applyPragmas, openDatabase, getDb, closeDb, createTestDatabase };
