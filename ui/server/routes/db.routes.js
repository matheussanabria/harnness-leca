// @ts-check
// Database health route (EP-17.01 RF6).
const fs = require("fs");
const path = require("path");
const { send } = require("../config");
const { getDb, resolveDbPath } = require("../db/connection");
const { appliedMigrations, schemaVersion } = require("../db/migrate");

/** @param {string} file */
function sizeOf(file) {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
}

/** GET /api/db/health: schema version, sizes and WAL status. Never exposes the full path. */
function apiDbHealth({ res }) {
  try {
    const db = getDb();
    const file = resolveDbPath();
    const one = (/** @type {string} */ pragma) => /** @type {any} */ (db.prepare(`PRAGMA ${pragma}`).get());
    return send(res, 200, {
      ok: true,
      file: path.basename(file),
      schemaVersion: schemaVersion(db),
      migrations: appliedMigrations(db).map((m) => m.name),
      sizeBytes: sizeOf(file),
      wal: { journalMode: one("journal_mode").journal_mode, walBytes: sizeOf(`${file}-wal`) },
      foreignKeys: one("foreign_keys").foreign_keys === 1,
      busyTimeoutMs: one("busy_timeout").timeout,
    });
  } catch {
    return send(res, 503, { ok: false, error: "database unavailable" });
  }
}

const dbRoutes = [{ method: "GET", path: "/api/db/health", handler: apiDbHealth }];

module.exports = { dbRoutes };
