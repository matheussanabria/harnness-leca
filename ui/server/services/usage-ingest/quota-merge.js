// @ts-check
// Merges stored (observed) and manual snapshots for GET /api/usage/quotas and flags stale data.
// Stale: observedAt older than 1h or resetsAt in the past. An expired window is reported as unknown
// (used null, confidence unknown), never as a stale percentage.
const { snapshotKey } = require("./quota-model");
const { manualSnapshots } = require("./quota-plans-config");

const STALE_MS = 60 * 60 * 1000;

/** @param {import("./quota-model").QuotaSnapshot} s @param {number} nowMs */
function withStale(s, nowMs) {
  const expired = s.resetsAt !== null && Date.parse(s.resetsAt) <= nowMs;
  const old = nowMs - Date.parse(s.observedAt) > STALE_MS;
  const base = expired ? { ...s, used: null, confidence: "unknown" } : s;
  return { ...base, stale: expired || old };
}

/**
 * @param {{ stored: import("./quota-model").QuotaSnapshot[], config: Record<string, any>, nowMs: number }} input
 */
function buildQuotas({ stored, config, nowMs }) {
  const { plans, snapshots: manual } = manualSnapshots(config, new Date(nowMs).toISOString());
  const byKey = new Map(manual.map((s) => [snapshotKey(s), s]));
  for (const s of stored) byKey.set(snapshotKey(s), s); // observed data wins over manual limits
  return { generatedAt: new Date(nowMs).toISOString(), quotas: [...byKey.values()].map((s) => withStale(s, nowMs)), plans };
}

module.exports = { buildQuotas, withStale, STALE_MS };
