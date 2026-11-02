// @ts-check
// Kanban da Central com limite por raia (EP-09.03).
// Agrupa as sessões em raias ANTES de limitar: cada raia mostra no máximo LANE_STEP cards
// e um botão "Mostrar mais" soma LANE_STEP ao limite daquela raia. Acima de KANBAN_SESSION_CAP
// sessões o Kanban fica desativado (lista no lugar) até o usuário forçar.
// Funções puras: recebem dados e devolvem HTML. Sem DOM, sem rede.

import { groupByLane } from "./central-sessions-model.js";
import { renderSessionCard } from "./central-sessions-card.js";
import { esc } from "./central-sessions-format.js";

export const LANE_STEP = 5;
export const KANBAN_SESSION_CAP = 100;

const EMPTY_HTML = `<p class="central-empty"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Nenhuma sessão para os filtros atuais.</p>`;

/**
 * Quantas sessões de uma raia entram no DOM.
 * @param {Record<string, number>} laneLimits
 * @param {string} laneId
 * @returns {number}
 */
export function laneLimitFor(laneLimits, laneId) {
  const limit = Number(laneLimits?.[laneId]);
  return Number.isFinite(limit) && limit > 0 ? limit : LANE_STEP;
}

/**
 * O Kanban só é desenhado até o teto, ou quando o usuário força a visualização.
 * @param {number} totalSessions
 * @param {boolean} kanbanForce
 * @returns {boolean}
 */
export function isKanbanAllowed(totalSessions, kanbanForce) {
  return totalSessions <= KANBAN_SESSION_CAP || kanbanForce === true;
}

/**
 * Botão de cada raia com sessões ocultas.
 * @param {string} laneId
 * @param {string} label
 * @param {number} hidden
 * @returns {string}
 */
function renderLaneMore(laneId, label, hidden) {
  return `
      <button type="button" class="central-lane__more" data-lane-more="${esc(laneId)}" aria-label="Mostrar mais em ${esc(label)}">
        <i class="fa-solid fa-angles-down" aria-hidden="true"></i>
        Mostrar mais (${hidden})
      </button>`;
}

/**
 * Uma raia com no máximo o limite de cards.
 * @param {{ id: string, label: string, sessions: object[] }} lane
 * @param {number} limit
 * @returns {string}
 */
function renderLane(lane, limit) {
  const hidden = Math.max(0, lane.sessions.length - limit);
  const cards = lane.sessions.slice(0, limit).map(renderSessionCard).join("");
  return `
        <section class="central-lane" role="listitem" aria-label="${esc(lane.label)}">
          <header class="central-lane__header">
            <span class="central-lane__title">${esc(lane.label)}</span>
            <span class="central-lane__count">${lane.sessions.length}</span>
          </header>
          <div class="central-lane__body">
            ${cards}
          </div>
          ${hidden > 0 ? renderLaneMore(lane.id, lane.label, hidden) : ""}
        </section>`;
}

/**
 * Visão Kanban: agrupa por raia primeiro e depois limita os cards de cada uma.
 * @param {object[]} sessions
 * @param {Record<string, number>} [laneLimits]
 * @returns {string}
 */
export function renderKanbanLanes(sessions, laneLimits = {}) {
  const lanes = groupByLane(sessions);
  if (!lanes.length || sessions.length === 0) return EMPTY_HTML;
  return `
    <div class="central-kanban" role="list" aria-label="Sessões por workflow">
      ${lanes.map((lane) => renderLane(lane, laneLimitFor(laneLimits, lane.id))).join("")}
    </div>`;
}

/**
 * Aviso de Kanban desativado por excesso de sessões, com a ação de forçar.
 * @param {number} totalSessions
 * @returns {string}
 */
export function renderKanbanNotice(totalSessions) {
  return `
    <div class="central-notice" role="status">
      <p>
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        Kanban desativado: ${totalSessions} sessões excedem o limite de ${KANBAN_SESSION_CAP}. Mostrando a lista.
      </p>
      <button type="button" class="central-notice__action" data-kanban-force>
        <i class="fa-solid fa-table-columns" aria-hidden="true"></i>
        Mostrar Kanban mesmo assim
      </button>
    </div>`;
}
