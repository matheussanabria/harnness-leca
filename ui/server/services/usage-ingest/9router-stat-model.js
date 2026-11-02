// @ts-check
// ComboStat: pure aggregation of 9Router usageHistory rows per combo+provider+model. No I/O, no secrets.

/**
 * @typedef {{ combo: string, provider: string, model: string, calls: number, tokensIn: number,
 *   tokensOut: number, cacheRead: number, cacheWrite: number, failures: number, lastAt: string }} ComboStat
 * @typedef {{ id: number, timestamp: string, provider: string, model: string, promptTokens: number,
 *   completionTokens: number, status: string, tokens?: string }} UsageRow
 */

const OK_STATUS = new Set(["ok", "success", "200"]);

/** @param {any} v @returns {number} */
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Cache counters from the `tokens` JSON column (counts only). promptTokens already includes cached reads.
 * @param {any} raw @returns {{ read: number, write: number }} */
function cacheOf(raw) {
  if (typeof raw !== "string" || raw.length > 2000) return { read: 0, write: 0 };
  try {
    const t = JSON.parse(raw) || {};
    return { read: num(t.cached_tokens), write: num(t.cache_creation_input_tokens) };
  } catch {
    return { read: 0, write: 0 };
  }
}

/** @param {any} v @returns {string} */
function str(v) {
  return typeof v === "string" ? v.slice(0, 200) : "";
}

/** @param {string} combo @param {string} provider @param {string} model @returns {string} */
function keyOf(combo, provider, model) {
  return JSON.stringify([combo, provider, model]);
}

/** @param {any} row @returns {boolean} true when the status column reports a failed call */
function isFailure(row) {
  const s = str(row && row.status).toLowerCase();
  return s !== "" && !OK_STATUS.has(s);
}

/**
 * Creates an accumulator; rows can be added across ticks.
 * @param {Set<string>} [comboNames] known combo names; a model equal to one is reported under that combo
 */
function createAggregator(comboNames = new Set()) {
  /** @type {Map<string, ComboStat>} */
  const stats = new Map();
  return {
    /** @param {any} row */
    add(row) {
      if (!row || typeof row !== "object") return;
      const provider = str(row.provider);
      const model = str(row.model);
      const combo = comboNames.has(model) ? model : "";
      const key = keyOf(combo, provider, model);
      let s = stats.get(key);
      if (!s) {
        s = { combo, provider, model, calls: 0, tokensIn: 0, tokensOut: 0, cacheRead: 0, cacheWrite: 0, failures: 0, lastAt: "" };
        stats.set(key, s);
      }
      s.calls += 1;
      s.tokensIn += num(row.promptTokens);
      s.tokensOut += num(row.completionTokens);
      const cache = cacheOf(row.tokens);
      s.cacheRead += cache.read;
      s.cacheWrite += cache.write;
      if (isFailure(row)) s.failures += 1;
      const at = str(row.timestamp);
      if (at > s.lastAt) s.lastAt = at;
    },
    /** @returns {ComboStat[]} sorted by calls desc */
    list() {
      return [...stats.values()].sort((a, b) => b.calls - a.calls || a.model.localeCompare(b.model));
    },
  };
}

module.exports = { createAggregator, isFailure };
