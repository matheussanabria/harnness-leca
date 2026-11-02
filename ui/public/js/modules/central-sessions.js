// @ts-check
// Orquestrador da Central de Sessões (EP-09.03).
// Mantém o estado da visão (filtros, modo, seleção) e conecta o cliente de leitura.

import { createHttpSessionClient } from "./central-sessions-api.js";
import { bindKanbanControls } from "./central-sessions-kanban-controls.js";
import { createCentralLiveSubscription } from "./central-live.js";
import { bindPagers } from "../shared/pagination.js";
import { executeSessionAction } from "./central-action-dispatcher.js";
import { createRefreshScheduler } from "./central-sessions-sync.js";
import { createCentralState, filterOptions, mergePayload } from "./central-sessions-state.js";
import { renderCentralInto, updateLiveBadge } from "./central-sessions-render.js";

export { createCentralState, filterOptions, renderCentralInto };

const FILTER_NAMES = ["provider", "executionStatus", "workflowStatus", "attentionStatus", "projectConfidence"];
const SEARCH_DEBOUNCE_MS = 250;

/**
 * Memória da interface por projeto. O painel do escritório remonta a Central a cada atualização;
 * sem isto o modo Kanban, a página e os filtros voltavam ao padrão (lista) e a navegação se perdia.
 * @type {Map<string, object>}
 */
const uiMemory = new Map();
const REMEMBERED = ["view", "page", "query", "filters", "selectedId", "laneLimits", "kanbanForce"];
/** @type {{ disconnect: () => void } | null} */
let activeSubscription = null;
/** @type {{ cancel: () => void } | null} */
let activeRefresh = null;

/** Cache curto do read model: evita tempestade de consultas quando o painel redesenha. */
const PAYLOAD_TTL_MS = 5000;
/** @type {Map<string, { at: number, payload: object }>} */
const payloadCache = new Map();

/**
 * Carrega o read model e atualiza o estado.
 * @param {object} state
 * @param {{ listSessions: Function, getSession: Function }} client
 * @param {{ force?: boolean, signal?: AbortSignal }} [opts]
 * @returns {Promise<object>}
 */
export async function loadCentral(state, client, opts = {}) {
  const useCache = !opts.force && Object.keys(state.filters || {}).length === 0 && !state.query;
  const cached = useCache ? payloadCache.get(state.slug) : null;
  const fresh = cached && Date.now() - cached.at < PAYLOAD_TTL_MS ? cached.payload : null;
  const listOptions = opts.signal ? { signal: opts.signal } : undefined;
  const payload = fresh || (await client.listSessions(state.slug, { ...state.filters, q: state.query, limit: 200 }, listOptions));
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
 * Busca com debounce: a consulta só é confirmada após a pausa de digitação. Se o campo foi
 * substituído por um redesenho, o pedido pendente é descartado; o novo ligador retoma o valor.
 * @param {HTMLElement} container
 * @param {HTMLInputElement} search
 * @param {object} state
 * @param {(next: object) => void} onChange
 * @returns {void}
 */
function bindSearch(container, search, state, onChange) {
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;
  const commit = () => {
    timer = null;
    if (container.querySelector("#centralSearch") !== search) return;
    onChange({ ...state, query: search.value, page: 1, laneLimits: {} });
  };
  search.addEventListener("input", () => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(commit, SEARCH_DEBOUNCE_MS);
  });
  // Texto digitado antes do redesenho (preservado pelo render) ainda não foi confirmado.
  if (search.value !== state.query) timer = setTimeout(commit, SEARCH_DEBOUNCE_MS);
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
  if (search) bindSearch(container, search, state, onChange);

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
      onChange({ ...state, filters, page: 1, laneLimits: {} });
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
  bindKanbanControls(container, state, onChange);

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
 * Eventos SSE passam por um agendador (debounce, espera máxima, uma carga por vez).
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
    activeRefresh?.cancel();
    const refresh = createRefreshScheduler({
      load: (signal) => loadCentral(state, client, { signal }),
      apply: (loaded) => {
        state = mergePayload(state, /** @type {object} */ (loaded));
        rebind();
      },
    });
    activeRefresh = refresh;
    subscription = createCentralLiveSubscription({
      slug: state.slug,
      onEvent: () => refresh.request(),
      onStatusChange: (liveStatus) => {
        state = { ...state, liveStatus };
        updateLiveBadge(container, liveStatus);
      },
    });
    subscription.connect();
    activeSubscription = subscription;
  }

  return { state, subscription };
}
