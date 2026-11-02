// @ts-check
// Manual plan configuration for providers that do not report quotas themselves. No network, no secrets.
//
// DEFAULTS below name the plan only. To record limits, create `<HARNESS_ROOT>/coordination/usage-plans.json`
// (optional) shaped like:
//   { "claude": { "plan": "Max", "limits": { "5h": 225, "weekly": 1000, "unit": "requests" } } }
// Each provider may override `plan` and give `limits` for "5h" and/or "weekly" (non-negative numbers) plus a
// `unit` (percent|requests|tokens|usd). Anything missing stays null (unknown).
const fs = require("fs");
const path = require("path");
const { UNITS, validateSnapshot } = require("./quota-model");

const DEFAULT_PLANS = Object.freeze({ claude: "Pro", codex: "Plus", gemini: "Pro" });
const MANUAL_WINDOWS = ["5h", "weekly"];

/** @returns {string} */
function configFile() {
  const { ROOT } = require("../../../../tools/lib/root");
  return path.join(ROOT, "coordination", "usage-plans.json");
}

/** @returns {Record<string, any>} defaults merged with the optional user file */
function loadPlanConfig(file = configFile()) {
  /** @type {Record<string, any>} */
  const out = {};
  for (const [k, plan] of Object.entries(DEFAULT_PLANS)) out[k] = { plan, limits: {} };
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const k of Object.keys(out)) {
      const u = raw && raw[k];
      if (!u || typeof u !== "object") continue;
      if (typeof u.plan === "string" && u.plan.trim()) out[k].plan = u.plan.trim().slice(0, 80);
      if (u.limits && typeof u.limits === "object") out[k].limits = u.limits;
    }
  } catch {
    /* no user file: defaults */
  }
  return out;
}

/**
 * @param {Record<string, any>} config
 * @param {string} nowIso
 * @returns {{ plans: { provider: string, plan: string }[], snapshots: import("./quota-model").QuotaSnapshot[] }}
 */
function manualSnapshots(config, nowIso) {
  const plans = [];
  const snapshots = [];
  for (const [provider, c] of Object.entries(config)) {
    plans.push({ provider, plan: c.plan });
    const unit = UNITS.includes(c.limits.unit) ? c.limits.unit : null;
    for (const window of MANUAL_WINDOWS) {
      const limit = c.limits[window];
      if (typeof limit !== "number" || !(limit >= 0)) continue;
      const s = validateSnapshot({ provider, plan: c.plan, window, used: null, limit, unit, resetsAt: null, observedAt: nowIso, source: "config", confidence: "manual" });
      if (s) snapshots.push(s);
    }
  }
  return { plans, snapshots };
}

module.exports = { DEFAULT_PLANS, loadPlanConfig, manualSnapshots };
