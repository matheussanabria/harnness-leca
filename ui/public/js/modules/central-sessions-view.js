// @ts-check
// View da Central de Sessões (EP-09.03).
// Funções puras de renderização: recebem dados e devolvem HTML. Sem DOM, sem rede.

import { describeSession, formatTimestamp, groupByLane, sortSessions, summarize } from "./central-sessions-model.js";

/**
 * @param {string} value
 * @returns {string}
 */
function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {object} status
 * @param {string} [extra]
 * @returns {string}
 */
function statusBadge(status, extra = "") {
  const item = status || { label: "Desconhecido", icon: "fa-circle-question" };
  return `<span class="central-badge central-badge--${esc(item.pattern || "outline")} ${esc(extra)}"><i class="fa-solid ${esc(item.icon)}"></i> ${esc(item.label)}</span>`;
}

/**
 * Cabeçalho: projeto, busca, atualização e resumo de atenção.
 * @param {{ slug: string, query: string, view: string, summary: object, generatedAt: string }} params
 * @returns {string}
 */
export function renderCentralHeader(params) {
  const { slug, query, view, summary, generatedAt } = params;
  return `
    <div class="central-header">
      <div class="central-header__titles">
        <h3 class="central-header__title"><i class="fa-solid fa-diagram-project"></i> Central de Sessões</h3>
        <p class="central-header__subtitle">
          Projeto ${esc(slug)} · ${summary.total} sessões · ${summary.attention} com atenção necessária ·
          ${summary.inferred} com vínculo inferido · atualizado em ${esc(formatTimestamp(generatedAt))}
        </p>
      </div>
      <div class="central-header__actions">
        <label class="central-search">
          <span class="sr-only">Buscar sessões</span>
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          <input type="search" id="centralSearch" value="${esc(query)}" placeholder="Buscar por título, ID ou projeto" />
        </label>
        <button type="button" class="central-btn" id="centralRefresh"><i class="fa-solid fa-rotate"></i> Atualizar</button>
      </div>
    </div>`;
}

/**
 * Barra de filtros.
 * @param {{ filters: object, options: object }} params
 * @returns {string}
 */
export function renderCentralFilters(params) {
  const { filters, options } = params;
  const select = (id, label, name, values, current) => `
    <label class="central-filter">
      <span>${esc(label)}</span>
      <select id="${esc(id)}" data-filter="${esc(name)}">
        <option value="">Todos</option>
        ${values
          .map((value) => `<option value="${esc(value.id ?? value)}" ${current === (value.id ?? value) ? "selected" : ""}>${esc(value.label ?? value)}</option>`)
          .join("")}
      </select>
    </label>`;

  return `
    <div class="central-filters" role="group" aria-label="Filtros da Central">
      ${select("centralFilterProvider", "Motor", "provider", options.providers || [], filters.provider)}
      ${select("centralFilterExecution", "Execução", "executionStatus", options.executionStatus || [], filters.executionStatus)}
      ${select("centralFilterWorkflow", "Workflow", "workflowStatus", options.workflowStatus || [], filters.workflowStatus)}
      ${select("centralFilterAttention", "Atenção", "attentionStatus", options.attentionStatus || [], filters.attentionStatus)}
      ${select("centralFilterConfidence", "Vínculo", "projectConfidence", options.projectConfidence || [], filters.projectConfidence)}
      <div class="central-viewtoggle" role="group" aria-label="Modo de visualização">
        <button type="button" class="central-btn ${params.view === "list" ? "is-active" : ""}" data-view="list" aria-pressed="${params.view === "list"}">
          <i class="fa-solid fa-list"></i> Lista
        </button>
        <button type="button" class="central-btn ${params.view === "kanban" ? "is-active" : ""}" data-view="kanban" aria-pressed="${params.view === "kanban"}">
          <i class="fa-solid fa-table-columns"></i> Kanban
        </button>
      </div>
    </div>`;
}

/**
 * @param {object} session
 * @returns {string}
 */
function renderSessionRow(session) {
  const status = describeSession(session);
  return `
    <tr class="central-row" data-session-id="${esc(session.id)}" tabindex="0">
      <td>
        <span class="central-row__title">${esc(session.title)}</span>
        <span class="central-row__id">${esc(String(session.id || "").slice(0, 12))}</span>
      </td>
      <td>${esc(session.projectId || "sem projeto")} <span class="central-row__confidence"><i class="fa-solid ${esc(status.confidence.icon)}"></i> ${esc(status.confidence.label)}</span></td>
      <td>${esc(session.primaryProvider || "desconhecido")}</td>
      <td>${statusBadge(status.workflow)}</td>
      <td>${statusBadge(status.execution)}</td>
      <td>${statusBadge(status.attention)}</td>
      <td>${esc(formatTimestamp(session.lastObservedAt))}</td>
    </tr>`;
}

/**
 * Visão em lista.
 * @param {object[]} sessions
 * @returns {string}
 */
export function renderCentralList(sessions) {
  if (!sessions.length) {
    return `<p class="central-empty"><i class="fa-solid fa-circle-info"></i> Nenhuma sessão para os filtros atuais.</p>`;
  }
  return `
    <table class="central-table">
      <caption class="sr-only">Sessões do projeto</caption>
      <thead>
        <tr>
          <th scope="col">Sessão</th>
          <th scope="col">Projeto</th>
          <th scope="col">Motor</th>
          <th scope="col">Workflow</th>
          <th scope="col">Execução</th>
          <th scope="col">Atenção</th>
          <th scope="col">Atualização</th>
        </tr>
      </thead>
      <tbody>
        ${sessions.map(renderSessionRow).join("")}
      </tbody>
    </table>`;
}

/**
 * @param {object} session
 * @returns {string}
 */
function renderSessionCard(session) {
  const status = describeSession(session);
  return `
    <article class="central-card" data-session-id="${esc(session.id)}" tabindex="0">
      <h4 class="central-card__title">${esc(session.title)}</h4>
      <p class="central-card__meta">${esc(session.primaryProvider || "desconhecido")} · ${esc(session.projectId || "sem projeto")}</p>
      <div class="central-card__badges">
        ${statusBadge(status.workflow)}
        ${statusBadge(status.execution)}
        ${statusBadge(status.attention)}
      </div>
      <p class="central-card__confidence"><i class="fa-solid ${esc(status.confidence.icon)}"></i> ${esc(status.confidence.label)} · ${esc(formatTimestamp(session.lastObservedAt))}</p>
    </article>`;
}

/**
 * Visão Kanban com as raias canônicas.
 * @param {object[]} sessions
 * @returns {string}
 */
export function renderCentralKanban(sessions) {
  const lanes = groupByLane(sessions);
  if (!lanes.length) {
    return `<p class="central-empty"><i class="fa-solid fa-circle-info"></i> Nenhuma sessão para os filtros atuais.</p>`;
  }
  return `
    <div class="central-kanban" role="list">
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
        </section>`
        )
        .join("")}
    </div>`;
}

/**
 * Painel de detalhe da sessão.
 * @param {{ session: object, detail: object | null }} params
 * @returns {string}
 */
export function renderCentralDetail(params) {
  const { session, detail } = params;
  if (!session) {
    return `<aside class="central-detail central-detail--empty"><i class="fa-solid fa-hand-pointer"></i> Selecione uma sessão para ver o detalhe.</aside>`;
  }
  const status = describeSession(session);
  const artifacts = detail?.session?.artifacts || detail?.artifacts || [];
  const executions = detail?.session?.executions || detail?.executions || [];
  const events = detail?.session?.events || detail?.events || [];

  return `
    <aside class="central-detail" aria-label="Detalhe da sessão">
      <h4 class="central-detail__title">${esc(session.title)}</h4>
      <dl class="central-detail__grid">
        <dt>Motor</dt><dd>${esc(session.primaryProvider || "desconhecido")}</dd>
        <dt>Projeto</dt><dd>${esc(session.projectId || "sem projeto")} (${esc(status.confidence.label)})</dd>
        <dt>Workflow</dt><dd>${statusBadge(status.workflow)}</dd>
        <dt>Execução</dt><dd>${statusBadge(status.execution)}</dd>
        <dt>Atenção</dt><dd>${statusBadge(status.attention)}</dd>
      </dl>
      <h5 class="central-detail__subtitle"><i class="fa-solid fa-file-lines"></i> Artefatos (${artifacts.length})</h5>
      <ul class="central-detail__list">
        ${artifacts.length ? artifacts.map((item) => `<li>${esc(item.path || item.relPath || "artefato")}</li>`).join("") : "<li>Nenhum artefato vinculado.</li>"}
      </ul>
      <h5 class="central-detail__subtitle"><i class="fa-solid fa-play"></i> Execuções (${executions.length})</h5>
      <ul class="central-detail__list">
        ${executions.length ? executions.map((item) => `<li>${esc(item.id || "execução")} — ${esc(item.status || "unknown")}</li>`).join("") : "<li>Nenhuma execução registrada.</li>"}
      </ul>
      <h5 class="central-detail__subtitle"><i class="fa-solid fa-timeline"></i> Timeline (${events.length})</h5>
      <ul class="central-detail__list">
        ${events.length ? events.map((item) => `<li>${esc(item.type || "evento")} — ${esc(formatTimestamp(item.at))}</li>`).join("") : "<li>Sem eventos publicados.</li>"}
      </ul>
    </aside>`;
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
      ${renderCentralHeader({ slug: params.slug, query: params.query, view: params.view, summary, generatedAt: params.generatedAt })}
      ${renderCentralFilters({ filters: params.filters, options: params.options, view: params.view })}
      <div class="central-body">
        <div class="central-content">
          ${params.view === "kanban" ? renderCentralKanban(sessions) : renderCentralList(sessions)}
        </div>
        ${renderCentralDetail({ session: selected, detail: params.detail })}
      </div>
    </section>`;
}
