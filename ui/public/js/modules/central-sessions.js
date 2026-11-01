// @ts-check
// Orquestrador da Central de Sessões (EP-09.03).
// Mantém o estado da visão (filtros, modo, seleção) e conecta o cliente de leitura.

import { createHttpSessionClient } from "./central-sessions-api.js";
import { renderCentral } from "./central-sessions-view.js";
import { createCentralLiveSubscription } from "./central-live.js";
import { bindPagers } from "../shared/pagination.js";
import { executeSessionAction } from "./central-action-dispatcher.js";
import {
  ATTENTION_STATUS,
  CONFIDENCE,
  EXECUTION_STATUS,
  WORKFLOW_STATUS,
} from "./central-sessions-model.js";

const FILTER_NAMES = ["provider", "executionStatus", "workflowStatus", "attentionStatus", "projectConfidence"];

/**
 * Memória da interface por projeto. O painel do escritório remonta a Central a cada atualização;
 * sem isto o modo Kanban, a página e os filtros voltavam ao padrão (lista) e a navegação se perdia.
 * @type {Map<string, object>}
 */
const uiMemory = new Map();
const REMEMBERED = ["view", "page", "query", "filters", "selectedId"];
/** @type {{ disconnect: () => void } | null} */
let activeSubscription = null;

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
    page: Math.max(1, Number(state.page) || 1),
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
  const payload = fresh || (await client.listSessions(state.slug, { ...state.filters, q: state.query, limit: 200 }));
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
    page: state.page,
    generatedAt: state.generatedAt,
    source: state.source,
    liveStatus: state.liveStatus,
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
  search?.addEventListener("input", () => onChange({ ...state, query: search.value, page: 1 }));

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
      onChange({ ...state, filters, page: 1 });
    });
  }

  for (const button of Array.from(container.querySelectorAll("[data-view]"))) {
    button.addEventListener("click", () => {
      const view = button.getAttribute("data-view") === "kanban" ? "kanban" : "list";
      onChange({ ...state, view, page: 1 });
    });
  }

  // Ações da sessão (Abrir conversa, Retomar sessão, etc)
  for (const btn of Array.from(container.querySelectorAll("[data-session-action]"))) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const actionId = btn.getAttribute("data-session-action") || "";
      const sessionId = btn.getAttribute("data-session-id") || "";
      const session = state.sessions.find((s) => s.id === sessionId) || state.detail?.session || null;
      if (session) {
        executeSessionAction(actionId, session, {
          slug: state.slug,
          reRender: () => {
            if (client) loadCentral(state, client).then((next) => onChange(next));
          },
        });
      }
    });
  }

  bindPagers(container, (_key, page) => onChange({ ...state, page }));

  for (const row of Array.from(container.querySelectorAll("[data-session-id]:not([data-session-action])"))) {
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
 * Atalho de uso: cria estado, carrega, desenha e assina o stream ao vivo.
 * @param {HTMLElement} container
 * @param {{ slug: string, client?: object, state?: object, autoLive?: boolean }} params
 * @returns {Promise<{ state: object, subscription?: object }>}
 */
export async function mountCentral(container, params) {
  const client = params.client || createHttpSessionClient();
  const given = Object.fromEntries(Object.entries(params.state || {}).filter(([, value]) => value !== "" && value != null));
  let state = createCentralState({ ...(uiMemory.get(params.slug) || {}), ...given, slug: params.slug });
  state = await loadCentral(state, client);

  const rebind = () => {
    uiMemory.set(state.slug, Object.fromEntries(REMEMBERED.map((key) => [key, state[key]])));
    renderCentralInto(container, state);
    setupCentralListeners(container, state, (updated) => {
      state = updated;
      rebind();
    }, client);
  };

  rebind();

  // Assinatura ao vivo via SSE se habilitado (padrão true)
  let subscription;
  if (params.autoLive !== false && typeof EventSource !== "undefined") {
    activeSubscription?.disconnect();
    subscription = createCentralLiveSubscription({
      slug: state.slug,
      onEvent: () => {
        loadCentral(state, client).then((next) => {
          state = next;
          rebind();
        });
      },
      onStatusChange: (liveStatus) => {
        state = { ...state, liveStatus };
        const badgeContainer = container.querySelector(".central-live-badge");
        if (badgeContainer) {
          rebind();
        }
      },
    });
    subscription.connect();
    activeSubscription = subscription;
  }

  return { state, subscription };
}
