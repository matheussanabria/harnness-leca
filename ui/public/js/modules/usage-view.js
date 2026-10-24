// @ts-check
// Aba Consumo: renderização HTML pura (sem DOM, sem rede). Ícones FontAwesome, sem emojis.

import { esc, formatCompact, formatCost, formatExact, formatPercent } from "./usage-format.js";
import { WINDOWS } from "./usage-view-model.js";

/** @param {string} window */
export function renderWindowSelector(window) {
  const buttons = WINDOWS.map((w) => {
    const on = w.id === window;
    return `<button type="button" class="usage-window-btn${on ? " is-active" : ""}" data-usage-window="${w.id}" aria-pressed="${on}">${esc(w.label)}</button>`;
  }).join("");
  return `<div class="usage-toolbar"><div class="usage-windows" role="group" aria-label="Janela de tempo">${buttons}</div>
    <button type="button" class="usage-refresh-btn" data-usage-refresh aria-label="Atualizar consumo"><i class="fa-solid fa-rotate" aria-hidden="true"></i> Atualizar</button></div>`;
}

/** @param {any} vm */
export function renderNotices(vm) {
  let html = `<div class="usage-notice" role="note"><i class="fa-solid fa-circle-info" aria-hidden="true"></i>
    <span>Custo <b>ESTIMADO</b> e <b>equivalente em API</b>: tokens vezes tabela de preços. Não é fatura nem cobrança real.</span></div>`;
  if (vm.notices.pendingReview) {
    html += `<div class="usage-notice usage-notice--warn" role="note"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
      <span>A tabela de preços ainda aguarda revisão do usuário (<code>pending-user-review</code>); trate os valores como provisórios.</span></div>`;
  }
  if (!vm.ingestEnabled) {
    html += `<div class="usage-notice usage-notice--warn" role="note"><i class="fa-solid fa-plug-circle-xmark" aria-hidden="true"></i>
      <span>A ingestão de uso está desativada; os números abaixo podem estar desatualizados.</span></div>`;
  }
  return html;
}

/** @param {any[]} cards @param {string} reasoning */
export function renderCards(cards, reasoning) {
  const items = cards.map((c) =>
    `<div class="usage-card" role="listitem"><span class="usage-card__label">${esc(c.label)}</span>
      <b class="usage-card__value" title="${esc(c.title)}">${esc(c.text)}</b></div>`).join("");
  return `<div class="usage-cards" role="list" aria-label="Resumo de consumo">${items}</div>
    <p class="usage-muted">Tokens de raciocínio: <b title="${esc(reasoning)}">${esc(reasoning)}</b></p>`;
}

/** @param {any[] | null} origin */
export function renderOrigin(origin) {
  const head = `<h4 class="usage-h"><i class="fa-solid fa-sitemap" aria-hidden="true"></i> Principal vs subagentes</h4>`;
  if (!origin) return `<section class="usage-section" aria-label="Principal vs subagentes">${head}<p class="usage-muted">Divisão por origem indisponível (n/d).</p></section>`;
  const rows = origin.map((o) => `<div class="usage-origin usage-origin--${esc(o.id)}">
      <b class="usage-origin__name">${esc(o.label)}</b>
      <span>Chamadas <b title="${esc(formatExact(o.calls))}">${formatCompact(o.calls)}</b> (${formatPercent(o.share.calls)})</span>
      <span>Tokens <b title="${esc(formatExact(o.tokens))}">${formatCompact(o.tokens)}</b> (${formatPercent(o.share.tokens)})</span>
      <span>Custo <b title="${esc(formatExact(o.cost))}">${formatCost({ amount: o.cost })}</b> (${formatPercent(o.share.cost)})</span>
    </div>`).join("");
  const sub = origin[1];
  const bar = sub.share.calls === null ? "" : `<div class="usage-split" aria-hidden="true"><i style="width:${100 - sub.share.calls}%"></i><i class="is-sub" style="width:${sub.share.calls}%"></i></div>`;
  return `<section class="usage-section" aria-label="Principal vs subagentes">${head}${bar}${rows}</section>`;
}

/** @param {any[]} days */
export function renderDays(days) {
  const head = `<h4 class="usage-h"><i class="fa-solid fa-chart-column" aria-hidden="true"></i> Chamadas por dia</h4>`;
  if (!days.length) return `<section class="usage-section">${head}<p class="usage-muted">Sem dados por dia (n/d).</p></section>`;
  const bars = days.map((d) => `<li class="usage-day" title="${esc(d.text)}"><span class="usage-day__bar" style="height:${d.heightPct}%"></span>
      <span class="usage-day__label" aria-hidden="true">${esc(d.label)}</span><span class="usage-sr">${esc(d.text)}</span></li>`).join("");
  return `<section class="usage-section" aria-label="Chamadas por dia">${head}<ul class="usage-days">${bars}</ul></section>`;
}

/** @param {string} title @param {string[]} heads @param {string[][]} rows @param {string} empty */
function table(title, heads, rows, empty) {
  const h = heads.map((x) => `<th scope="col">${esc(x)}</th>`).join("");
  const body = rows.length ? rows.map((r) => `<tr>${r.join("")}</tr>`).join("") : `<tr><td colspan="${heads.length}" class="usage-muted">${esc(empty)}</td></tr>`;
  return `<table class="usage-table" aria-label="${esc(title)}"><thead><tr>${h}</tr></thead><tbody>${body}</tbody></table>`;
}

/** @param {string} text @param {string} [title] */
const td = (text, title = "") => `<td${title ? ` title="${esc(title)}"` : ""}>${esc(text)}</td>`;

/** @param {any[]} models */
export function renderModels(models) {
  const rows = models.map((m) => [td(m.key), td(formatCompact(m.calls), formatExact(m.calls)), td(formatCompact(m.tokensOut), formatExact(m.tokensOut)), td(m.costText, m.costExact), td(m.coverage)]);
  return `<section class="usage-section"><h4 class="usage-h"><i class="fa-solid fa-microchip" aria-hidden="true"></i> Por modelo</h4>${table("Consumo por modelo", ["Modelo", "Chamadas", "Saída", "Custo", "Com custo"], rows, "Sem modelos no período.")}</section>`;
}

/** @param {any[]} sessions */
export function renderSessions(sessions) {
  const rows = sessions.map((s) => [td(s.shortId, s.key), td(s.engine), td(s.modelsText), td(formatCompact(s.calls), formatExact(s.calls)), td(s.costText, s.costExact), td(s.lastAtText)]);
  return `<section class="usage-section"><h4 class="usage-h"><i class="fa-solid fa-list-ol" aria-hidden="true"></i> Principais sessões</h4>${table("Principais sessões por consumo", ["Sessão", "Motor", "Modelos", "Chamadas", "Custo", "Última atividade"], rows, "Sem sessões no período.")}</section>`;
}

/** @param {any} cov */
export function renderCoverage(cov) {
  const unpriced = cov.unpriced.length
    ? `<p class="usage-muted">Modelos sem preço: ${cov.unpriced.map((m) => `<code>${esc(m.model)}</code> (${esc(formatCompact(m.calls))})`).join(", ")}</p>` : "";
  const bad = cov.linesUnparsable === null ? "" : `<p class="usage-muted">Linhas ilegíveis na ingestão: <b>${esc(formatCompact(cov.linesUnparsable))}</b></p>`;
  return `<section class="usage-section" aria-label="Cobertura"><p class="usage-coverage"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i> ${esc(cov.text)}</p>${unpriced}${bad}</section>`;
}
