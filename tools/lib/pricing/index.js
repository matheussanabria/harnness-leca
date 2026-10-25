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

// Optional TTL split of cache writes. Used only when both parts are numbers and add up to the total (or the
// total is absent); otherwise the total is billed at the 5-minute rate as before.
function billCacheWrites(t, raw, rate, add, missing) {
  const s5 = num(raw.cacheCreation5m);
  const s1 = num(raw.cacheCreation1h);
  const hasSplit = s5 !== null && s1 !== null;
  const consistent = hasSplit && (t.cacheCreation === null || s5 + s1 === t.cacheCreation);
  if (!consistent) {
    if (hasSplit) missing.push("cacheCreationSplit");
    add("cacheCreation", t.cacheCreation, rate.cacheWrite5m);
    return;
  }
  add("cacheCreation", s5, rate.cacheWrite5m);
  if (typeof rate.cacheWrite1h === "number") add("cacheCreation1h", s1, rate.cacheWrite1h);
  else {
    add("cacheCreation", s1, rate.cacheWrite5m);
    if (s1 > 0) missing.push("cacheWrite1h");
  }
}

function estimateCost({ provider, model, tokens, at } = {}, opts = {}) {
  const found = findModel(provider, model, opts.file);
  if (!found || !tokens) return null;
  const { entry, policy, version } = found;
  const t = {
    input: num(tokens.input), output: num(tokens.output), cacheRead: num(tokens.cacheRead),
    cacheCreation: num(tokens.cacheCreation), reasoning: num(tokens.reasoning),
  };
  if (t.cacheCreation === null && num(tokens.cacheCreation5m) !== null && num(tokens.cacheCreation1h) !== null) {
    t.cacheCreation = num(tokens.cacheCreation5m) + num(tokens.cacheCreation1h);
  }
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
  billCacheWrites(t, tokens, rate, add, missing);
  if (!priced) return null;
  return {
    amount: Math.round(usd * 1e10) / 1e10, currency: "USD", kind: "estimated",
    basis: "api-equivalent", priceTableVersion: version, missing,
  };
}

// Metadata of the loaded table; retrievedAt is the newest model retrievedAt (YYYY-MM-DD).
function getPriceTableInfo(opts = {}) {
  const { table } = loadTable(opts.file);
  const dates = table.models.map((m) => m.retrievedAt).sort();
  return {
    version: table.version, reviewStatus: table.reviewStatus || null, basis: "api-equivalent",
    retrievedAt: dates.length ? dates[dates.length - 1] : null,
  };
}

module.exports = {
  estimateCost, getPriceTableInfo, normalizeModelId, normalizeProvider, findModel, validateTable,
  get PRICE_TABLE_VERSION() { return loadTable().table.version; },
};
