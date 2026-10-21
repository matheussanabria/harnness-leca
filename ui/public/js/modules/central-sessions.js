// @ts-check
// Orquestrador da Central de Sessões (EP-09.03).
// Mantém o estado da visão (filtros, modo, seleção) e conecta o cliente de leitura.

import { createHttpSessionClient } from "./central-sessions-api.js";
import { renderCentral } from "./central-sessions-view.js";
import {
  ATTENTION_STATUS,
  CONFIDENCE,
  EXECUTION_STATUS,
  WORKFLOW_STATUS,
} from "./central-sessions-model.js";

const FILTER_NAMES = ["provider", "executionStatus", "workflowStatus", "attentionStatus", "projectConfidence"];

/** Cache curto do read model: evita tempestade de consultas quando o painel redesenha. */
const PAYLOAD_TTL_MS = 5000;
/** @type {Map<string, { at: number, payload: object }>} */
const payloadCache = new Map();

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
    sessions: [],
    detail: null,
    generatedAt: "",
    source: "live",
    warnings: [],
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
 * Carrega o read model e atualiza o estado.
 * @param {object} state
 * @param {{ listSessions: Function, getSession: Function }} client
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<object>}
 */
export async function loadCentral(state, client, opts = {}) {
  const useCache = !opts.force && Object.keys(state.filters || {}).length === 0 && !state.query;
  const cached = useCache ? payloadCache.get(state.slug) : null;
  const fresh = cached && Date.now() - cached.at < PAYLOAD_TTL_MS ? cached.payload : null;
  const payload = fresh || (await client.listSessions(state.slug, { ...state.filters, q: state.query }));
  if (!fresh) payloadCache.set(state.slug, { at: Date.now(), payload });
  const sessions = Array.isArray(payload?.sessions) ? payload.sessions : [];
  const providers = [...new Set(sessions.map((session) => session.primaryProvider).filter(Boolean))].sort();
  const options = { ...filterOptions(), provider: providers.map((id) => ({ id, label: id })) };
  let detail = state.detail;
  if (state.selectedId) {
    detail = await client.getSession(state.slug, state.selectedId);
  }
  return {
    ...state,
    sessions,
    detail,
    options,
    generatedAt: String(payload?.generatedAt || ""),
    source: String(payload?.source || "live"),
    warnings: Array.isArray(payload?.warnings) ? payload.warnings : [],
  };
}

/**
 * Desenha a Central em um container.
 * @param {HTMLElement} container
 * @param {object} state
 * @returns {void}
 */
export function renderCentralInto(container, state) {
  if (!container) return;
  container.innerHTML = renderCentral({
    slug: state.slug,
    view: state.view,
    query: state.query,
    filters: state.filters,
    options: state.options || filterOptions(),
    sessions: state.sessions,
    detail: state.detail,
    selectedId: state.selectedId,
    generatedAt: state.generatedAt,
    source: state.source,
  });
}

/**
 * Liga os controles da Central.
 * @param {HTMLElement} container
 * @param {object} state
 * @param {(next: object) => void} onChange - recebe o novo estado
 * @param {{ listSessions: Function, getSession: Function }} [client]
 * @returns {void}
 */
export function setupCentralListeners(container, state, onChange, client) {
  if (!container) return;

  const search = /** @type {HTMLInputElement | null} */ (container.querySelector("#centralSearch"));
  search?.addEventListener("input", () => onChange({ ...state, query: search.value }));

  const refresh = container.querySelector("#centralRefresh");
  refresh?.addEventListener("click", () => {
    if (!client) return;
    loadCentral(state, client).then((next) => onChange(next));
  });

  for (const name of FILTER_NAMES) {
    const select = /** @type {HTMLSelectElement | null} */ (container.querySelector(`[data-filter="${name}"]`));
    select?.addEventListener("change", () => {
      const filters = { ...state.filters };
      if (select.value) filters[name] = select.value;
      else delete filters[name];
      onChange({ ...state, filters });
    });
  }

  for (const button of Array.from(container.querySelectorAll("[data-view]"))) {
    button.addEventListener("click", () => {
      const view = button.getAttribute("data-view") === "kanban" ? "kanban" : "list";
      onChange({ ...state, view });
    });
  }

  for (const row of Array.from(container.querySelectorAll("[data-session-id]"))) {
    const id = row.getAttribute("data-session-id") || "";
    const select = () => {
      const next = { ...state, selectedId: id };
      if (client) {
        loadCentral(next, client).then((loaded) => onChange(loaded));
      } else {
        onChange(next);
      }
    };
    row.addEventListener("click", select);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select();
      }
    });
  }
}

/**
 * Atalho de uso: cria estado, carrega e desenha.
 * @param {HTMLElement} container
 * @param {{ slug: string, client?: object, state?: object }} params
 * @returns {Promise<object>}
 */
export async function mountCentral(container, params) {
  const client = params.client || createHttpSessionClient();
  let state = createCentralState({ ...(params.state || {}), slug: params.slug });
  state = await loadCentral(state, client);
  renderCentralInto(container, state);
  setupCentralListeners(container, state, (next) => {
    state = next;
    renderCentralInto(container, state);
    setupCentralListeners(container, state, (updated) => {
      state = updated;
      renderCentralInto(container, state);
    }, client);
  }, client);
  return state;
}
