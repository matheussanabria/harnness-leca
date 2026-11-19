// @ts-check
// Database access for CLIs in tools/ (EP-17.01 RF5): same file, same pragmas and the same migration check as
// the server, through ui/server/db/connection.js. A CLI opens its own connection and closes it when done.
// It writes only the tables that owners.js assigns to "cli".
const { openDatabase, resolveDbPath } = require("../../ui/server/db/connection");
const { createRepoBase } = require("../../ui/server/db/repo-base");

/**
 * @param {{ path?: string }} [options]
 * @returns {import("node:sqlite").DatabaseSync}
 */
function openCliDatabase(options = {}) {
  return openDatabase(options);
}

module.exports = { openCliDatabase, createRepoBase, resolveDbPath };
