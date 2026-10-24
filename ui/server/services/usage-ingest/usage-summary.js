// @ts-check
// Read model for GET /api/project/:slug/usage/summary. Aggregates usage.observed events in SQLite
// (json_extract), counting each callId once (latest event wins). SUM over no numbers is NULL, so unknown
// stays null instead of becoming 0; every total carries a coverage object (ADR-TEL-006).
const { openStore } = require("../events/event-store");

const GROUPS = {
  day: "substr(at, 1, 10)",
  model: "json_extract(payload, '$.model')",
  session: "session_id",
};
const MAX_GROUPS = 500;
const T = (/** @type {string} */ f) => `json_extract(payload, '$.tokens.${f}')`;
const AGG = `COUNT(*) AS calls,
  SUM(CASE WHEN ${T("input")} IS NOT NULL OR ${T("output")} IS NOT NULL OR ${T("cacheRead")} IS NOT NULL OR ${T("cacheCreation")} IS NOT NULL THEN 1 ELSE 0 END) AS withUsage,
  SUM(CASE WHEN json_extract(payload, '$.cost.amount') IS NOT NULL THEN 1 ELSE 0 END) AS withCost,
  SUM(CASE WHEN json_extract(payload, '$.cost.amount') IS NULL THEN 1 ELSE 0 END) AS withoutPrice,
  SUM(CASE WHEN json_extract(payload, '$.sidechain') = 1 THEN 1 ELSE 0 END) AS sidechain,
  SUM(${T("input")}) AS input, SUM(${T("output")}) AS output, SUM(${T("cacheRead")}) AS cacheRead,
  SUM(${T("cacheCreation")}) AS cacheCreation, SUM(${T("reasoning")}) AS reasoning,
  SUM(json_extract(payload, '$.cost.amount')) AS cost`;

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

/**
 * @param {string} slug
 * @param {{ since?: string | null, groupBy?: "day" | "model" | "session" | null, linesUnparsable?: number | null }} [options]
 */
function summarizeUsage(slug, options = {}) {
  const db = openStore(slug);
  const params = /** @type {any[]} */ (["usage.observed"]);
  let sinceClause = "";
  if (options.since) {
    sinceClause = " AND at >= ?";
    params.push(options.since);
  }
  // One row per callId: the latest event of each call (replays and later observations supersede).
  const base = `FROM events WHERE seq IN (SELECT MAX(seq) FROM events WHERE type = ?${sinceClause}
    GROUP BY COALESCE(json_extract(payload, '$.callId'), id))`;
  const total = db.prepare(`SELECT ${AGG} ${base}`).get(...params);
  const t = shape(total);
  /** @type {any[] | null} */
  let groups = null;
  if (options.groupBy) {
    const expr = GROUPS[options.groupBy];
    groups = db.prepare(`SELECT ${expr} AS key, ${AGG} ${base} GROUP BY ${expr} ORDER BY key LIMIT ${MAX_GROUPS}`)
      .all(...params).map((r) => ({ key: r.key === undefined ? null : r.key, ...shape(r) }));
  }
  return {
    project: slug,
    since: options.since || null,
    groupBy: options.groupBy || null,
    totals: { calls: t.calls, tokens: t.tokens, cost: t.cost },
    groups,
    coverage: {
      calls: t.calls, callsWithUsage: t.coverage.callsWithUsage, callsWithCost: t.coverage.callsWithCost,
      callsWithoutModelPrice: t.coverage.callsWithoutModelPrice, sidechainCalls: t.coverage.sidechainCalls,
      // Process-lifetime counter of the ingest (not per project); null when the ingest is disabled.
      linesUnparsable: options.linesUnparsable ?? null,
    },
  };
}

module.exports = { summarizeUsage, GROUPS };
