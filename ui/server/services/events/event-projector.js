// @ts-check
// Projeções do event log (EP-09.02).
//
// Uma projeção é uma visão derivada do log: ela nunca é a fonte de verdade e pode ser
// reconstruída inteira a partir dos eventos. Aqui existem três: sessões, workflow e atenção.
const { readEvents } = require("./event-store");

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
 */

/**
 * Aplica um evento a uma visão de sessão.
 * @param {SessionView} view
 * @param {any} event
 */
function applyToSession(view, event) {
  const type = String(event.type || "");
  const payload = event.payload || {};

  if (type === "session.discovered") {
    view.provider = payload.provider || view.provider;
    view.projectId = String(event.projectId || view.projectId || "");
  }
  if (type.startsWith("execution.")) {
    view.executionStatus = type === "execution.succeeded" ? "succeeded" : type === "execution.failed" ? "failed" : type === "execution.cancelled" ? "cancelled" : type === "execution.started" ? "running" : view.executionStatus;
  }
  if (type === "workflow.transitioned") {
    view.workflowStatus = String(payload.status || view.workflowStatus || "");
  }
  if (type === "workflow.blocked") {
    view.workflowStatus = "blocked";
  }
  if (type === "workflow.unblocked") {
    view.workflowStatus = "running";
  }
  if (type === "attention.opened") {
    view.attentionStatus = "open";
  }
  if (type === "attention.acknowledged") {
    view.attentionStatus = "acknowledged";
  }
  if (type === "attention.resolved") {
    view.attentionStatus = "resolved";
  }
  if (type === "session.updated" && payload.title) {
    view.provider = payload.provider || view.provider;
  }
  view.lastEventAt = String(event.at || view.lastEventAt);
}

/**
 * Reconstrói a projeção de sessões a partir do log.
 * @param {string} slug
 * @param {{ limit?: number, cursor?: string }} [options]
 * @returns {{ sessions: SessionView[], cursor: string }}
 */
function projectSessions(slug, options = {}) {
  const { events, cursor } = readEvents(slug, { limit: options.limit || 5000, cursor: options.cursor });
  /** @type {Map<string, SessionView>} */
  const views = new Map();
  for (const event of events) {
    const id = String(event.sessionId || "");
    if (!id) continue;
    let view = views.get(id);
    if (!view) {
      view = {
        sessionId: id,
        projectId: String(event.projectId || slug),
        provider: null,
        executionStatus: null,
        workflowStatus: null,
        attentionStatus: null,
        lastEventAt: String(event.at || ""),
        cursor: "",
      };
      views.set(id, view);
    }
    applyToSession(view, event);
    view.cursor = cursor;
  }
  return { sessions: [...views.values()], cursor };
}

/**
 * Reconstrói a projeção de workflow (execuções com estado e etapa corrente).
 * @param {string} slug
 * @param {{ limit?: number }} [options]
 * @returns {{ executions: object[], cursor: string }}
 */
function projectWorkflows(slug, options = {}) {
  const { events, cursor } = readEvents(slug, { limit: options.limit || 5000 });
  /** @type {Map<string, any>} */
  const executions = new Map();
  for (const event of events) {
    const id = String(event.executionId || "");
    if (!id) continue;
    let view = executions.get(id);
    if (!view) {
      view = {
        executionId: id,
        workflowId: String(event.payload?.workflowId || ""),
        status: "unknown",
        stageId: "",
        approvals: [],
        lastEventAt: String(event.at || ""),
      };
      executions.set(id, view);
    }
    const type = String(event.type || "");
    if (type.startsWith("execution.")) {
      view.status = type === "execution.succeeded" ? "succeeded" : type === "execution.failed" ? "failed" : type === "execution.cancelled" ? "cancelled" : type === "execution.started" ? "running" : view.status;
    }
    if (type === "workflow.transitioned") {
      view.stageId = String(event.payload?.stageId || view.stageId);
      view.status = String(event.payload?.status || view.status);
    }
    if (type === "approval.requested" || type === "approval.resolved") {
      view.approvals.push({ stageId: String(event.payload?.stageId || ""), type, at: String(event.at) });
    }
    view.lastEventAt = String(event.at || view.lastEventAt);
  }
  return { executions: [...executions.values()], cursor };
}

/**
 * Reconstrói a projeção de atenção (itens que exigem intervenção).
 * @param {string} slug
 * @param {{ limit?: number }} [options]
 * @returns {{ items: object[], cursor: string }}
 */
function projectAttention(slug, options = {}) {
  const { events, cursor } = readEvents(slug, { limit: options.limit || 5000 });
  /** @type {Map<string, any>} */
  const items = new Map();
  for (const event of events) {
    const type = String(event.type || "");
    if (!type.startsWith("attention.")) continue;
    const key = String(event.payload?.id || event.sessionId || event.executionId || event.id);
    const item = items.get(key) || {
      id: key,
      sessionId: event.sessionId || null,
      executionId: event.executionId || null,
      severity: String(event.payload?.severity || "medium"),
      state: "open",
      openedAt: String(event.at || ""),
      resolvedAt: null,
    };
    if (type === "attention.opened") item.state = "open";
    if (type === "attention.acknowledged") item.state = "acknowledged";
    if (type === "attention.resolved") {
      item.state = "resolved";
      item.resolvedAt = String(event.at || "");
    }
    items.set(key, item);
  }
  return { items: [...items.values()].filter((item) => item.state !== "resolved"), cursor };
}

module.exports = { applyToSession, projectSessions, projectWorkflows, projectAttention };
