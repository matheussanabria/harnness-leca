// @ts-check
// One owner process per table (EP-17.01 RF7, ADR-012 write discipline). Only the owner writes; other
// processes read or ask the owner's API. This is enforced by tests/db-owners.test.js, not at runtime.
// Every migration that creates a table adds its entry here in the same commit.

/** @typedef {"web" | "host" | "cli"} Owner */

/** @type {Record<string, Owner | Owner[]>} */
const OWNERS = {
  // Created by the migration runner itself; any process may migrate.
  schema_migrations: ["web", "host", "cli"],
  // 001-init
  meta: "web",
};

/**
 * @param {string} table
 * @returns {Owner[]}
 */
function ownersOf(table) {
  const entry = OWNERS[table];
  if (!entry) throw new Error(`Table "${table}" has no owner in ui/server/db/owners.js`);
  return Array.isArray(entry) ? entry : [entry];
}

/**
 * @param {string} table
 * @param {Owner} processName
 */
function canWrite(table, processName) {
  return ownersOf(table).includes(processName);
}

module.exports = { OWNERS, ownersOf, canWrite };
