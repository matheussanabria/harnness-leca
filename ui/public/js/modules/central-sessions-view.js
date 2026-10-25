// @ts-check
// View da Central de Sessões (EP-09.03).
// Funções puras de renderização: recebem dados e devolvem HTML. Sem DOM, sem rede.

import { groupByLane, sortSessions, summarize } from "./central-sessions-model.js";
import { esc } from "./central-sessions-format.js";
import { renderCentralFilters, renderCentralHeader, renderCentralToolbar } from "./central-sessions-toolbar.js";
import { renderSessionCard, renderSessionRow } from "./central-sessions-card.js";
import { renderCentralDetail } from "./central-sessions-detail.js";

export { renderCentralDetail, renderCentralFilters, renderCentralHeader };

const LIST_COLUMNS = [
  { key: "session", label: "Sessão" },
  { key: "project", label: "Projeto" },
  { key: "status", label: "Execução" },
  { key: "workflow", label: "Workflow" },
  { key: "attention", label: "Atenção" },
  { key: "origin", label: "Origem e Última atividade" },
];

/**
 * Visão em lista: cabeçalho de colunas e linhas em cards alinhados.
 * @param {object[]} sessions
 * @returns {string}
 */
export function renderCentralList(sessions) {
  if (!sessions.length) {
    return `<p class="central-empty"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Nenhuma sessão para os filtros atuais.</p>`;
  }
  const head = LIST_COLUMNS.map(
    (column) => `<span class="central-list__col central-list__col--${column.key}" role="columnheader">${esc(column.label)}</span>`,
  ).join("");
  return `
    <div class="central-list" role="table" aria-label="Sessões do projeto">
      <div class="central-list__head" role="row">${head}</div>
      <div class="central-list__body" role="rowgroup">
        ${sessions.map(renderSessionRow).join("")}
      </div>
    </div>`;
}

/**
 * Visão Kanban com as raias canônicas.
 * @param {object[]} sessions
 * @returns {string}
 */
export function renderCentralKanban(sessions) {
  const lanes = groupByLane(sessions);
  if (!lanes.length) {
    return `<p class="central-empty"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Nenhuma sessão para os filtros atuais.</p>`;
  }
  return `
    <div class="central-kanban" role="list" aria-label="Sessões por workflow">
      ${lanes
        .map(
          (lane) => `
        <section class="central-lane" role="listitem" aria-label="${esc(lane.label)}">
          <header class="central-lane__header">
            <span class="central-lane__title">${esc(lane.label)}</span>
            <span class="central-lane__count">${lane.sessions.length}</span>
          </header>
          <div class="central-lane__body">
            ${lane.sessions.map(renderSessionCard).join("")}
          </div>
        </section>`,
        )
        .join("")}
    </div>`;
}

/**
 * Composição da Central.
 * @param {{ slug: string, view: string, query: string, filters: object, options: object,
 *   sessions: object[], detail: object | null, selectedId: string, generatedAt: string, source: string }} params
 * @returns {string}
 */
export function renderCentral(params) {
  const sessions = sortSessions(params.sessions || []);
  const summary = summarize(sessions);
  const selected = sessions.find((session) => session.id === params.selectedId) || null;
  return `
    <section class="central" data-source="${esc(params.source || "live")}">
      ${renderCentralHeader({ slug: params.slug, summary, generatedAt: params.generatedAt })}
      ${renderCentralToolbar({ query: params.query, view: params.view })}
      ${renderCentralFilters({ filters: params.filters, options: params.options })}
      <div class="central-body">
        <div class="central-content">
          ${params.view === "kanban" ? renderCentralKanban(sessions) : renderCentralList(sessions)}
        </div>
        ${renderCentralDetail({ session: selected, detail: params.detail })}
      </div>
    </section>`;
}
