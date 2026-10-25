// @ts-check
// Projeções do event log (EP-09.02, ADR-TEL-005).
//
// Uma projeção é uma visão derivada do log: ela nunca é a fonte de verdade e pode ser
// reconstruída inteira a partir dos eventos. Aqui existem três: sessões, workflow e atenção.
//
// Janela: o log inteiro e lido em paginas de PAGE_SIZE eventos e dobrado de forma incremental
// (event-order.js): a memoria e limitada pelo numero de entidades (sessoes, execucoes, itens de
// atencao) mais uma pagina, nunca pelo numero de eventos. Nao ha corte silencioso; `options.limit`
// e um teto explicito e opcional de eventos dobrados.
const { readEvents } = require("./event-store");
const order = require("./event-order");

const PAGE_SIZE = 1000;
const USAGE_TYPE = "usage.observed";

/**
 * @typedef {Object} SessionView
 * @property {string} sessionId
 * @property {string} projectId
 * @property {string | null} provider
 * @property {string | null} executionStatus
 * @property {string | null} workflowStatus
 * @property {string | null} attentionStatus
 * @property {string} lastEventAt
 * @property {string} cursor
 * @property {string | null} origin "harness_chat" | "external" | null (T2.4, aditivo)
 * @property {string | null} activity "processing" | "idle" | "unknown" | null
 * @property {string | null} presence "connected" | "no_recent_signal" | "unknown" | null
 * @property {string | null} lastActivityAt
 * @property {string | null} lastSeenAt
 * @property {string | null} nativeSessionId id nativo (deduplica sessao externa x chat do Harness)
 */

const ACTIVITIES = new Set(["processing", "idle", "unknown"]);
const PRESENCES = new Set(["connected", "no_recent_signal", "unknown"]);
const ORIGINS = new Set(["harness_chat", "external"]);
const PRESENCE_FIELDS = ["origin", "activity", "presence", "lastActivityAt", "lastSeenAt", "nativeSessionId"];

/**
 * Percorre o log em paginas, em ordem de cursor, chamando `visit(event, cursor)`.
 * @param {string} slug
 * @param {(event: any, cursor: string) => void} visit
 * @param {{ limit?: number, cursor?: string }} [options]
 * @returns {string} cursor final lido
 */
function scanLog(slug, visit, options = {}) {
  let cursor = String(options.cursor || "0");
  let remaining = options.limit && options.limit > 0 ? options.limit : Number.POSITIVE_INFINITY;
  while (remaining > 0) {
    const size = Math.min(PAGE_SIZE, remaining);
    const batch = readEvents(slug, { cursor, limit: size });
    for (let i = 0; i < batch.events.length; i += 1) visit(batch.events[i], batch.cursors[i]);
    remaining -= batch.events.length;
    cursor = batch.cursor;
    if (batch.events.length < size) break;
  }
  return cursor;
}

/**
 * Estado interno por sessao: um carimbo por dimensao (execucao, workflow, atencao, provider).
 * @returns {{ exec: { value: string | null, stamp: order.Stamp, execId: string }, workflow: any, attention: any, provider: any }}
 */
function newSessionSlots() {
  return {
    exec: { value: null, stamp: order.EPOCH, execId: "" },
    workflow: order.newSlot(),
    attention: order.newSlot(),
    provider: order.newSlot(),
    ...Object.fromEntries(PRESENCE_FIELDS.map((name) => [name, order.newSlot()])),
  };
}

/** Texto de data valido (ISO) ou null. */
const dateText = (value) => (typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null);

/**
 * Presenca/atividade/origem (T2.4): campos independentes, cada um com seu carimbo (ADR-TEL-005).
 * Nunca toca executionStatus: sessao externa nao inventa execucao.
 */
function applyPresence(view, event, payload, stamp, slots) {
  const incoming = {
    origin: ORIGINS.has(payload.origin) ? payload.origin
      : event.type === "session.discovered" && payload.kind === "chat" ? "harness_chat" : null,
    activity: ACTIVITIES.has(payload.activity) ? payload.activity : null,
    presence: PRESENCES.has(payload.presence) ? payload.presence : null,
    lastActivityAt: dateText(payload.lastActivityAt),
    lastSeenAt: dateText(payload.lastSeenAt),
    nativeSessionId: event.nativeSessionId ? String(event.nativeSessionId) : null,
  };
  for (const name of PRESENCE_FIELDS) {
    if (incoming[name] !== null && order.setByStamp(slots[name], incoming[name], stamp)) view[name] = incoming[name];
  }
}

/**
 * Aplica um evento a uma visão de sessão, respeitando ordem por `at` e precedência terminal.
 * @param {SessionView} view
 * @param {any} event
 * @param {string | number} [cursor] seq do evento (desempate); sem ele vale 0
 * @param {ReturnType<typeof newSessionSlots>} [slots] estado interno; omitido = estado novo
 */
function applyToSession(view, event, cursor = 0, slots = newSessionSlots()) {
  const type = String(event.type || "");
  const payload = event.payload || {};
  const stamp = order.stampOf(event, cursor);

  if (type === "session.discovered" || type === "session.updated") applyPresence(view, event, payload, stamp, slots);
  if (type === "session.discovered") {
    if (payload.provider && order.setByStamp(slots.provider, String(payload.provider), stamp)) view.provider = String(payload.provider);
    view.projectId = String(event.projectId || view.projectId || "");
  }
  const execStatus = order.executionStatusOf(type);
  if (execStatus) {
    const execId = String(event.executionId || "");
    if (execId !== slots.exec.execId && slots.exec.value !== null) {
      // Outra execucao da mesma sessao: so assume se for estritamente mais recente.
      if (order.compareStamps(stamp, slots.exec.stamp) > 0) slots.exec = { value: null, stamp: order.EPOCH, execId };
    } else if (slots.exec.value === null) {
      slots.exec.execId = execId;
    }
    if (execId === slots.exec.execId && order.setExecutionStatus(slots.exec, execStatus, stamp)) view.executionStatus = slots.exec.value;
  }
  const workflowStatus = type === "workflow.transitioned" ? String(payload.status || "")
    : type === "workflow.blocked" ? "blocked"
      : type === "workflow.unblocked" ? "running" : "";
  if (workflowStatus && order.setByStamp(slots.workflow, workflowStatus, stamp)) view.workflowStatus = workflowStatus;

  const attentionStatus = type === "attention.opened" ? "open"
    : type === "attention.acknowledged" ? "acknowledged"
      : type === "attention.resolved" ? "resolved" : "";
  if (attentionStatus && order.setByStamp(slots.attention, attentionStatus, stamp)) view.attentionStatus = attentionStatus;

  if (type === "session.updated" && (payload.title || payload.origin) && payload.provider && order.setByStamp(slots.provider, String(payload.provider), stamp)) {
    view.provider = String(payload.provider);
  }
  view.lastEventAt = order.maxAt(view.lastEventAt, String(event.at || ""));
}

/**
 * Reconstrói a projeção de sessões a partir do log.
 * @param {string} slug
 * @param {{ limit?: number, cursor?: string }} [options]
 * @returns {{ sessions: SessionView[], cursor: string }}
 */
function projectSessions(slug, options = {}) {
  /** @type {Map<string, { view: SessionView, slots: ReturnType<typeof newSessionSlots> }>} */
  const states = new Map();
  const cursor = scanLog(slug, (event, eventCursor) => {
    const id = String(event.sessionId || "");
    if (!id) return;
    // Usage telemetry is queryable in the log but never a session: it would create provider-less phantom rows (T2.5).
    if (event.type === USAGE_TYPE) return;
    let state = states.get(id);
    if (!state) {
      state = {
        view: {
          sessionId: id,
          projectId: String(event.projectId || slug),
          provider: null,
          executionStatus: null,
          workflowStatus: null,
          attentionStatus: null,
          lastEventAt: "",
          cursor: "",
          origin: null,
          activity: null,
          presence: null,
          lastActivityAt: null,
          lastSeenAt: null,
          nativeSessionId: null,
        },
        slots: newSessionSlots(),
      };
      states.set(id, state);
    }
    applyToSession(state.view, event, eventCursor, state.slots);
    state.view.cursor = eventCursor;
  }, options);
  return { sessions: [...states.values()].map((state) => state.view), cursor };
}

/**
 * Reconstrói a projeção de workflow (execuções com estado e etapa corrente).
 * @param {string} slug
 * @param {{ limit?: number }} [options]
 * @returns {{ executions: object[], cursor: string }}
 */
function projectWorkflows(slug, options = {}) {
  /** @type {Map<string, { view: any, status: any, stage: any }>} */
  const states = new Map();
  const cursor = scanLog(slug, (event, eventCursor) => {
    const id = String(event.executionId || "");
    if (!id) return;
    let state = states.get(id);
    if (!state) {
      state = {
        view: { executionId: id, workflowId: String(event.payload?.workflowId || ""), status: "unknown", stageId: "", approvals: [], lastEventAt: "" },
        status: order.newSlot("unknown"),
        stage: order.newSlot(),
      };
      states.set(id, state);
    }
    const { view } = state;
    const type = String(event.type || "");
    const stamp = order.stampOf(event, eventCursor);
    const execStatus = order.executionStatusOf(type);
    if (execStatus && order.setExecutionStatus(state.status, execStatus, stamp)) view.status = state.status.value;
    if (type === "workflow.transitioned") {
      const next = String(event.payload?.status || "");
      if (next && order.setExecutionStatus(state.status, next, stamp)) view.status = next;
      const stageId = String(event.payload?.stageId || "");
      if (stageId && order.setByStamp(state.stage, stageId, stamp)) view.stageId = stageId;
    }
    if (type === "approval.requested" || type === "approval.resolved") {
      view.approvals.push({ stageId: String(event.payload?.stageId || ""), type, at: String(event.at) });
    }
    if (!view.workflowId && event.payload?.workflowId) view.workflowId = String(event.payload.workflowId);
    view.lastEventAt = order.maxAt(view.lastEventAt, String(event.at || ""));
  }, options);
  const executions = [...states.values()].map((state) => {
    state.view.approvals.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || 0);
    return state.view;
  });
  return { executions, cursor };
}

/**
 * Reconstrói a projeção de atenção (itens que exigem intervenção).
 * @param {string} slug
 * @param {{ limit?: number }} [options]
 * @returns {{ items: object[], cursor: string }}
 */
function projectAttention(slug, options = {}) {
  /** @type {Map<string, { item: any, state: any, resolvedStamp: any }>} */
  const states = new Map();
  const cursor = scanLog(slug, (event, eventCursor) => {
    const type = String(event.type || "");
    if (!type.startsWith("attention.")) return;
    const key = String(event.payload?.id || event.sessionId || event.executionId || event.id);
    let entry = states.get(key);
    if (!entry) {
      entry = {
        item: {
          id: key,
          sessionId: event.sessionId || null,
          executionId: event.executionId || null,
          severity: String(event.payload?.severity || "medium"),
          state: "open",
          openedAt: String(event.at || ""),
          resolvedAt: null,
        },
        state: order.newSlot("open"),
        resolvedStamp: null,
      };
      states.set(key, entry);
    }
    const stamp = order.stampOf(event, eventCursor);
    const next = type === "attention.opened" ? "open" : type === "attention.acknowledged" ? "acknowledged" : type === "attention.resolved" ? "resolved" : "";
    if (next && order.setByStamp(entry.state, next, stamp)) {
      entry.item.state = next;
      entry.item.resolvedAt = next === "resolved" ? String(event.at || "") : null;
    }
    if (type === "attention.opened" && event.payload?.severity) entry.item.severity = String(event.payload.severity);
    if (type === "attention.opened" && Date.parse(String(event.at)) < Date.parse(entry.item.openedAt)) entry.item.openedAt = String(event.at);
  }, options);
  const items = [...states.values()].map((entry) => entry.item).filter((item) => item.state !== "resolved");
  return { items, cursor };
}

module.exports = { PAGE_SIZE, scanLog, applyToSession, projectSessions, projectWorkflows, projectAttention };
