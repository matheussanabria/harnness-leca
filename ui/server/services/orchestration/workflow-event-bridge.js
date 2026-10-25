// @ts-check
// Ponte T2.1: espelha cada evento de workflow (EP-08.04) no event log EP-09 via ingestEvent.
// Falha de persistencia nunca quebra o workflow: captura, conta, loga uma vez e segue.
//
// Mapeamento (ADR-TEL-003, plano secao 3):
//   timestamp -> at | correlationId -> traceId | parentExecutionId -> parentRunId
//   executionId -> runId e workflowRunId (e executionId) | taskId, agentId como estao
//   taskId "stage:<id>" -> stepRunId "<executionId>:stage:<id>" (ids de etapa repetem entre runs)
//   source.confidence -> relation: explicit->declared, observed->native, inferred->inferred,
//   unknown->unknown (o runner emite "explicit": a ligacao e definida pelo proprio harness).
const { ingestEvent } = require("../events/event-ingest");

const CONFIDENCE_TO_RELATION = Object.freeze({
  explicit: "declared",
  observed: "native",
  inferred: "inferred",
  unknown: "unknown",
});

// Tipos que ocorrem no maximo uma vez por execucao/etapa: a chave nao leva o timestamp,
// entao um replay com outro relogio continua sendo no-op. Os demais (task.started,
// task.progressed, task.blocked) podem repetir legitimamente e levam o timestamp.
const ONCE_TYPES = new Set([
  "execution.started", "execution.completed", "execution.failed", "execution.cancelled",
  "execution.approval_requested", "execution.approved", "execution.rejected",
  "task.created", "task.completed", "task.failed",
]);

const SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

const stats = { persisted: 0, duplicated: 0, skipped: 0, failed: 0 };
let warned = false;

/** @param {unknown} confidence */
function relationFor(confidence) {
  return CONFIDENCE_TO_RELATION[/** @type {keyof typeof CONFIDENCE_TO_RELATION} */ (String(confidence))] || "unknown";
}

/**
 * Regra: executionId|type|taskId[|attemptId][|timestamp]. Retry da mesma emissao (mesmo evento)
 * gera a mesma chave; transicoes distintas diferem por tipo, etapa ou (se repetiveis) timestamp.
 * T4.1c: quando o payload traz attemptId ele entra na chave, pois com retries duas tentativas
 * de uma mesma execucao/etapa podem emitir tipos que antes eram unicos (task.failed etc.);
 * fluxos antigos sem attemptId continuam com a chave de antes.
 * @param {any} event
 */
function idempotencyKeyFor(event) {
  const parts = ["wf", event.executionId || "-", event.type, event.taskId || "-"];
  const attemptId = event.payload?.attemptId;
  if (typeof attemptId === "string" && attemptId) parts.push(attemptId);
  if (!ONCE_TYPES.has(event.type)) parts.push(event.timestamp);
  return parts.join("|");
}

/**
 * EP-09 keeps no free text: copies the payload without error/note and records only
 * the error length. The copy is required because the in-memory engine keeps the original.
 * @param {any} payload
 */
function textFreePayload(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const copy = { ...payload };
  const errorText = typeof copy.error === "string" ? copy.error : "";
  delete copy.error;
  delete copy.note;
  if (errorText) copy.errorLength = errorText.length;
  return copy;
}

/**
 * Converte o evento canonico EP-08.04 no corpo aceito por ingestEvent.
 * @param {any} event
 */
function toIngestBody(event) {
  const executionId = event.executionId || null;
  const taskId = event.taskId || null;
  const stage = typeof taskId === "string" && taskId.startsWith("stage:") ? taskId : null;
  return {
    id: event.id,
    type: event.type,
    at: event.timestamp,
    source: { provider: event.source.provider, kind: event.source.kind },
    projectId: event.projectId,
    executionId,
    runId: executionId,
    workflowRunId: executionId,
    parentRunId: event.parentExecutionId || null,
    traceId: event.correlationId || null,
    taskId,
    agentId: event.agentId || null,
    // T4.1c: payload.attemptId sobe para a coluna attempt_id do envelope.
    attemptId: event.payload?.attemptId || null,
    stepRunId: stage && executionId ? `${executionId}:${stage}` : null,
    relation: relationFor(event.source.confidence),
    idempotencyKey: idempotencyKeyFor(event),
    payload: textFreePayload(event.payload),
  };
}

/**
 * Persiste o evento no store EP-09. Nunca lanca.
 * @param {any} event evento ja criado por createEvent
 * @returns {boolean} true se gravou ou ja existia
 */
function bridgeWorkflowEvent(event) {
  try {
    const slug = String(event?.projectId || "");
    if (!SLUG_PATTERN.test(slug)) {
      stats.skipped += 1;
      return false;
    }
    const result = ingestEvent(slug, toIngestBody(event));
    if (result.duplicated) stats.duplicated += 1;
    else stats.persisted += 1;
    return true;
  } catch (error) {
    stats.failed += 1;
    if (!warned) {
      warned = true;
      const code = /** @type {any} */ (error)?.code || /** @type {any} */ (error)?.name || "Error";
      console.warn(`[workflow-event-bridge] persist failed (${code}); further failures are only counted.`);
    }
    return false;
  }
}

function getBridgeStats() {
  return { ...stats };
}

function resetBridgeStats() {
  Object.assign(stats, { persisted: 0, duplicated: 0, skipped: 0, failed: 0 });
  warned = false;
}

module.exports = { bridgeWorkflowEvent, toIngestBody, relationFor, idempotencyKeyFor, getBridgeStats, resetBridgeStats };
