// @ts-check
// Forward-only migration runner (EP-17.01 RF2). Migrations live in ui/server/db/migrations/NNN-name.js and
// export `up(db)`. They are recorded by name in schema_migrations; PRAGMA user_version mirrors the highest
// applied number. Gaps are allowed: a lower number merged later is still applied.
// The whole run is ONE BEGIN IMMEDIATE transaction, so a second process opening the same file waits on the
// lock (busy_timeout), then sees the migrated schema and applies nothing.
const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");
const FILE_RE = /^(\d{3})-([a-z0-9][a-z0-9-]*)\.js$/;

/**
 * @typedef {Object} Migration
 * @property {number} number
 * @property {string} name file name without ".js", e.g. "001-init"
 * @property {string} file absolute path
 */

/**
 * Lists the migration files of a directory in ascending number order.
 * @param {string} [dir]
 * @returns {Migration[]}
 */
function listMigrations(dir = MIGRATIONS_DIR) {
  /** @type {Migration[]} */
  const found = [];
  for (const entry of fs.readdirSync(dir)) {
    const match = FILE_RE.exec(entry);
    if (!match) continue;
    found.push({ number: Number(match[1]), name: entry.replace(/\.js$/, ""), file: path.join(dir, entry) });
  }
  found.sort((a, b) => a.number - b.number);
  const seen = new Set();
  for (const m of found) {
    if (seen.has(m.number)) throw new Error(`Duplicate migration number ${m.number} in ${dir}`);
    seen.add(m.number);
  }
  return found;
}

/**
 * @param {import("node:sqlite").DatabaseSync} db
 * @returns {{ name: string, number: number }[]}
 */
function appliedMigrations(db) {
  const has = db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'").get();
  if (!has) return [];
  return /** @type {any[]} */ (db.prepare("SELECT name, number FROM schema_migrations ORDER BY number").all())
    .map((r) => ({ name: String(r.name), number: Number(r.number) }));
}

/**
 * Applies every pending migration. Idempotent; refuses a database holding a migration this code does not know.
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {{ dir?: string }} [options]
 * @returns {{ applied: string[], version: number }}
 */
function migrate(db, options = {}) {
  const known = listMigrations(options.dir);
  const knownNames = new Set(known.map((m) => m.name));
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      number INTEGER NOT NULL,
      applied_at TEXT NOT NULL
    )`);
    const done = appliedMigrations(db);
    const unknown = done.filter((m) => !knownNames.has(m.name));
    if (unknown.length) {
      throw new Error(`Database holds migrations this code does not know (${unknown.map((m) => m.name).join(", ")}); upgrade the code, do not downgrade the schema.`);
    }
    const doneNames = new Set(done.map((m) => m.name));
    /** @type {string[]} */
    const applied = [];
    let version = Math.max(0, ...done.map((m) => m.number));
    for (const m of known) {
      if (doneNames.has(m.name)) continue;
      const mod = require(m.file);
      if (typeof mod.up !== "function") throw new Error(`Migration ${m.name} must export up(db)`);
      mod.up(db);
      db.prepare("INSERT INTO schema_migrations (name, number, applied_at) VALUES (?, ?, ?)").run(m.name, m.number, new Date().toISOString());
      applied.push(m.name);
      version = Math.max(version, m.number);
    }
    if (applied.length) db.exec(`PRAGMA user_version = ${version}`);
    db.exec("COMMIT");
    return { applied, version };
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* no transaction left to roll back */
    }
    throw error;
  }
}

/** @param {import("node:sqlite").DatabaseSync} db */
function schemaVersion(db) {
  const row = /** @type {any} */ (db.prepare("PRAGMA user_version").get());
  return Number(row.user_version);
}

module.exports = { MIGRATIONS_DIR, listMigrations, appliedMigrations, migrate, schemaVersion };
