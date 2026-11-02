// @ts-check
// QuotaSnapshot: one subscription/quota reading per provider+window, GLOBAL (quotas are per account, not per
// project). Pure module: allow-list validation only. Unknown values stay null; extra fields are dropped.
const PROVIDERS = Object.freeze(["claude", "codex", "gemini", "opencode", "9router"]);
const WINDOWS = Object.freeze(["5h", "weekly", "daily", "monthly"]);
const UNITS = Object.freeze(["percent", "requests", "tokens", "usd"]);
const CONFIDENCE = Object.freeze(["exact", "derived", "manual", "unknown"]);
const TEXT_MAX = 80;

/**
 * @typedef {Object} QuotaSnapshot
 * @property {string} provider
 * @property {string | null} plan
 * @property {string} window
 * @property {number | null} used
 * @property {number | null} limit
 * @property {string | null} unit
 * @property {string | null} resetsAt ISO
 * @property {string} observedAt ISO
 * @property {string} source
 * @property {string} confidence
 */

/** @param {unknown} v @returns {number | null} */
const num = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
/** @param {unknown} v @returns {string | null} */
const text = (v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, TEXT_MAX) : null);
/** @param {unknown} v @returns {string | null} ISO or null */
function iso(v) {
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) return null;
  return new Date(v).toISOString();
}
/** @param {readonly string[]} list @param {unknown} v @returns {string | null} */
const oneOf = (list, v) => (typeof v === "string" && list.includes(v) ? v : null);

/**
 * @param {unknown} raw
 * @returns {QuotaSnapshot | null} null when provider, window or observedAt is invalid; extra fields are dropped
 */
function validateSnapshot(raw) {
  if (!raw || typeof raw !== "object") return null;
  const r = /** @type {Record<string, unknown>} */ (raw);
  const provider = oneOf(PROVIDERS, r.provider);
  const window = oneOf(WINDOWS, r.window);
  const observedAt = iso(r.observedAt);
  if (!provider || !window || !observedAt) return null;
  return {
    provider, plan: text(r.plan), window, used: num(r.used), limit: num(r.limit), unit: oneOf(UNITS, r.unit),
    resetsAt: iso(r.resetsAt), observedAt, source: text(r.source) || "unknown",
    confidence: oneOf(CONFIDENCE, r.confidence) || "unknown",
  };
}

/** @param {Pick<QuotaSnapshot, "provider" | "window">} s @returns {string} */
const snapshotKey = (s) => `${s.provider}|${s.window}`;

module.exports = { PROVIDERS, WINDOWS, UNITS, CONFIDENCE, validateSnapshot, snapshotKey };
