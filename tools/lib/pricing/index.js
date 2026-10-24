"use strict";
// Cost estimator. Always API-equivalent and estimated, never billed. Absent is null, never 0.
const { loadTable, validateTable } = require("./loader");

const PROVIDER_ALIASES = {
  anthropic: "anthropic", claude: "anthropic",
  openai: "openai", codex: "openai",
  google: "google", gemini: "google",
};

function normalizeProvider(p) {
  return PROVIDER_ALIASES[String(p || "").toLowerCase()] || null;
}

// Strips context suffixes ([1m]), "-latest" and snapshot date suffixes.
function normalizeModelId(id) {
  if (typeof id !== "string") return [];
  const base = id.trim().toLowerCase().replace(/\[[^\]]*\]$/, "").replace(/-latest$/, "");
  const noDate = base.replace(/-\d{8}$/, "").replace(/-\d{4}-\d{2}-\d{2}$/, "");
  return noDate === base ? [base] : [base, noDate];
}

function findModel(provider, model, file) {
  const prov = normalizeProvider(provider);
  if (!prov) return null;
  const { index, table } = loadTable(file);
  for (const cand of normalizeModelId(model)) {
    const hit = index.get(`${prov}/${cand}`);
    if (hit) return { entry: hit, provider: prov, policy: table.providers[prov], version: table.version };
  }
  return null;
}

const num = (x) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : null);

function pickRate(entry, promptSize, atMs) {
  const live = entry.rates.filter((r) =>
    (r.from === undefined || Date.parse(r.from) <= atMs) && (r.until === undefined || atMs < Date.parse(r.until)));
  if (!live.length) return null;
  const tiers = [...live].sort((a, b) => (a.promptOver || 0) - (b.promptOver || 0));
  let chosen = tiers[0];
  for (const r of tiers) if (promptSize > (r.promptOver || 0)) chosen = r;
  return chosen;
}

function toMs(at) {
  if (at === undefined || at === null) return Date.now();
  const ms = at instanceof Date ? at.getTime() : typeof at === "number" ? at : Date.parse(at);
  return Number.isNaN(ms) ? Date.now() : ms;
}

function estimateCost({ provider, model, tokens, at } = {}, opts = {}) {
  const found = findModel(provider, model, opts.file);
  if (!found || !tokens) return null;
  const { entry, policy, version } = found;
  const t = {
    input: num(tokens.input), output: num(tokens.output), cacheRead: num(tokens.cacheRead),
    cacheCreation: num(tokens.cacheCreation), reasoning: num(tokens.reasoning),
  };
  if (Object.values(t).every((v) => v === null)) return null;
  const cr = t.cacheRead || 0;
  const promptSize = policy.inputIncludesCache ? (t.input || 0) : (t.input || 0) + cr + (t.cacheCreation || 0);
  if (entry.maxPromptTokens && promptSize > entry.maxPromptTokens) return null;
  const rate = pickRate(entry, promptSize, toMs(at));
  if (!rate) return null;

  let usd = 0;
  let priced = 0;
  const missing = [];
  const add = (kind, count, perMillion) => {
    if (count === null) return;
    if (typeof perMillion !== "number") { if (count > 0) missing.push(kind); return; }
    usd += (count * perMillion) / 1e6;
    priced += 1;
  };
  const fresh = t.input === null ? null : policy.inputIncludesCache ? Math.max(0, t.input - cr) : t.input;
  const outTokens = policy.reasoning === "added-to-output" && t.reasoning !== null ? (t.output || 0) + t.reasoning : t.output;
  add("input", fresh, rate.input);
  add("output", outTokens, rate.output);
  add("cacheRead", t.cacheRead, rate.cacheRead);
  add("cacheCreation", t.cacheCreation, rate.cacheWrite5m);
  if (!priced) return null;
  return {
    amount: Math.round(usd * 1e10) / 1e10, currency: "USD", kind: "estimated",
    basis: "api-equivalent", priceTableVersion: version, missing,
  };
}

module.exports = {
  estimateCost, normalizeModelId, normalizeProvider, findModel, validateTable,
  get PRICE_TABLE_VERSION() { return loadTable().table.version; },
};
