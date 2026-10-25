// @ts-check
// Renderizadores de linha (lista) e cartão (Kanban) da Central de Sessões.

import { describeSession } from "./central-sessions-model.js";
import { esc, engineKey, engineLabel, isNeutral, relativeTime, shortSessionId, statusBadge } from "./central-sessions-format.js";
import { lastActivityText, originBadge, presenceBadges } from "./central-sessions-presence.js";

/**
 * Pill colorida com o motor da sessão.
 * @param {string} provider
 * @returns {string}
 */
export function engineBadge(provider) {
  const muted = provider ? "" : " is-muted";
  return `<span class="central-engine${muted}" data-engine="${esc(engineKey(provider))}"><i class="fa-solid fa-microchip" aria-hidden="true"></i> ${esc(engineLabel(provider))}</span>`;
}

/**
 * @param {object} session
 * @param {object} status
 * @returns {string}
 */
function projectCell(session, status) {
  const hasProject = Boolean(session.projectId);
  const confidenceMuted = isNeutral(status.confidence.label) ? " is-muted" : "";
  return `
    <div class="central-cell central-cell--project" role="cell">
      <span class="central-cell__label">Projeto</span>
      <span class="central-row__project${hasProject ? "" : " is-muted"}">${esc(session.projectId || "sem projeto")}</span>
      <span class="central-row__confidence${confidenceMuted}"><i class="fa-solid ${esc(status.confidence.icon)}" aria-hidden="true"></i> ${esc(status.confidence.label)}</span>
    </div>`;
}

/**
 * @param {object} session
 * @param {object} status
 * @returns {string}
 */
function statusCell(session, status) {
  return `
    <div class="central-cell central-cell--status" role="cell">
      <span class="central-cell__label">Execução</span>
      <span class="central-row__pills">${statusBadge(status.execution)}${presenceBadges(session)}</span>
    </div>`;
}

/**
 * @param {object} session
 * @param {object} status
 * @returns {string}
 */
function workflowCell(session, status) {
  const isNone = !session.workflowStatus || session.workflowStatus === "none";
  const label = isNone ? "Sem workflow" : status.workflow.label;
  const icon = isNone ? "fa-minus" : status.workflow.icon;
  const body = isNone || isNeutral(label)
    ? `<span class="central-muted"><i class="fa-solid ${esc(icon)}" aria-hidden="true"></i> ${esc(label)}</span>`
    : statusBadge(status.workflow);
  return `
    <div class="central-cell central-cell--workflow" role="cell">
      <span class="central-cell__label">Workflow</span>
      ${body}
    </div>`;
}

/**
 * Atenção só recebe destaque quando há ação pendente; o resto fica discreto.
 * @param {object} session
 * @param {object} status
 * @returns {string}
 */
function attentionCell(session, status) {
  const key = session.attentionStatus || "";
  const required = key === "open";
  const neutral = !key || key === "none" || key === "unknown";
  const label = neutral ? "Sem atenção" : status.attention.label;
  const icon = neutral ? "fa-circle-check" : status.attention.icon;
  const body = required
    ? statusBadge(status.attention, "central-badge--alert")
    : `<span class="central-muted"><i class="fa-solid ${esc(icon)}" aria-hidden="true"></i> ${esc(label)}</span>`;
  return `
    <div class="central-cell central-cell--attention" role="cell">
      <span class="central-cell__label">Atenção</span>
      ${body}
    </div>`;
}

/**
 * @param {object} session
 * @returns {string}
 */
function originCell(session) {
  const full = lastActivityText(session);
  const relative = relativeTime(session.lastActivityAt || session.lastObservedAt);
  return `
    <div class="central-cell central-cell--origin" role="cell">
      <span class="central-cell__label">Origem e Última atividade</span>
      <span class="central-row__origin">${originBadge(session) || '<span class="central-muted">registro Markdown</span>'}</span>
      <span class="central-row__time" title="${esc(full)}"><i class="fa-regular fa-clock" aria-hidden="true"></i> ${esc(relative)}</span>
    </div>`;
}

/**
 * Linha estruturada da visão em lista.
 * @param {object} session
 * @returns {string}
 */
export function renderSessionRow(session) {
  const status = describeSession(session);
  return `
    <div class="central-row" role="row" data-session-id="${esc(session.id)}" tabindex="0">
      <div class="central-cell central-cell--session" role="cell">
        <span class="central-row__title">${esc(session.title || "Sessão sem título")}</span>
        <span class="central-row__meta">
          ${engineBadge(session.primaryProvider)}
          <span class="central-row__id">${esc(shortSessionId(session.id))}</span>
        </span>
      </div>
      ${projectCell(session, status)}
      ${statusCell(session, status)}
      ${workflowCell(session, status)}
      ${attentionCell(session, status)}
      ${originCell(session)}
    </div>`;
}

/**
 * Cartão da visão Kanban.
 * @param {object} session
 * @returns {string}
 */
export function renderSessionCard(session) {
  const status = describeSession(session);
  const required = session.attentionStatus === "open";
  const relative = relativeTime(session.lastActivityAt || session.lastObservedAt);
  return `
    <article class="central-card" data-session-id="${esc(session.id)}" tabindex="0">
      <header class="central-card__head">
        <h4 class="central-card__title">${esc(session.title || "Sessão sem título")}</h4>
        <span class="central-card__id">${esc(shortSessionId(session.id))}</span>
      </header>
      <p class="central-card__meta">
        ${engineBadge(session.primaryProvider)}
        <span class="central-row__project${session.projectId ? "" : " is-muted"}">${esc(session.projectId || "sem projeto")}</span>
        <span class="central-row__confidence${isNeutral(status.confidence.label) ? " is-muted" : ""}"><i class="fa-solid ${esc(status.confidence.icon)}" aria-hidden="true"></i> ${esc(status.confidence.label)}</span>
      </p>
      <div class="central-card__badges">
        ${statusBadge(status.execution)}
        ${presenceBadges(session)}
        ${required ? statusBadge(status.attention, "central-badge--alert") : ""}
      </div>
      <p class="central-card__foot">
        ${originBadge(session) || '<span class="central-muted">registro Markdown</span>'}
        <span class="central-row__time" title="${esc(lastActivityText(session))}"><i class="fa-regular fa-clock" aria-hidden="true"></i> ${esc(relative)}</span>
      </p>
    </article>`;
}
