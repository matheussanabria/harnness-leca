// @ts-check
// Read-only, incremental reader of the local 9Router SQLite DB. Explicit column allow-lists only: apiKey,
// providerConnections.data and apiKeys.key are never selected; `tokens` holds counters only. Any failure degrades to an empty result.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createAggregator } = require("./9router-stat-model");

const MAX_ROWS_PER_TICK = 2000;
const USAGE_COLUMNS = "id, timestamp, provider, model, promptTokens, completionTokens, status, tokens";

/** @param {NodeJS.ProcessEnv} [env] @returns {string} */
function defaultDbPath(env = process.env) {
  if (env.HARNESS_9ROUTER_DB) return env.HARNESS_9ROUTER_DB;
  const base = env.APPDATA || path.join(os.homedir(), ".config");
  return path.join(base, "9router", "db", "data.sqlite");
}

/**
 * @param {{ dbPath?: string, maxRows?: number, env?: NodeJS.ProcessEnv, warn?: (msg: string) => void }} [opts]
 */
function createNineRouterReader(opts = {}) {
  const dbPath = opts.dbPath || defaultDbPath(opts.env);
  const maxRows = opts.maxRows || MAX_ROWS_PER_TICK;
  const warn = opts.warn || ((m) => console.warn(`[usage-9router] ${m}`));
  let lastId = 0;
  /** @type {ReturnType<typeof createAggregator> | null} */
  let agg = null;
  /** @type {string[]} */
  let warnings = [];

  /** Reads one bounded batch past the checkpoint. @returns {{ rows: number, done: boolean }} */
  function tick() {
    warnings = [];
    if (!fs.existsSync(dbPath)) return fail(`database not found: ${path.basename(dbPath)}`);
    /** @type {any} */
    let db = null;
    try {
      const { DatabaseSync } = require("node:sqlite");
      db = new DatabaseSync(dbPath, { readOnly: true });
      if (!agg) agg = createAggregator(readComboNames(db));
      const rows = /** @type {any[]} */ (
        db.prepare(`SELECT ${USAGE_COLUMNS} FROM usageHistory WHERE id > ? ORDER BY id ASC LIMIT ?`).all(lastId, maxRows)
      );
      for (const r of rows) {
        agg.add(r);
        if (Number(r.id) > lastId) lastId = Number(r.id);
      }
      return { rows: rows.length, done: rows.length < maxRows };
    } catch (err) {
      return fail(`cannot read usageHistory: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      try { db && db.close(); } catch { /* ignore close failure */ }
    }
  }

  /** @param {string} msg */
  function fail(msg) {
    warnings.push(msg);
    warn(msg);
    return { rows: 0, done: true };
  }

  return {
    tick,
    /** Drains pending rows (bounded per tick) and returns the aggregate. */
    read() {
      for (let i = 0; i < 50; i++) if (tick().done) break;
      return { combos: agg ? agg.list() : [], lastId, warnings: [...warnings] };
    },
    get checkpoint() { return lastId; },
  };
}

/** @param {any} db @returns {Set<string>} */
function readComboNames(db) {
  try {
    return new Set(db.prepare("SELECT name FROM combos").all().map((/** @type {any} */ r) => String(r.name)));
  } catch {
    return new Set();
  }
}

module.exports = { createNineRouterReader, defaultDbPath, MAX_ROWS_PER_TICK };
