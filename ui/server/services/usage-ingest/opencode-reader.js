// @ts-check
// Read-only, incremental reader of the local OpenCode SQLite DB. Only json_extract of an allow-list of keys
// (provider, model, tokens, cost, time) is selected: message text, prompts, tool output, titles and paths are
// never read. Exactly ONE layout is counted: v2 (session_message) when present, otherwise v1 (message).
// Any failure degrades to an empty result plus a warning.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createOpenCodeAggregator } = require("./opencode-stat-model");

const MAX_ROWS_PER_TICK = 2000;

/** @param {string} key @returns {string} */
const j = (key) => `json_extract(data, '${key}')`;

/** Shared projection: only identifier/numeric keys, plus json_type() so error content is never read. */
function projection(/** @type {string} */ providerKey, /** @type {string} */ modelKey) {
  return [
    "rowid AS rid", "time_created AS at",
    `${j(providerKey)} AS provider`, `${j(modelKey)} AS model`,
    `${j("$.tokens.input")} AS tokensIn`, `${j("$.tokens.output")} AS tokensOut`,
    `${j("$.tokens.reasoning")} AS tokensReasoning`, `${j("$.tokens.cache.read")} AS cacheRead`,
    `${j("$.tokens.cache.write")} AS cacheWrite`, `${j("$.cost")} AS cost`,
    "json_type(data, '$.error') IS NOT NULL AS failed",
  ].join(", ");
}

const SQL = {
  v2: `SELECT ${projection("$.model.providerID", "$.model.id")} FROM session_message
    WHERE type = 'assistant' AND rowid > ? ORDER BY rowid ASC LIMIT ?`,
  v1: `SELECT ${projection("$.providerID", "$.modelID")} FROM message
    WHERE json_extract(data, '$.role') = 'assistant' AND rowid > ? ORDER BY rowid ASC LIMIT ?`,
};

/** @param {NodeJS.ProcessEnv} [env] @returns {string} */
function defaultDbPath(env = process.env) {
  if (env.HARNESS_OPENCODE_DB) return env.HARNESS_OPENCODE_DB;
  return path.join(os.homedir(), ".local", "share", "opencode", "opencode.db");
}

/** @param {any} db @param {string} name @returns {boolean} */
function hasTable(db, name) {
  return !!db.prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
}

/**
 * @param {{ dbPath?: string, maxRows?: number, env?: NodeJS.ProcessEnv, warn?: (msg: string) => void }} [opts]
 */
function createOpenCodeReader(opts = {}) {
  const dbPath = opts.dbPath || defaultDbPath(opts.env);
  const maxRows = opts.maxRows || MAX_ROWS_PER_TICK;
  const warn = opts.warn || ((m) => console.warn(`[usage-opencode] ${m}`));
  let lastRid = 0;
  /** @type {"v1" | "v2" | null} */
  let layout = null;
  const agg = createOpenCodeAggregator();
  /** @type {string[]} */
  let warnings = [];

  /** @param {string} msg */
  function fail(msg) {
    warnings.push(msg);
    warn(msg);
    return { rows: 0, done: true };
  }

  /** Reads one bounded batch past the checkpoint. @returns {{ rows: number, done: boolean }} */
  function tick() {
    warnings = [];
    if (!fs.existsSync(dbPath)) return fail(`database not found: ${path.basename(dbPath)}`);
    /** @type {any} */
    let db = null;
    try {
      const { DatabaseSync } = require("node:sqlite");
      db = new DatabaseSync(dbPath, { readOnly: true });
      if (!layout) {
        layout = hasTable(db, "session_message") ? "v2" : hasTable(db, "message") ? "v1" : null;
        if (!layout) return fail("no OpenCode message table found");
      }
      const rows = /** @type {any[]} */ (db.prepare(SQL[layout]).all(lastRid, maxRows));
      for (const r of rows) {
        agg.add(r);
        if (Number(r.rid) > lastRid) lastRid = Number(r.rid);
      }
      return { rows: rows.length, done: rows.length < maxRows };
    } catch (err) {
      return fail(`cannot read OpenCode DB: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      try { db && db.close(); } catch { /* ignore close failure */ }
    }
  }

  return {
    tick,
    /** Drains pending rows (bounded per tick) and returns the aggregate. */
    read() {
      for (let i = 0; i < 50; i++) if (tick().done) break;
      return { stats: agg.list(), ...agg.totals(), layout, lastRid, warnings: [...warnings] };
    },
    get checkpoint() { return lastRid; },
  };
}

module.exports = { createOpenCodeReader, defaultDbPath, MAX_ROWS_PER_TICK };
