// @ts-check
// Turns the rate_limits of a Codex token_count line into a QuotaSnapshot. PRIVACY: only numeric/enum scalars
// are copied (used_percent, window_minutes, resets_at, plan_type); no prompt, message or credit balance.
const { validateSnapshot } = require("./quota-model");

const WINDOW_BY_MINUTES = new Map([[10080, "weekly"], [300, "5h"]]);

/**
 * @param {string} line raw JSONL line
 * @returns {import("./quota-model").QuotaSnapshot | null} null when absent or the window is unknown
 */
function extractQuota(line) {
  if (!line.includes('"rate_limits"') || !line.includes('"token_count"')) return null;
  /** @type {any} */
  let obj;
  try { obj = JSON.parse(line); } catch { return null; }
  const p = obj && obj.payload;
  if (!p || obj.type !== "event_msg" || p.type !== "token_count") return null;
  const rl = p.rate_limits;
  const w = rl && typeof rl === "object" ? rl.primary : null;
  if (!w || typeof w !== "object" || typeof obj.timestamp !== "string") return null;
  const window = WINDOW_BY_MINUTES.get(w.window_minutes);
  if (!window) return null; // missing/unsupported window: unknown, no snapshot
  const resetsAt = typeof w.resets_at === "number" && Number.isFinite(w.resets_at) ? new Date(w.resets_at * 1000).toISOString() : null;
  return validateSnapshot({
    provider: "codex", plan: rl.plan_type, window, used: w.used_percent, limit: null, unit: "percent",
    resetsAt, observedAt: obj.timestamp, source: "codex-rollout", confidence: "exact",
  });
}

module.exports = { extractQuota };
