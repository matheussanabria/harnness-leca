// @ts-check
// Regras puras do estado da tela de diário (EP-14.10): filtros, página e
// ordenação deixam de viver na query string e passam a compor o estado da tela.

export const DIARIO_SORT_FIELDS = Object.freeze(["day", "sessions", "prompts"]);
export const DIARIO_PAGE_SIZES = Object.freeze([10, 25, 50]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value, limit) {
  return typeof value === "string" ? value.slice(0, limit) : "";
}

/** @param {unknown} raw */
export function normalizeDiarioState(raw) {
  const value = isRecord(raw) ? raw : {};
  const page = Math.max(1, Math.floor(Number(value.page)) || 1);
  const size = Number(value.pageSize);
  return {
    project: text(value.project, 120),
    query: text(value.query, 200),
    agentFilter: text(value.agentFilter, 32),
    dateFrom: text(value.dateFrom, 10),
    dateTo: text(value.dateTo, 10),
    sortField: DIARIO_SORT_FIELDS.includes(value.sortField) ? value.sortField : "day",
    sortAsc: typeof value.sortAsc === "boolean" ? value.sortAsc : false,
    page,
    pageSize: DIARIO_PAGE_SIZES.includes(size) ? size : 10,
    allClosed: value.allClosed === true,
  };
}

/** @param {ReturnType<typeof normalizeDiarioState>} state */
export function diarioStatePatch(state) {
  return {
    project: state.project,
    query: state.query,
    agentFilter: state.agentFilter,
    dateFrom: state.dateFrom,
    dateTo: state.dateTo,
    sortField: state.sortField,
    sortAsc: state.sortAsc,
    page: state.page,
    pageSize: state.pageSize,
    allClosed: state.allClosed,
  };
}

/**
 * Filtra os dias do diário preservando somente as sessões que casam com o
 * agente, o período e o texto pesquisado.
 * @param {Array<any>} days
 * @param {ReturnType<typeof normalizeDiarioState>} state
 * @param {(session: any) => string} sessionText
 */
export function filterDiarioDays(days, state, sessionText) {
  const query = state.query.trim().toLowerCase();
  const result = [];
  for (const day of days) {
    if (state.dateFrom && day.day < state.dateFrom) continue;
    if (state.dateTo && day.day > state.dateTo) continue;
    const sessions = (day.sessions || []).filter((session) => {
      if (state.agentFilter && session.agente !== state.agentFilter) return false;
      if (!query) return true;
      return sessionText(session).toLowerCase().includes(query);
    });
    if (sessions.length) result.push({ ...day, sessions });
  }
  return result;
}

/**
 * Ordena e pagina os dias filtrados.
 * @param {Array<any>} days
 * @param {ReturnType<typeof normalizeDiarioState>} state
 */
export function paginateDiarioDays(days, state) {
  const direction = state.sortAsc ? 1 : -1;
  const sorted = [...days].sort((left, right) => {
    const a = state.sortField === "sessions" ? left.sessions.length : left.day;
    const b = state.sortField === "sessions" ? right.sessions.length : right.day;
    if (typeof a === "number" && typeof b === "number") return (a - b) * direction;
    return String(a).localeCompare(String(b), "pt-BR") * direction;
  });
  const start = (state.page - 1) * state.pageSize;
  return {
    days: sorted.slice(start, start + state.pageSize),
    total: sorted.length,
    pages: Math.max(1, Math.ceil(sorted.length / state.pageSize)),
  };
}
