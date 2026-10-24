// @ts-check
// Aba Consumo: view-model puro. Entrada = respostas de /usage/summary; saída = dados prontos para exibir.
// Campos aditivos do backend (byOrigin, pricing, coverage.unpricedModels, engine/models/lastAt) são opcionais.

import { formatCompact, formatCost, formatDateTime, formatExact, isNum, NA, sharePercent, sumKnown } from "./usage-format.js";

export const WINDOWS = [
  { id: "24h", label: "24 h" },
  { id: "7d", label: "7 d" },
  { id: "14d", label: "14 d" },
  { id: "all", label: "Tudo" },
];
export const DEFAULT_WINDOW = "7d";
const MAX_DAYS = 31;
const TOP_SESSIONS = 10;
const DAY_MS = 86400000;

/** Total de tokens sem reasoning (já contido na saída em alguns motores; evita dupla contagem). */
export function totalTokens(tokens) {
  return tokens ? sumKnown([tokens.input, tokens.output, tokens.cacheRead, tokens.cacheCreation]) : null;
}

/** @param {any} t */
function card(id, label, value, extra = {}) {
  return { id, label, text: formatCompact(value), title: formatExact(value), ...extra };
}

/** @param {any} bucket @returns {{ calls: number | null, tokens: number | null, cost: number | null } | null} */
function originMetrics(bucket) {
  if (!bucket) return null;
  return {
    calls: isNum(bucket.calls) ? bucket.calls : null,
    tokens: totalTokens(bucket.tokens),
    cost: bucket.cost && isNum(bucket.cost.amount) ? bucket.cost.amount : null,
  };
}

/** @param {any} byOrigin */
export function buildOriginSplit(byOrigin) {
  const main = originMetrics(byOrigin && byOrigin.main);
  const sub = originMetrics(byOrigin && byOrigin.subagent);
  if (!main || !sub) return null;
  const row = (/** @type {string} */ id, /** @type {string} */ label, /** @type {any} */ m, /** @type {any} */ other) => {
    const pair = (/** @type {"calls"|"tokens"|"cost"} */ k) =>
      sharePercent(m[k], isNum(m[k]) && isNum(other[k]) ? m[k] + other[k] : null);
    const share = { calls: pair("calls"), tokens: pair("tokens"), cost: pair("cost") };
    return { id, label, ...m, share };
  };
  return [row("main", "Principal", main, sub), row("subagent", "Subagentes", sub, main)];
}

/** @param {any} g */
function groupRow(g) {
  const models = Array.isArray(g.models) ? g.models : g.model ? [g.model] : [];
  return {
    key: g.key === null || g.key === undefined ? NA : String(g.key),
    engine: g.engine || NA,
    models,
    modelsText: models.length ? models.join(", ") : NA,
    calls: isNum(g.calls) ? g.calls : null,
    tokensOut: g.tokens ? g.tokens.output ?? null : null,
    costValue: g.cost && isNum(g.cost.amount) ? g.cost.amount : null,
    costText: formatCost(g.cost),
    costExact: g.cost && isNum(g.cost.amount) ? formatExact(g.cost.amount) : NA,
    lastAt: g.lastAt || null,
    lastAtText: formatDateTime(g.lastAt),
    coverage: g.coverage ? `${g.coverage.callsWithCost ?? NA} de ${g.calls ?? NA}` : NA,
  };
}

/**
 * Barras por dia: preenche dias sem chamadas observadas (calls = 0 real) e limita a janela exibida.
 * @param {any[] | null | undefined} groups
 */
export function bucketDays(groups) {
  const rows = (groups || []).filter((g) => /^\d{4}-\d{2}-\d{2}$/.test(String(g.key))).map(groupRow);
  if (!rows.length) return [];
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const sorted = [...byKey.keys()].sort();
  const end = Date.parse(`${sorted[sorted.length - 1]}T00:00:00Z`);
  const start = Math.max(Date.parse(`${sorted[0]}T00:00:00Z`), end - (MAX_DAYS - 1) * DAY_MS);
  const days = [];
  for (let t = start; t <= end; t += DAY_MS) {
    const key = new Date(t).toISOString().slice(0, 10);
    const r = byKey.get(key);
    days.push({
      key,
      label: `${key.slice(8, 10)}/${key.slice(5, 7)}`,
      calls: r ? r.calls ?? 0 : 0,
      tokensOut: r ? r.tokensOut : null,
      costText: r ? r.costText : NA,
    });
  }
  const max = Math.max(1, ...days.map((d) => d.calls));
  return days.map((d) => ({
    ...d,
    heightPct: d.calls > 0 ? Math.max(4, Math.round((d.calls / max) * 100)) : 0,
    text: `${d.label}: ${d.calls} chamadas, saída ${formatCompact(d.tokensOut)}, custo ${d.costText}`,
  }));
}

/** @param {any} cov @param {number | null} fallbackCalls */
export function buildCoverage(cov, fallbackCalls) {
  const calls = cov && isNum(cov.calls) ? cov.calls : fallbackCalls;
  const withCost = cov && isNum(cov.callsWithCost) ? cov.callsWithCost : null;
  return {
    text: `${withCost ?? NA} de ${calls ?? NA} chamadas com custo`,
    unpriced: Array.isArray(cov && cov.unpricedModels) ? cov.unpricedModels.filter((m) => m && m.model) : [],
    linesUnparsable: cov && isNum(cov.linesUnparsable) ? cov.linesUnparsable : null,
  };
}

/**
 * @param {{ window?: string, day?: any, model?: any, session?: any }} input
 */
export function buildUsageViewModel(input) {
  const day = input.day || {};
  const totals = day.totals || {};
  const tokens = totals.tokens || {};
  const calls = isNum(totals.calls) ? totals.calls : 0;
  const ingestEnabled = !(day.ingest && day.ingest.enabled === false);
  const status = calls === 0 ? (ingestEnabled ? "empty" : "disabled") : "ready";
  const pricing = day.pricing || null;
  const sessions = (input.session && input.session.groups ? input.session.groups : []).map(groupRow)
    .sort((a, b) => (b.costValue ?? -1) - (a.costValue ?? -1) || (b.calls ?? 0) - (a.calls ?? 0))
    .slice(0, TOP_SESSIONS)
    .map((s) => ({ ...s, shortId: s.key === NA ? NA : s.key.slice(0, 8) }));
  return {
    status,
    window: input.window || DEFAULT_WINDOW,
    ingestEnabled,
    cards: [
      card("calls", "Chamadas", totals.calls),
      card("output", "Tokens de saída", tokens.output),
      card("cacheRead", "Cache lido", tokens.cacheRead),
      card("cacheCreation", "Cache escrito", tokens.cacheCreation),
      card("input", "Entrada nova", tokens.input),
      { id: "cost", label: "Custo estimado", text: formatCost(totals.cost), title: totals.cost ? formatExact(totals.cost.amount) : NA },
    ],
    reasoningText: formatCompact(tokens.reasoning),
    origin: buildOriginSplit(totals.byOrigin),
    days: bucketDays(day.groups),
    models: (input.model && input.model.groups ? input.model.groups : []).map(groupRow),
    sessions,
    coverage: buildCoverage(day.coverage, calls),
    notices: {
      estimated: true,
      pendingReview: !!(pricing && pricing.reviewStatus === "pending-user-review"),
    },
  };
}
