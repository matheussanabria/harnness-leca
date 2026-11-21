// @ts-check
// 012: links a resumed chat run to the run it continues (EP-23.04). Owner: the engine host, like the rest of
// chat_runs (ui/server/db/owners.js).

/** @param {import("node:sqlite").DatabaseSync} db */
function up(db) {
  db.exec("ALTER TABLE chat_runs ADD COLUMN resumed_from TEXT");
}

module.exports = { up };
