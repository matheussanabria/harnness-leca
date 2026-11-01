// @ts-check
// Serviço da Fila de Atenção Unificada (EP-09.05).
// Agrega itens de atenção da projeção da 09.02 e aprovações pendentes da 08.05.
// Ordenação canônica: severidade (high > medium > low), prazo mais próximo, depois mais antigo.

const { projectAttention } = require("./events/event-projector");
const { listPendingApprovals } = require("./orchestration/workflow-approval.service");
const { ingestEvent } = require("./events/event-ingest");

const SEVERITY_WEIGHT = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Normaliza severidade para high, medium ou low.
 * @param {string} [val]
 * @returns {"high" | "medium" | "low"}
 */
function normalizeSeverity(val) {
  const s = String(val || "").toLowerCase();
  if (s === "high" || s === "alta" || s === "critica") return "high";
  if (s === "low" || s === "baixa") return "low";
  return "medium";
}

/**
 * Compara dois itens para ordenação: severidade desc, deadline asc, openedAt asc.
 * @param {any} a
 * @param {any} b
 * @returns {number}
 */
function compareAttentionItems(a, b) {
  const wA = SEVERITY_WEIGHT[a.severity] || 2;
  const wB = SEVERITY_WEIGHT[b.severity] || 2;
  if (wA !== wB) return wB - wA; // severidade maior primeiro

  if (a.deadline && b.deadline) {
    const diff = Date.parse(a.deadline) - Date.parse(b.deadline);
    if (diff !== 0) return diff;
  } else if (a.deadline) {
    return -1; // tem prazo prioriza
  } else if (b.deadline) {
    return 1;
  }

  return Date.parse(a.openedAt || 0) - Date.parse(b.openedAt || 0);
}

/**
 * Consulta a fila unificada de atenção por projeto.
 * @param {string} slug
 * @param {{ includeResolved?: boolean }} [options]
 * @returns {{ items: object[], totals: { high: number, medium: number, low: number, open: number, acknowledged: number } }}
 */
function getUnifiedAttentionQueue(slug, options = {}) {
  const attentionProj = projectAttention(slug);
  const eventsItems = attentionProj.items || [];

  // Mapeia itens da projeção de atenção
  const normalizedEvents = eventsItems.map((item) => ({
    id: item.id,
    type: "attention",
    title: item.title || `Atenção: ${item.id}`,
    origin: item.origin || (item.sessionId ? "session" : item.executionId ? "execution" : "general"),
    severity: normalizeSeverity(item.severity),
    state: item.state || "open", // open, acknowledged, resolved
    sessionId: item.sessionId || null,
    executionId: item.executionId || null,
    openedAt: item.openedAt,
    deadline: item.deadline || null,
    history: item.history || [],
  }));

  // Mapeia aprovações pendentes de workflow/rotinas da 08.05
  let approvals = [];
  try {
    approvals = listPendingApprovals(slug) || [];
  } catch {}

  const normalizedApprovals = approvals.map((app) => ({
    id: `approval_${app.executionId}_${app.stageId}`,
    type: "approval",
    title: `Aprovação: Etapa '${app.stageLabel || app.stageId}'`,
    origin: "approval",
    severity: "high", // Aprovações bloqueantes sempre são de alta severidade
    state: "open",
    sessionId: null,
    executionId: app.executionId,
    stageId: app.stageId,
    workflowId: app.workflowId,
    routineId: app.routineId,
    actor: app.actor,
    openedAt: app.updatedAt || app.startedAt || new Date().toISOString(),
    deadline: null,
    history: [],
  }));

  const combined = [...normalizedEvents, ...normalizedApprovals];
  const filtered = options.includeResolved ? combined : combined.filter((it) => it.state !== "resolved");
  filtered.sort(compareAttentionItems);

  const totals = { high: 0, medium: 0, low: 0, open: 0, acknowledged: 0 };
  for (const it of filtered) {
    if (it.severity === "high") totals.high++;
    else if (it.severity === "medium") totals.medium++;
    else if (it.severity === "low") totals.low++;
    if (it.state === "open") totals.open++;
    else if (it.state === "acknowledged") totals.acknowledged++;
  }

  return { items: filtered, totals };
}

/**
 * Reconhece um item de atenção sem resolver (RF5).
 * @param {string} slug
 * @param {string} id
 * @param {{ actor?: string }} [meta]
 */
function acknowledgeAttentionItem(slug, id, meta = {}) {
  const event = {
    id: `ack_${id}_${Date.now()}`,
    type: "attention.acknowledged",
    at: new Date().toISOString(),
    source: { provider: "central", kind: "orchestration" },
    trust: "harness_owned",
    projectId: slug,
    payload: { id, actor: meta.actor || "user" },
  };
  return ingestEvent(slug, event);
}

/**
 * Resolve explicitamente um item de atenção com nota (RF4, RF8).
 * @param {string} slug
 * @param {string} id
 * @param {{ actor?: string, note?: string }} [meta]
 */
function resolveAttentionItem(slug, id, meta = {}) {
  const event = {
    id: `res_${id}_${Date.now()}`,
    type: "attention.resolved",
    at: new Date().toISOString(),
    source: { provider: "central", kind: "orchestration" },
    trust: "harness_owned",
    projectId: slug,
    payload: {
      id,
      actor: meta.actor || "user",
      note: meta.note || "",
      resolvedAt: new Date().toISOString(),
    },
  };
  return ingestEvent(slug, event);
}

module.exports = {
  normalizeSeverity,
  compareAttentionItems,
  getUnifiedAttentionQueue,
  acknowledgeAttentionItem,
  resolveAttentionItem,
};
