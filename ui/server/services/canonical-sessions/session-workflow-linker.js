// @ts-check
// Projeção do estado de workflow sobre as sessões canônicas (EP-09.01).
// A 08.05 permanece dona do estado de workflow: aqui só se lê o histórico persistido.

const { readWorkflowHistory } = require("../orchestration/workflow-history.service");

/**
 * @param {string} status
 * @returns {string}
 */
function toWorkflowStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (["running", "in_progress", "active"].includes(value)) return "running";
  if (["blocked", "waiting_approval", "approval_requested"].includes(value)) return "blocked";
  if (["completed", "succeeded", "ok", "approved"].includes(value)) return "completed";
  if (["cancelled", "rejected", "failed"].includes(value)) return "cancelled";
  if (["ready", "queued", "pending"].includes(value)) return "ready";
  return "unknown";
}

/**
 * @param {string} status
 * @returns {string}
 */
function toAttentionStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (["blocked", "waiting_approval", "approval_requested", "failed"].includes(value)) return "open";
  if (["approved", "completed", "succeeded"].includes(value)) return "resolved";
  if (["acknowledged"].includes(value)) return "acknowledged";
  return "none";
}

/**
 * Lê o histórico de workflow da 08.05 e projeta os estados nas sessões que têm vínculo.
 * @param {string} projectDir
 * @param {object[]} sessions
 * @returns {{ sessions: object[], attached: number, unattached: number, warnings: string[] }}
 */
function linkWorkflowStates(projectDir, sessions) {
  const { entries, warnings } = readWorkflowHistory(projectDir, { limit: 200 });
  const byExecution = new Map();
  for (const entry of entries) {
    const executionId = String(entry.executionId || "").trim();
    if (!executionId) continue;
    byExecution.set(executionId, entry);
  }

  let attached = 0;
  let unattached = 0;
  const projected = sessions.map((session) => {
    const executionId = String(session.executionId || session.id || "").trim();
    const entry = byExecution.get(executionId);
    if (!entry) {
      if (byExecution.size) unattached += 1;
      return session;
    }
    attached += 1;
    return {
      ...session,
      workflowStatus: toWorkflowStatus(entry.status),
      attentionStatus: toAttentionStatus(entry.status),
      lastObservedAt: entry.at || session.lastObservedAt,
    };
  });

  return { sessions: projected, attached, unattached, warnings: warnings || [] };
}

module.exports = { toWorkflowStatus, toAttentionStatus, linkWorkflowStates };
