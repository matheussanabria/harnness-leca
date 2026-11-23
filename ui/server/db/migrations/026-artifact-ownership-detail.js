// @ts-check
// 026: detail for ownership changes (EP-25.04). `snapshot` holds the destination files and their hashes at the
// moment of a move, so an undo is only allowed while nothing changed. `undo_of` links an undo to the move it reverts.
// Owner: same as artifact_ownership_log (ui/server/db/owners.js).

/** @param {import("node:sqlite").DatabaseSync} db */
function up(db) {
  db.exec("ALTER TABLE artifact_ownership_log ADD COLUMN snapshot TEXT");
  db.exec("ALTER TABLE artifact_ownership_log ADD COLUMN undo_of INTEGER REFERENCES artifact_ownership_log (id)");
}

module.exports = { up };
