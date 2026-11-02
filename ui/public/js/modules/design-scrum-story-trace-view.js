// @ts-check
// Markup puro da secao de rastreabilidade da historia (maturidade, Definition of Ready e commits). Sem DOM, sem fetch.
import { esc } from "../shared/dom.js";

const MATURITY_LABEL = { draft: "Rascunho", refining: "Em refinamento", ready: "Pronta" };

/** @param {string} id @param {string} text */
const empty = (id, text) => `<p class="story-detail-empty" data-trace="${id}">${esc(text)}</p>`;

/** @param {any} maturity */
export function maturityHtml(maturity) {
  const value = Object.hasOwn(MATURITY_LABEL, maturity) ? maturity : "ready";
  return `<span class="story-maturity-badge is-${value}" data-trace="maturity"><i class="fa-solid fa-${value === "ready" ? "circle-check" : "pen-ruler"}" aria-hidden="true"></i>${esc(MATURITY_LABEL[value])}</span>`;
}

/** @param {any} dor resultado de evaluateDor */
export function dorHtml(dor) {
  if (!dor || !Array.isArray(dor.checks)) return empty("dor-missing", "Avaliacao indisponivel.");
  const rows = dor.checks.map((check) => {
    const icon = check.ok ? "circle-check" : (check.severity === "required" ? "circle-xmark" : "circle-exclamation");
    const kind = check.severity === "required" ? "obrigatorio" : "recomendado";
    return `<li class="story-dor-check ${check.ok ? "is-ok" : "is-fail"}" data-check="${esc(check.id)}">
      <i class="fa-solid fa-${icon}" aria-hidden="true"></i>
      <span><b>${esc(check.id)}</b> <small>${kind}</small>${check.ok ? "" : `<em>${esc(check.detail)}</em>`}</span>
    </li>`;
  }).join("");
  const verdict = dor.ready ? "Itens obrigatorios atendidos" : `Faltam itens obrigatorios: ${dor.requiredFailed.join(", ")}`;
  return `<p class="story-dor-verdict ${dor.ready ? "is-ready" : "is-blocked"}" data-trace="dor-verdict">${esc(verdict)}</p>
    <ul class="story-dor-checks">${rows}</ul>
    ${dor.humanReview ? '<p class="story-detail-empty">Checagem mecanica: a revisao humana continua necessaria.</p>' : ""}`;
}

/** @param {any} result resposta de /commits */
export function commitsHtml(result) {
  if (!result || result.available === false) {
    const reason = result?.reason ? ` (${result.reason})` : "";
    return empty("commits-unavailable", `Historico git indisponivel${reason}.`);
  }
  const commits = Array.isArray(result.commits) ? result.commits : [];
  if (!commits.length) return empty("commits-empty", "Nenhum commit com o trailer Story: para esta historia.");
  return `<ul class="story-commit-list">${commits.map((commit) => `<li class="story-commit" data-sha="${esc(commit.sha)}">
    <i class="fa-solid fa-code-commit" aria-hidden="true"></i>
    <span><code>${esc(commit.shortSha)}</code> ${esc(commit.subject)}<small>${esc(commit.authorName)} - ${esc(commit.committedAt)}</small></span>
    ${commit.verified ? "" : '<span class="story-commit-unverified" title="SHA nao confirmado no repositorio"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></span>'}
  </li>`).join("")}</ul>`;
}

/** Estado inicial da secao enquanto as rotas respondem. */
export function traceLoadingHtml() {
  return '<p class="story-detail-empty" data-trace="loading"><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Carregando evidencias...</p>';
}

/** @param {string} message */
export function traceErrorHtml(message) {
  return empty("error", `Nao foi possivel carregar as evidencias: ${message}`);
}

/** Corpo completo da secao quando as duas respostas chegaram. @param {{ maturity?: string, dor?: any, commits?: any }} data */
export function traceBodyHtml({ maturity, dor, commits }) {
  return `<div class="story-trace-maturity">${maturityHtml(maturity)}</div>
    <h4>Definition of Ready</h4>${dorHtml(dor)}
    <h4>Commits</h4>${commitsHtml(commits)}`;
}
