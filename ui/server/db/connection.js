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

/**
 * Applies the connection pragmas. busy_timeout goes first so the journal_mode switch and every later
 * statement wait for a concurrent opener instead of failing with SQLITE_BUSY.
 * @param {DatabaseSync} db
 */
function applyPragmas(db) {
  db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
  db.exec("PRAGMA journal_mode = WAL");
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

module.exports = { BUSY_TIMEOUT_MS, resolveDbPath, applyPragmas, openDatabase, getDb, closeDb, createTestDatabase };
