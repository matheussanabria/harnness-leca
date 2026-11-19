// @ts-check
// 001: meta table only (EP-17.01). Later stories add their own tables with the numbers reserved in the EP-17
// README, and register each table's owner in ui/server/db/owners.js in the same commit.

/** @param {import("node:sqlite").DatabaseSync} db */
function up(db) {
  db.exec(`CREATE TABLE meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
}

module.exports = { up };
