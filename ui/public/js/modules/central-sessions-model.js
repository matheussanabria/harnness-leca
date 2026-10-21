// @ts-check
// Modelo puro da Central de Sessões (EP-09.03).
// Sem DOM, sem rede: só regras de apresentação e cálculo.

/** Raias canônicas do Kanban de workflow. */
export const KANBAN_LANES = [
  { id: "unclassified", label: "Não classificado", workflowStatuses: ["none", "unknown"] },
  { id: "planning", label: "Planejamento", workflowStatuses: ["ready"] },
  { id: "approval", label: "Aguardando aprovação", workflowStatuses: ["blocked"] },
  { id: "approved", label: "Aprovado", workflowStatuses: ["completed"] },
  { id: "implementation", label: "Implementação", workflowStatuses: ["running"] },
  { id: "tests", label: "Testes", workflowStatuses: ["testing"] },
  { id: "blocked", label: "Bloqueado", workflowStatuses: ["stalled"] },
  { id: "done", label: "Concluído", workflowStatuses: ["cancelled", "done"] },
];

/** Rótulo, ícone e padrão visual de cada estado de execução. */
export const EXECUTION_STATUS = {
  idle: { label: "Ocioso", icon: "fa-circle-pause", pattern: "solid" },
  queued: { label: "Na fila", icon: "fa-hourglass-half", pattern: "outline" },
  running: { label: "Executando", icon: "fa-spinner", pattern: "solid" },
  succeeded: { label: "Concluída", icon: "fa-circle-check", pattern: "solid" },
  failed: { label: "Falhou", icon: "fa-circle-xmark", pattern: "solid" },
  cancelled: { label: "Cancelada", icon: "fa-circle-ban", pattern: "outline" },
  unknown: { label: "Sem estado", icon: "fa-circle-question", pattern: "outline" },
};

/** Rótulo e ícone de cada estado de workflow. */
export const WORKFLOW_STATUS = {
  none: { label: "Sem workflow", icon: "fa-minus" },
  ready: { label: "Pronto", icon: "fa-play" },
  running: { label: "Em andamento", icon: "fa-spinner" },
  blocked: { label: "Bloqueado", icon: "fa-lock" },
  completed: { label: "Concluído", icon: "fa-flag-checkered" },
  cancelled: { label: "Cancelado", icon: "fa-ban" },
  unknown: { label: "Desconhecido", icon: "fa-circle-question" },
};

/** Rótulo e ícone do estado de atenção. */
export const ATTENTION_STATUS = {
  none: { label: "Sem atenção", icon: "fa-circle-check" },
  open: { label: "Atenção necessária", icon: "fa-triangle-exclamation" },
  acknowledged: { label: "Reconhecida", icon: "fa-eye" },
  resolved: { label: "Resolvida", icon: "fa-circle-check" },
  unknown: { label: "Desconhecida", icon: "fa-circle-question" },
};

/** Confiança do vínculo com o projeto, em texto (nunca só cor). */
export const CONFIDENCE = {
  explicit: { label: "vínculo explícito", icon: "fa-link" },
  observed: { label: "observado", icon: "fa-eye" },
  inferred: { label: "inferido", icon: "fa-wand-magic-sparkles" },
  unknown: { label: "sem telemetria", icon: "fa-circle-question" },
};

/**
 * @param {object} session
 * @param {{ provider?: string, executionStatus?: string, workflowStatus?: string, attentionStatus?: string,
 *   projectConfidence?: string, q?: string, since?: string, until?: string }} [filters]
 * @returns {boolean}
 */
export function matchesFilters(session, filters = {}) {
  if (!session) return false;
  if (filters.provider && session.primaryProvider !== filters.provider) return false;
  if (filters.executionStatus && session.executionStatus !== filters.executionStatus) return false;
  if (filters.workflowStatus && session.workflowStatus !== filters.workflowStatus) return false;
  if (filters.attentionStatus && session.attentionStatus !== filters.attentionStatus) return false;
  if (filters.projectConfidence && session.projectConfidence !== filters.projectConfidence) return false;
  if (filters.since && String(session.lastObservedAt || "") < String(filters.since)) return false;
  if (filters.until && String(session.lastObservedAt || "") > String(filters.until)) return false;
  if (filters.q) {
    const needle = String(filters.q).trim().toLowerCase();
    const haystack = [session.title, session.id, session.projectId || ""].join(" ").toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

/**
 * @param {object[]} sessions
 * @param {object} [filters]
 * @returns {object[]}
 */
export function filterSessions(sessions, filters = {}) {
  return (sessions || []).filter((session) => matchesFilters(session, filters));
}

/**
 * Ordena por última observação (mais recente primeiro) e, no empate, pelo id.
 * @param {object[]} sessions
 * @returns {object[]}
 */
export function sortSessions(sessions) {
  return [...(sessions || [])].sort((a, b) => {
    const byDate = String(b.lastObservedAt || "").localeCompare(String(a.lastObservedAt || ""));
    return byDate !== 0 ? byDate : String(a.id || "").localeCompare(String(b.id || ""));
  });
}

/**
 * Agrupa as sessões nas raias canônicas do Kanban.
 * @param {object[]} sessions
 * @returns {{ id: string, label: string, sessions: object[] }[]}
 */
export function groupByLane(sessions) {
  const lanes = KANBAN_LANES.map((lane) => ({ ...lane, sessions: [] }));
  const known = new Set(KANBAN_LANES.map((lane) => lane.id));
  const extra = [];
  for (const session of sessions || []) {
    const status = String(session.workflowStatus || "none");
    const lane = lanes.find((item) => item.workflowStatuses.includes(status));
    if (lane) {
      lane.sessions.push(session);
      continue;
    }
    let bucket = extra.find((item) => item.workflowStatus === status);
    if (!bucket) {
      bucket = { id: `extra-${status}`, label: status, workflowStatus: status, sessions: [] };
      extra.push(bucket);
    }
    bucket.sessions.push(session);
  }
  return [...lanes, ...extra].filter((lane) => lane.sessions.length > 0 || known.has(lane.id));
}

/**
 * @param {object[]} sessions
 * @returns {{ total: number, byProvider: Record<string, number>, byExecution: Record<string, number>,
 *   byWorkflow: Record<string, number>, attention: number, inferred: number }}
 */
export function summarize(sessions) {
  const list = sessions || [];
  const byProvider = {};
  const byExecution = {};
  const byWorkflow = {};
  let attention = 0;
  let inferred = 0;
  for (const session of list) {
    byProvider[session.primaryProvider || "desconhecido"] = (byProvider[session.primaryProvider || "desconhecido"] || 0) + 1;
    byExecution[session.executionStatus || "unknown"] = (byExecution[session.executionStatus || "unknown"] || 0) + 1;
    byWorkflow[session.workflowStatus || "none"] = (byWorkflow[session.workflowStatus || "none"] || 0) + 1;
    if (session.attentionStatus === "open") attention += 1;
    if (session.projectConfidence === "inferred") inferred += 1;
  }
  return { total: list.length, byProvider, byExecution, byWorkflow, attention, inferred };
}

/**
 * @param {object} session
 * @returns {{ execution: object, workflow: object, attention: object, confidence: object }}
 */
export function describeSession(session) {
  const item = session || {};
  return {
    execution: EXECUTION_STATUS[item.executionStatus] || EXECUTION_STATUS.unknown,
    workflow: WORKFLOW_STATUS[item.workflowStatus] || WORKFLOW_STATUS.unknown,
    attention: ATTENTION_STATUS[item.attentionStatus] || ATTENTION_STATUS.unknown,
    confidence: CONFIDENCE[item.projectConfidence] || CONFIDENCE.unknown,
  };
}

/**
 * @param {string} value
 * @returns {string}
 */
export function formatTimestamp(value) {
  const text = String(value || "");
  if (!text) return "sem data";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
