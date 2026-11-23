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
  // 002-chat (EP-17.02): the web server; the engine host only reads. "cli" is the one-time importer
  // tools/migrate/chat-import.js, which only inserts conversations for .md files not linked yet.
  chat_conversations: ["web", "cli"],
  chat_engine_sessions: ["web", "cli"],
  chat_messages: ["web", "cli"],
  // 011-chat-runs (EP-23.02): written by the engine host (EP-23.03). The web server writes them only in the legacy
  // in-process mode (HARNESS_ENGINE_HOST=0), when no host runs, so there is still a single writer at a time.
  chat_runs: "host",
  chat_run_events: "host",
  // 025-artifacts (EP-25.03): the web server registers on create; "cli" is the one-time importer
  // tools/migrate/artifact-registry-import.js, which only registers artifacts not linked yet.
  artifacts: ["web", "cli"],
  artifact_files: ["web", "cli"],
  artifact_ownership_log: ["web", "cli"],
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
