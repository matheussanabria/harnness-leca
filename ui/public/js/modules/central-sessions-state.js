// @ts-check
// Estado da Central de Sessões (EP-09.03): valor inicial, opções de filtro e mescla do read model.
// Funções puras, sem DOM nem rede.

import { ATTENTION_STATUS, CONFIDENCE, EXECUTION_STATUS, WORKFLOW_STATUS } from "./central-sessions-model.js";

/**
 * @param {object} [state]
 * @returns {object}
 */
export function createCentralState(state = {}) {
  return {
    slug: String(state.slug || ""),
    view: state.view === "kanban" ? "kanban" : "list",
    query: String(state.query || ""),
    filters: { ...(state.filters || {}) },
    selectedId: String(state.selectedId || ""),
    page: Math.max(1, Number(state.page) || 1),
    laneLimits: {},
    kanbanForce: false,
    sessions: [],
    detail: null,
    generatedAt: "",
    source: "live",
    warnings: [],
    liveStatus: { state: "disconnected", cursor: "", lastUpdatedAt: "", retryCount: 0 },
    ...state,
  };
}

/**
 * Opções dos filtros, derivadas dos enums do modelo.
 * @returns {object}
 */
export function filterOptions() {
  const toOptions = (map) => Object.entries(map).map(([id, item]) => ({ id, label: item.label }));
  return {
    provider: [],
    executionStatus: toOptions(EXECUTION_STATUS),
    workflowStatus: toOptions(WORKFLOW_STATUS),
    attentionStatus: toOptions(ATTENTION_STATUS),
    projectConfidence: toOptions(CONFIDENCE),
  };
}

/**
 * Aplica ao estado atual só os dados do read model carregado. Filtros, busca, página e
 * visão do estado atual são preservados, mesmo que a carga tenha começado antes de uma edição.
 * @param {object} state estado atual
 * @param {object} loaded resultado de loadCentral
 * @returns {object}
 */
export function mergePayload(state, loaded) {
  const sameSelection = loaded.selectedId === state.selectedId;
  return {
    ...state,
    sessions: loaded.sessions,
    detail: sameSelection ? loaded.detail : state.detail,
    options: loaded.options,
    generatedAt: loaded.generatedAt,
    source: loaded.source,
    warnings: loaded.warnings,
  };
}
