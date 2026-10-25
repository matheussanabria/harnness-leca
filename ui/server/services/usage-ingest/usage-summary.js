// @ts-check
// Read model for GET /api/project/:slug/usage/summary. Aggregates usage.observed events in SQLite,
// counting each callId once (latest event wins). SUM over no numbers is NULL, so unknown stays null
// instead of becoming 0; every total carries a coverage object (ADR-TEL-006).
// The JSON payload is parsed once per request into a flat TEMP table (per connection, never written to
// the database file); every aggregation then runs over plain columns.
const { openStore } = require("../events/event-store");
const { getPriceTableInfo } = require("./usage-pricing-info");

const ORIGIN = "CASE WHEN sidechain = 1 THEN 'subagent' ELSE 'main' END";
const GROUPS = { day: "substr(at, 1, 10)", model: "model", session: "session_id", origin: ORIGIN, engine: "engine" };
const MAX_GROUPS = 500;
const MAX_UNPRICED = 10;
const MAX_SESSION_MODELS = 3;
const AGG = `COUNT(*) AS calls, MAX(at) AS lastAt,
  SUM(CASE WHEN t_input IS NOT NULL OR t_output IS NOT NULL OR t_cacheRead IS NOT NULL OR t_cacheCreation IS NOT NULL THEN 1 ELSE 0 END) AS withUsage,
  SUM(CASE WHEN cost IS NOT NULL THEN 1 ELSE 0 END) AS withCost,
  SUM(CASE WHEN cost IS NULL THEN 1 ELSE 0 END) AS withoutPrice,
  SUM(CASE WHEN sidechain = 1 THEN 1 ELSE 0 END) AS sidechain,
  SUM(t_input) AS input, SUM(t_output) AS output, SUM(t_cacheRead) AS cacheRead,
  SUM(t_cacheCreation) AS cacheCreation, SUM(t_reasoning) AS reasoning, SUM(cost) AS cost`;
const J = (/** @type {string} */ p) => `json_extract(payload, '$.${p}')`;

/** @param {any} v @returns {number | null} */
const numOrNull = (v) => (v === null || v === undefined ? null : Number(v));

/** @param {any} row */
function shape(row) {
  return {
    calls: Number(row.calls || 0),
    tokens: {
      input: numOrNull(row.input), output: numOrNull(row.output), cacheRead: numOrNull(row.cacheRead),
      cacheCreation: numOrNull(row.cacheCreation), reasoning: numOrNull(row.reasoning),
    },
    cost: { amount: numOrNull(row.cost), currency: "USD", kind: "estimated", basis: "api-equivalent" },
    coverage: {
      callsWithUsage: Number(row.withUsage || 0), callsWithCost: Number(row.withCost || 0),
      callsWithoutModelPrice: Number(row.withoutPrice || 0), sidechainCalls: Number(row.sidechain || 0),
    },
  };
}

/** Flat snapshot of the latest event per callId inside the time range. */
function loadFlat(/** @type {any} */ db, /** @type {{ since?: string | null, until?: string | null }} */ o) {
  const params = /** @type {any[]} */ (["usage.observed"]);
  let range = "";
  if (o.since) { range += " AND at >= ?"; params.push(o.since); }
  if (o.until) { range += " AND at < ?"; params.push(o.until); }
  db.exec("DROP TABLE IF EXISTS temp.usage_flat");
  db.prepare(`CREATE TEMP TABLE usage_flat AS SELECT at, session_id, ${J("model")} AS model, ${J("engine")} AS engine,
      ${J("sidechain")} AS sidechain, ${J("tokens.input")} AS t_input, ${J("tokens.output")} AS t_output,
      ${J("tokens.cacheRead")} AS t_cacheRead, ${J("tokens.cacheCreation")} AS t_cacheCreation,
      ${J("tokens.reasoning")} AS t_reasoning, ${J("cost.amount")} AS cost
    FROM events WHERE seq IN (SELECT MAX(seq) FROM events WHERE type = ?${range}
      GROUP BY COALESCE(${J("callId")}, id))`).run(...params);
}

/** Distinct models (most used first, max 3) and engine per session. @param {any} db */
function sessionExtras(db) {
  const rows = db.prepare(`SELECT session_id AS key, model, MIN(engine) AS engine, COUNT(*) AS n FROM usage_flat
    WHERE model IS NOT NULL GROUP BY session_id, model ORDER BY n DESC, model`).all();
  const map = new Map();
  for (const r of rows) {
    const e = map.get(r.key) || { engine: null, models: [] };
    if (e.engine === null) e.engine = r.engine ?? null;
    if (e.models.length < MAX_SESSION_MODELS) e.models.push(r.model);
    map.set(r.key, e);
  }
  return map;
}

const slim = (/** @type {any} */ s) => ({ calls: s.calls, tokens: s.tokens, cost: s.cost });

/** @param {any} db @param {string | null | undefined} groupBy */
function buildGroups(db, groupBy) {
  if (!groupBy) return null;
  const expr = GROUPS[/** @type {keyof typeof GROUPS} */ (groupBy)];
  const extras = groupBy === "session" ? sessionExtras(db) : null;
  return db.prepare(`SELECT ${expr} AS key, ${AGG} FROM usage_flat GROUP BY ${expr} ORDER BY key LIMIT ${MAX_GROUPS}`)
    .all().map((/** @type {any} */ r) => {
      const g = { key: r.key === undefined ? null : r.key, ...shape(r), lastAt: r.lastAt ?? null };
      if (!extras) return g;
      const x = extras.get(r.key);
      const sub = g.coverage.sidechainCalls;
      return { ...g, engine: x ? x.engine : null, model: x ? x.models : [], origin: { main: g.calls - sub, subagent: sub } };
    });
}

/**
 * @param {string} slug
 * @param {{ since?: string | null, until?: string | null, window?: string | null,
 *   groupBy?: "day" | "model" | "session" | "origin" | "engine" | null, linesUnparsable?: number | null }} [options]
 */
function summarizeUsage(slug, options = {}) {
  const db = openStore(slug);
  loadFlat(db, options);
  try {
    const t = shape(db.prepare(`SELECT ${AGG} FROM usage_flat`).get());
    const byOrigin = { main: shape({}), subagent: shape({}) };
    for (const r of db.prepare(`SELECT ${ORIGIN} AS origin, ${AGG} FROM usage_flat GROUP BY origin`).all()) {
      byOrigin[/** @type {"main" | "subagent"} */ (r.origin)] = shape(r);
    }
    const unpriced = db.prepare(`SELECT model, COUNT(*) AS calls FROM usage_flat WHERE cost IS NULL AND model IS NOT NULL
      GROUP BY model ORDER BY calls DESC, model LIMIT ${MAX_UNPRICED}`).all()
      .map((r) => ({ model: r.model, calls: Number(r.calls) }));
    return {
      project: slug,
      since: options.since || null,
      until: options.until || null,
      window: options.window || null,
      groupBy: options.groupBy || null,
      totals: { calls: t.calls, tokens: t.tokens, cost: t.cost, byOrigin: { main: slim(byOrigin.main), subagent: slim(byOrigin.subagent) } },
      groups: buildGroups(db, options.groupBy),
      coverage: {
        calls: t.calls, callsWithUsage: t.coverage.callsWithUsage, callsWithCost: t.coverage.callsWithCost,
        callsWithoutModelPrice: t.coverage.callsWithoutModelPrice, sidechainCalls: t.coverage.sidechainCalls,
        unpricedModels: unpriced,
        // Process-lifetime counter of the ingest (not per project); null when the ingest is disabled.
        linesUnparsable: options.linesUnparsable ?? null,
      },
      pricing: getPriceTableInfo(),
    };
  } finally {
    db.exec("DROP TABLE IF EXISTS temp.usage_flat");
  }
}

module.exports = { summarizeUsage, GROUPS };
