// @ts-check
// Consumo page: HTML sections. Icons are FontAwesome only; every dynamic value goes through esc().
import { esc, NA } from "../modules/usage-format.js";
import { pagedHtml } from "../shared/pagination.js";

export const COMBOS_KEY = "consumo-combos";
export const OPENCODE_KEY = "consumo-opencode";
export const GEMINI_KEY = "consumo-gemini";

const PROVIDER_ICONS = { claude: "fa-asterisk", codex: "fa-terminal", gemini: "fa-gem" };

/** @param {any} w */
function gauge(w) {
  const bar = w.pct === null
    ? `<div class="cg-bar cg-bar--unknown" role="img" aria-label="${esc(w.label)}: sem dados"></div>`
    : `<div class="cg-bar cg-bar--${w.level}" role="img" aria-label="${esc(w.label)}: ${w.pct}%"><span style="width:${w.pct}%"></span></div>`;
  const value = w.pct === null ? `${w.limitText !== NA ? `limite ${esc(w.limitText)} ${esc(w.unit)}` : NA}` : `${w.pct}% (${esc(w.usedText)} de ${esc(w.limitText)} ${esc(w.unit)})`;
  const badges = [
    w.estimated ? `<span class="cg-badge cg-badge--est"><i class="fa-solid fa-hand" aria-hidden="true"></i> estimado</span>` : "",
    w.stale ? `<span class="cg-badge cg-badge--stale"><i class="fa-solid fa-clock" aria-hidden="true"></i> desatualizado</span>` : "",
  ].join("");
  return `<div class="cg-row"><div class="cg-head"><span>${esc(w.label)}</span>${badges}</div>${bar}
    <div class="cg-meta">${value} · renova ${esc(w.resetsText)} · lido em ${esc(w.observedText)}</div></div>`;
}

/** @param {any[]} cards */
export function renderQuotas(cards) {
  if (!cards.length) return `<p class="c-empty">Nenhum plano configurado.</p>`;
  const items = cards.map((c) => {
    const icon = /** @type {Record<string, string>} */ (PROVIDER_ICONS)[c.provider] || "fa-cube";
    const body = c.windows.length ? c.windows.map(gauge).join("") : `<p class="c-empty">Cota n/d: sem leitura nem limite manual.</p>`;
    return `<article class="c-card"><h3><i class="fa-solid ${icon}" aria-hidden="true"></i> ${esc(c.provider)} <small>${esc(c.plan)}</small></h3>${body}</article>`;
  });
  return `<div class="c-grid">${items.join("")}</div>`;
}

/** @param {string[]} headers @param {string} body @param {string} caption */
function table(headers, body, caption) {
  return `<div class="c-table-wrap"><table class="c-table"><caption class="sr-only">${esc(caption)}</caption>
    <thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/** @param {any} c */
const num = (c) => `<td class="n" title="${esc(c.title)}">${esc(c.text)}</td>`;

/** @param {any[]} rows */
export function renderCombos(rows, fallbacks = { script: 0, local: 0 }) {
  if (!rows.length) return `<p class="c-empty">Sem chamadas no 9Router.</p>`;
  const note = `<p class="c-empty"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> O 9Router não registra falhas; a coluna Harness conta turnos roteados por este app (ok / falha). Fallbacks para a nuvem: script ${fallbacks.script}, modelo local ${fallbacks.local}.</p>`;
  const page = pagedHtml(rows, COMBOS_KEY, (r) =>
    `<tr><td>${esc(r.combo)}</td><td>${esc(r.provider)}</td><td>${esc(r.model)}</td>${num(r.calls)}${num(r.tokensIn)}${num(r.tokensOut)}<td class="n${r.outcome.failed ? " is-fail" : ""}" title="${esc(r.outcome.title)}">${esc(r.outcome.text)}</td><td>${esc(r.lastAtText)}</td></tr>`);
  return note + table(["Combo", "Provedor", "Modelo", "Chamadas", "Entrada", "Saída", "Harness ok / falha", "Última"], page.html, "Consumo por combo do 9Router") + page.pager;
}

/** @param {any[]} rows */
export function renderOpenCode(rows) {
  if (!rows.length) return `<p class="c-empty">Sem chamadas no OpenCode.</p>`;
  const page = pagedHtml(rows, OPENCODE_KEY, (r) =>
    `<tr${r.viaRouter ? ' class="is-via"' : ""}><td>${esc(r.provider)}${r.viaRouter ? ' <span class="cg-badge">via 9Router</span>' : ""}</td><td>${esc(r.model)}</td>${num(r.calls)}${num(r.tokensIn)}${num(r.tokensOut)}<td>${esc(r.lastAtText)}</td></tr>`);
  return table(["Provedor", "Modelo", "Chamadas", "Entrada", "Saída", "Última"], page.html, "Consumo do OpenCode") + page.pager;
}

/** @param {any[]} rows @param {boolean} partial */
export function renderGemini(rows, partial) {
  if (!rows.length) return `<p class="c-empty">Sem atividade do Antigravity.</p>`;
  const page = pagedHtml(rows, GEMINI_KEY, (r) =>
    `<tr><td>${esc(r.day)}</td>${num(r.sessions)}${num(r.prompts)}${num(r.responses)}${num(r.errors)}</tr>`);
  const note = `<p class="c-empty"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Somente contagem de atividade; tokens do Gemini aparecem no 9Router.${partial ? " Leitura parcial, atualize para completar." : ""}</p>`;
  return note + table(["Dia (UTC)", "Sessões", "Pedidos", "Respostas", "Erros"], page.html, "Atividade do Antigravity por dia") + page.pager;
}

/** @param {{ days: any[], error: string }} trend */
export function renderTrend(trend) {
  if (trend.error) return `<p class="c-empty"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> ${esc(trend.error)}</p>`;
  if (!trend.days.length) return `<p class="c-empty">Sem chamadas observadas no período.</p>`;
  const bars = trend.days.map((d) =>
    `<div class="c-bar" title="${esc(d.text)}"><span style="height:${d.heightPct}%"></span><em>${esc(d.label)}</em></div>`).join("");
  return `<div class="c-trend" role="img" aria-label="Chamadas por dia">${bars}</div>`;
}

/** @param {any[]} asOf */
export function renderAsOf(asOf) {
  return asOf.map((a) => {
    const state = a.ok ? "" : ` is-error" title="${esc(a.error)}`;
    const warn = a.warnings.length ? ` <i class="fa-solid fa-triangle-exclamation" title="${esc(a.warnings.join(" | "))}" aria-label="Avisos"></i>` : "";
    return `<span class="c-asof${state}"><i class="fa-regular fa-clock" aria-hidden="true"></i> ${esc(a.label)}: ${a.ok ? esc(a.atText) : "indisponível"}${warn}</span>`;
  }).join("");
}
