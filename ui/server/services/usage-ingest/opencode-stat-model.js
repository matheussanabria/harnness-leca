// @ts-check
// OpenCodeStat: pure aggregation of OpenCode assistant-call rows per provider+model. No I/O, no message text.
// Calls routed through 9Router (providerID "9router") are flagged viaRouter and kept out of the totals,
// because the 9Router feed already counts them.

/**
 * @typedef {{ calls: number, tokensIn: number, tokensOut: number, tokensReasoning: number,
 *   cacheRead: number, cacheWrite: number, cost: number, failures: number }} OpenCodeTotals
 * @typedef {OpenCodeTotals & { source: "opencode", provider: string, model: string, viaRouter: boolean,
 *   lastAt: string }} OpenCodeStat
 */

const ROUTER_PROVIDER = "9router";
const TOTAL_KEYS = /** @type {(keyof OpenCodeTotals)[]} */ (
  ["calls", "tokensIn", "tokensOut", "tokensReasoning", "cacheRead", "cacheWrite", "cost", "failures"]
);

/** @param {any} v @returns {number} non-negative integer */
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** @param {any} v @returns {number} non-negative finite decimal (cost) */
function dec(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** @param {any} v @returns {string} */
function str(v) {
  return typeof v === "string" ? v.slice(0, 200) : "";
}

/** @param {any} ms epoch milliseconds @returns {string} ISO timestamp or "" */
function isoOf(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "";
  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/** @returns {OpenCodeTotals} */
function emptyTotals() {
  return { calls: 0, tokensIn: 0, tokensOut: 0, tokensReasoning: 0, cacheRead: 0, cacheWrite: 0, cost: 0, failures: 0 };
}

/** Creates an accumulator; rows can be added across ticks. */
function createOpenCodeAggregator() {
  /** @type {Map<string, OpenCodeStat>} */
  const stats = new Map();
  return {
    /** @param {any} row allow-listed columns: provider, model, tokensIn/Out/Reasoning, cacheRead/Write, cost, failed, at */
    add(row) {
      if (!row || typeof row !== "object") return;
      const provider = str(row.provider);
      const model = str(row.model);
      const key = JSON.stringify([provider, model]);
      let s = stats.get(key);
      if (!s) {
        s = { ...emptyTotals(), source: "opencode", provider, model, viaRouter: provider === ROUTER_PROVIDER, lastAt: "" };
        stats.set(key, s);
      }
      s.calls += 1;
      s.tokensIn += num(row.tokensIn);
      s.tokensOut += num(row.tokensOut);
      s.tokensReasoning += num(row.tokensReasoning);
      s.cacheRead += num(row.cacheRead);
      s.cacheWrite += num(row.cacheWrite);
      s.cost += dec(row.cost);
      if (row.failed) s.failures += 1;
      const at = isoOf(row.at);
      if (at > s.lastAt) s.lastAt = at;
    },
    /** @returns {OpenCodeStat[]} sorted by calls desc */
    list() {
      return [...stats.values()].sort((a, b) => b.calls - a.calls || a.model.localeCompare(b.model));
    },
    /** @returns {{ total: OpenCodeTotals, viaRouter: OpenCodeTotals }} total excludes router-routed calls */
    totals() {
      const total = emptyTotals();
      const viaRouter = emptyTotals();
      for (const s of stats.values()) {
        const t = s.viaRouter ? viaRouter : total;
        for (const k of TOTAL_KEYS) t[k] += s[k];
      }
      return { total, viaRouter };
    },
  };
}

module.exports = { createOpenCodeAggregator, ROUTER_PROVIDER };
