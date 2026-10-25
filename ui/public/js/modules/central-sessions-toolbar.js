// @ts-check
// Cabeçalho, resumo, busca e filtros da Central de Sessões (HTML puro, sem DOM).

import { formatTimestamp } from "./central-sessions-model.js";
import { esc } from "./central-sessions-format.js";

/**
 * @param {number} value
 * @param {string} singular
 * @param {string} plural
 * @returns {string}
 */
function plural(value, singular, plural) {
  return `${value} ${value === 1 ? singular : plural}`;
}

/**
 * Card de resumo do topo.
 * @param {{ value: number, label: string, icon: string, tone: string, spoken: string }} item
 * @returns {string}
 */
function statCard(item) {
  return `
    <div class="central-stat central-stat--${esc(item.tone)}" role="listitem" aria-label="${esc(item.spoken)}">
      <span class="central-stat__icon"><i class="fa-solid ${esc(item.icon)}" aria-hidden="true"></i></span>
      <span class="central-stat__body">
        <span class="central-stat__value">${item.value}</span>
        <span class="central-stat__label">${esc(item.label)}</span>
      </span>
    </div>`;
}

/**
 * Cabeçalho com título e os três cards de resumo.
 * @param {{ slug: string, summary: object, generatedAt: string }} params
 * @returns {string}
 */
export function renderCentralHeader(params) {
  const { slug, summary, generatedAt } = params;
  return `
    <header class="central-header">
      <div class="central-header__titles">
        <h3 class="central-header__title"><i class="fa-solid fa-diagram-project" aria-hidden="true"></i> Central de Sessões</h3>
        <p class="central-header__subtitle">Projeto ${esc(slug)} · atualizado em ${esc(formatTimestamp(generatedAt))}</p>
      </div>
      <div class="central-stats" role="list" aria-label="Resumo das sessões">
        ${statCard({
          value: summary.total,
          label: "Sessões",
          icon: "fa-layer-group",
          tone: "total",
          spoken: `${plural(summary.total, "sessão", "sessões")} no total`,
        })}
        ${statCard({
          value: summary.attention,
          label: "Com atenção",
          icon: "fa-triangle-exclamation",
          tone: "warning",
          spoken: `${summary.attention} com atenção necessária`,
        })}
        ${statCard({
          value: summary.inferred,
          label: "Vínculo inferido",
          icon: "fa-wand-magic-sparkles",
          tone: "info",
          spoken: `${summary.inferred} com vínculo inferido`,
        })}
      </div>
    </header>`;
}

/**
 * Botões de busca, atualização e alternância de visão.
 * @param {{ query: string, view: string }} params
 * @returns {string}
 */
export function renderCentralToolbar(params) {
  const { query, view } = params;
  const listActive = view !== "kanban";
  return `
    <div class="central-toolbar">
      <label class="central-search">
        <span class="sr-only">Buscar sessões</span>
        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        <input type="search" id="centralSearch" value="${esc(query)}" placeholder="Buscar por título, ID ou projeto" autocomplete="off" />
      </label>
      <button type="button" class="central-btn" id="centralRefresh"><i class="fa-solid fa-rotate" aria-hidden="true"></i> Atualizar</button>
      <div class="central-viewtoggle" role="group" aria-label="Modo de visualização">
        <button type="button" class="central-viewtoggle__btn ${listActive ? "is-active" : ""}" data-view="list" aria-pressed="${listActive}">
          <i class="fa-solid fa-list" aria-hidden="true"></i> Lista
        </button>
        <button type="button" class="central-viewtoggle__btn ${listActive ? "" : "is-active"}" data-view="kanban" aria-pressed="${!listActive}">
          <i class="fa-solid fa-table-columns" aria-hidden="true"></i> Kanban
        </button>
      </div>
    </div>`;
}

/**
 * @param {string} id
 * @param {string} label
 * @param {string} icon
 * @param {string} name
 * @param {Array<object|string>} values
 * @param {string} [current]
 * @returns {string}
 */
function filterSelect(id, label, icon, name, values, current) {
  const options = values
    .map((value) => {
      const optionId = value?.id ?? value;
      const optionLabel = value?.label ?? value;
      return `<option value="${esc(optionId)}" ${current === optionId ? "selected" : ""}>${esc(optionLabel)}</option>`;
    })
    .join("");
  return `
    <label class="central-filter">
      <span class="central-filter__label"><i class="fa-solid ${esc(icon)}" aria-hidden="true"></i> ${esc(label)}</span>
      <span class="central-select">
        <select id="${esc(id)}" data-filter="${esc(name)}">
          <option value="">Todos</option>
          ${options}
        </select>
        <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
      </span>
    </label>`;
}

/**
 * Barra de filtros.
 * @param {{ filters: object, options: object }} params
 * @returns {string}
 */
export function renderCentralFilters(params) {
  const { filters = {}, options = {} } = params;
  return `
    <div class="central-filters" role="group" aria-label="Filtros da Central">
      ${filterSelect("centralFilterProvider", "Motor", "fa-microchip", "provider", options.providers || [], filters.provider)}
      ${filterSelect("centralFilterExecution", "Execução", "fa-bolt", "executionStatus", options.executionStatus || [], filters.executionStatus)}
      ${filterSelect("centralFilterWorkflow", "Workflow", "fa-diagram-project", "workflowStatus", options.workflowStatus || [], filters.workflowStatus)}
      ${filterSelect("centralFilterAttention", "Atenção", "fa-triangle-exclamation", "attentionStatus", options.attentionStatus || [], filters.attentionStatus)}
      ${filterSelect("centralFilterConfidence", "Vínculo", "fa-link", "projectConfidence", options.projectConfidence || [], filters.projectConfidence)}
    </div>`;
}
