// @ts-check
// Escrita no DOM da Central de Sessões (EP-09.03).
// Redesenho completo preserva o campo de busca (valor, foco e caret); a troca do badge SSE é pontual.

import { renderCentral } from "./central-sessions-view.js";
import { filterOptions } from "./central-sessions-state.js";
import { renderLiveStatusBadge } from "./central-live.js";

/**
 * @typedef {Object} SearchSnapshot
 * @property {string} value
 * @property {number | null} start
 * @property {number | null} end
 * @property {boolean} focused
 */

/**
 * Guarda valor, foco e caret do campo de busca antes de substituir o HTML.
 * @param {HTMLElement} container
 * @returns {SearchSnapshot | null}
 */
export function captureSearchFocus(container) {
  const input = /** @type {HTMLInputElement | null} */ (container.querySelector?.("#centralSearch") ?? null);
  if (!input) return null;
  return {
    value: input.value,
    start: input.selectionStart,
    end: input.selectionEnd,
    focused: globalThis.document?.activeElement === input,
  };
}

/**
 * Restaura o campo de busca após o redesenho: texto ainda não confirmado, foco e caret.
 * @param {HTMLElement} container
 * @param {SearchSnapshot | null} snapshot
 * @returns {void}
 */
export function restoreSearchFocus(container, snapshot) {
  if (!snapshot) return;
  const input = /** @type {HTMLInputElement | null} */ (container.querySelector?.("#centralSearch") ?? null);
  if (!input) return;
  input.value = snapshot.value;
  if (!snapshot.focused) return;
  input.focus();
  if (snapshot.start !== null && snapshot.end !== null) input.setSelectionRange(snapshot.start, snapshot.end);
}

/**
 * Desenha a Central em um container, preservando o campo de busca.
 * @param {HTMLElement} container
 * @param {object} state
 * @returns {void}
 */
export function renderCentralInto(container, state) {
  if (!container) return;
  const search = captureSearchFocus(container);
  container.innerHTML = renderCentral({
    slug: state.slug,
    view: state.view,
    query: state.query,
    filters: state.filters,
    options: state.options || filterOptions(),
    sessions: state.sessions,
    detail: state.detail,
    selectedId: state.selectedId,
    page: state.page,
    generatedAt: state.generatedAt,
    source: state.source,
    liveStatus: state.liveStatus,
    laneLimits: state.laneLimits,
    kanbanForce: state.kanbanForce,
  });
  restoreSearchFocus(container, search);
}

/**
 * Troca apenas o badge de status SSE, sem redesenhar o painel.
 * @param {HTMLElement} container
 * @param {object} liveStatus
 * @returns {boolean} true quando o badge existia e foi trocado
 */
export function updateLiveBadge(container, liveStatus) {
  const badge = /** @type {HTMLElement | null} */ (container.querySelector?.(".central-live-badge") ?? null);
  if (!badge) return false;
  badge.outerHTML = renderLiveStatusBadge(liveStatus);
  return true;
}
