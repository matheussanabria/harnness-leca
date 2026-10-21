// @ts-check
// Contrato Canônico de Eventos do Centro de Orquestração M2 (Harness Leca)
const crypto = require("node:crypto");

/**
 * @typedef {'explicit' | 'observed' | 'inferred' | 'unknown'} EventConfidence
 * @typedef {'native' | 'legacy_adapter' | 'process_manager' | 'routine_runner'} EventSourceKind
 *
 * @typedef {Object} EventSource
 * @property {EventSourceKind} kind
 * @property {string} provider
 * @property {string} [sourceEventId]
 * @property {EventConfidence} confidence
 *
 * @typedef {Object} HarnessEvent
 * @property {string} id
 * @property {string} type
 * @property {number} schemaVersion
 * @property {string} timestamp
 * @property {string} receivedAt
 * @property {EventSource} source
 * @property {string} [projectId]
 * @property {string} [executionId]
 * @property {string} [taskId]
 * @property {string} [agentId]
 * @property {string} [parentExecutionId]
 * @property {string} [correlationId]
 * @property {string} [causationId]
 * @property {Record<string, any>} payload
 */

const VALID_CONFIDENCES = new Set(["explicit", "observed", "inferred", "unknown"]);
const VALID_SOURCE_KINDS = new Set(["native", "legacy_adapter", "process_manager", "routine_runner"]);

const EVENT_CATALOG = new Set([
  // Execuções
  "execution.started",
  "execution.progressed",
  "execution.completed",
  "execution.failed",
  "execution.cancelled",
  // Aprovação de etapa sensível (EP-08.05)
  "execution.approval_requested",
  "execution.approved",
  "execution.rejected",
  // Agentes
  "agent.detected",
  "agent.status_changed",
  // Tarefas e Workflows
  "task.created",
  "task.started",
  "task.progressed",
  "task.completed",
  "task.failed",
  "task.blocked",
  // Ferramentas e Skills
  "tool.invoked",
  "tool.completed",
  "tool.failed",
  // Integrações e Conexões
  "integration.status_changed",
  "artifact.created"
]);

/**
 * Valida se um objeto obedece rigorosamente ao contrato canônico
 * @param {any} event
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateEvent(event) {
  const errors = [];
  if (!event || typeof event !== "object") {
    return { valid: false, errors: ["Evento deve ser um objeto"] };
  }

  if (typeof event.id !== "string" || !event.id.trim()) {
    errors.push("Campo 'id' é obrigatório e deve ser uma string não vazia");
  }

  if (typeof event.type !== "string" || !EVENT_CATALOG.has(event.type)) {
    errors.push(`Campo 'type' inválido ou não catalogado: '${event.type}'`);
  }

  if (typeof event.schemaVersion !== "number" || event.schemaVersion < 1) {
    errors.push("Campo 'schemaVersion' deve ser um número >= 1");
  }

  if (typeof event.timestamp !== "string" || !isValidDate(event.timestamp)) {
    errors.push("Campo 'timestamp' deve ser uma string de data ISO válida");
  }

  if (typeof event.receivedAt !== "string" || !isValidDate(event.receivedAt)) {
    errors.push("Campo 'receivedAt' deve ser uma string de data ISO válida");
  }

  if (!event.source || typeof event.source !== "object") {
    errors.push("Campo 'source' é obrigatório");
  } else {
    if (!VALID_SOURCE_KINDS.has(event.source.kind)) {
      errors.push(`Campo 'source.kind' inválido: '${event.source.kind}'`);
    }
    if (typeof event.source.provider !== "string" || !event.source.provider.trim()) {
      errors.push("Campo 'source.provider' é obrigatório");
    }
    if (!VALID_CONFIDENCES.has(event.source.confidence)) {
      errors.push(`Campo 'source.confidence' inválido: '${event.source.confidence}'`);
    }
  }

  if (!event.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) {
    errors.push("Campo 'payload' deve ser um objeto");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Cria um evento canônico com validação imediata
 * @param {Partial<HarnessEvent> & { type: string, source: EventSource, payload: Record<string, any> }} params
 * @returns {HarnessEvent}
 */
function createEvent(params) {
  const now = new Date().toISOString();
  const evt = {
    id: params.id || crypto.randomUUID(),
    type: params.type,
    schemaVersion: params.schemaVersion || 1,
    timestamp: params.timestamp || now,
    receivedAt: params.receivedAt || now,
    source: {
      kind: params.source.kind,
      provider: params.source.provider,
      sourceEventId: params.source.sourceEventId,
      confidence: params.source.confidence
    },
    projectId: params.projectId,
    executionId: params.executionId,
    taskId: params.taskId,
    agentId: params.agentId,
    parentExecutionId: params.parentExecutionId,
    correlationId: params.correlationId,
    causationId: params.causationId,
    payload: params.payload || {}
  };

  const validation = validateEvent(evt);
  if (!validation.valid) {
    throw new Error(`Contrato de evento violado: ${validation.errors.join("; ")}`);
  }

  return evt;
}

function isValidDate(str) {
  const d = new Date(str);
  return !isNaN(d.getTime());
}

module.exports = {
  createEvent,
  validateEvent,
  EVENT_CATALOG,
  VALID_CONFIDENCES,
  VALID_SOURCE_KINDS
};
