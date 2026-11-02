// @ts-check
// Consumo page: pure view model. Missing values stay null and render as n/d, never as 0.
import { bucketDays } from "../modules/usage-view-model.js";
import { formatCompact, formatDateTime, formatExact, isNum, NA } from "../modules/usage-format.js";

const WINDOW_LABELS = { "5h": "5 horas", weekly: "Semanal" };

/** @param {any} s @returns {number | null} percent 0-100 when both used and limit are known */
export function quotaPercent(s) {
  if (!s || !isNum(s.used) || !isNum(s.limit) || s.limit <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((s.used / s.limit) * 100)));
}

/** @param {number | null} pct @returns {"ok" | "warn" | "high" | "unknown"} */
export function gaugeLevel(pct) {
  if (pct === null) return "unknown";
  return pct >= 90 ? "high" : pct >= 70 ? "warn" : "ok";
}

/** @param {any} s */
function windowRow(s) {
  const pct = quotaPercent(s);
  return {
    window: s.window,
    label: /** @type {Record<string, string>} */ (WINDOW_LABELS)[s.window] || String(s.window),
    pct,
    level: gaugeLevel(pct),
    usedText: formatCompact(s.used),
    limitText: formatCompact(s.limit),
    unit: s.unit || "",
    resetsText: s.resetsAt ? formatDateTime(s.resetsAt) : NA,
    observedText: formatDateTime(s.observedAt),
    stale: Boolean(s.stale),
    estimated: s.confidence === "manual" || s.confidence === "estimated",
    confidence: s.confidence || "unknown",
  };
}

/** One card per provider: plan name plus its windows, ordered 5h then weekly. @param {any} resp */
export function buildQuotaCards(resp) {
  const quotas = Array.isArray(resp && resp.quotas) ? resp.quotas : [];
  const plans = Array.isArray(resp && resp.plans) ? resp.plans : [];
  const providers = new Map(plans.map((/** @type {any} */ p) => [p.provider, { provider: p.provider, plan: p.plan || NA, windows: [] }]));
  for (const q of quotas) {
    if (!providers.has(q.provider)) providers.set(q.provider, { provider: q.provider, plan: q.plan || NA, windows: [] });
    const card = /** @type {any} */ (providers.get(q.provider));
    if (q.plan) card.plan = q.plan;
    card.windows.push(windowRow(q));
  }
  const order = (/** @type {string} */ w) => (w === "5h" ? 0 : w === "weekly" ? 1 : 2);
  for (const c of providers.values()) c.windows.sort((a, b) => order(a.window) - order(b.window));
  return [...providers.values()];
}

/** @param {any} n */
const cell = (n) => ({ text: formatCompact(n), title: formatExact(n), value: isNum(n) ? n : 0 });

/** Combo/provider/model rows sorted by total tokens, largest first. @param {any[]} combos */
export function buildComboRows(combos) {
  return (Array.isArray(combos) ? combos : [])
    .map((c) => ({
      combo: c.combo || NA,
      provider: c.provider || NA,
      model: c.model || NA,
      calls: cell(c.calls),
      tokensIn: cell(c.tokensIn),
      tokensOut: cell(c.tokensOut),
      failures: cell(c.failures),
      total: (Number(c.tokensIn) || 0) + (Number(c.tokensOut) || 0),
      lastAtText: formatDateTime(c.lastAt),
    }))
    .sort((a, b) => b.total - a.total);
}

/** OpenCode rows; calls routed through 9Router are flagged because they are already counted there. @param {any[]} stats */
export function buildOpenCodeRows(stats) {
  return (Array.isArray(stats) ? stats : [])
    .map((s) => ({
      provider: s.provider || NA,
      model: s.model || NA,
      viaRouter: Boolean(s.viaRouter),
      calls: cell(s.calls),
      tokensIn: cell(s.tokensIn),
      tokensOut: cell(s.tokensOut),
      total: (Number(s.tokensIn) || 0) + (Number(s.tokensOut) || 0),
      lastAtText: formatDateTime(s.lastAt),
    }))
    .sort((a, b) => Number(a.viaRouter) - Number(b.viaRouter) || b.total - a.total);
}

/** Gemini/Antigravity activity per day (counts only; transcripts carry no token data). @param {any[]} days */
export function buildGeminiRows(days) {
  return (Array.isArray(days) ? days : []).map((d) => ({
    day: d.day, sessions: cell(d.sessions), prompts: cell(d.prompts), responses: cell(d.responses), errors: cell(d.errors),
  }));
}

/** "As of" labels per source, with a warning when a source reported problems. @param {any} loaded */
export function buildAsOf(loaded) {
  const entry = (/** @type {string} */ id, /** @type {string} */ label, /** @type {any} */ src) => ({
    id, label,
    ok: Boolean(src && src.ok),
    error: src && !src.ok ? src.error : "",
    atText: src && src.ok ? formatDateTime(src.data.generatedAt) : NA,
    warnings: src && src.ok && Array.isArray(src.data.warnings) ? src.data.warnings.slice(0, 5).map(String) : [],
  });
  return [
    entry("quotas", "Cotas", loaded.quotas),
    entry("combos", "9Router", loaded.combos),
    entry("opencode", "OpenCode", loaded.opencode),
    entry("gemini", "Gemini", loaded.gemini),
  ];
}

/** Daily calls bars for the selected project. @param {any} trendSource */
export function buildTrend(trendSource) {
  if (!trendSource || !trendSource.ok) return { days: [], error: trendSource ? trendSource.error : "" };
  return { days: bucketDays(trendSource.data.groups), error: "" };
}
