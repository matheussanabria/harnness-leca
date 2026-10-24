// @ts-check
// Envelope v1 do event log (ADR-TEL-003/004, plano T1.2).
//
// Campos novos e aditivos sobre o envelope do EP-09: todos anulaveis, nenhum renomeia ou
// remove campo existente. Ausente continua null (nunca vira 0 ou string vazia).
// Este modulo e o unico dono do formato; store, migracao e ingest leem daqui.

const SCHEMA_VERSION = 1;
const MAX_ID_LENGTH = 200;
const RELATIONS = new Set(["native", "declared", "inferred", "unknown"]);

/** Identificadores textuais do envelope: [chave JS, coluna SQLite]. */
const ID_FIELDS = [
  ["runId", "run_id"],
  ["parentRunId", "parent_run_id"],
  ["traceId", "trace_id"],
  ["agentId", "agent_id"],
  ["taskId", "task_id"],
  ["workflowRunId", "workflow_run_id"],
  ["stepRunId", "step_run_id"],
  ["attemptId", "attempt_id"],
  ["engineInstanceId", "engine_instance_id"],
  ["nativeSessionId", "native_session_id"],
  ["idempotencyKey", "idempotency_key"],
];

/** Colunas adicionadas pela migracao 1 (todas sem DEFAULT: ADD COLUMN e so metadado). */
const ENVELOPE_COLUMNS = [
  { name: "schema_version", type: "INTEGER" },
  { name: "ingested_at", type: "TEXT" },
  { name: "relation", type: "TEXT" },
  ...ID_FIELDS.map(([, column]) => ({ name: column, type: "TEXT" })),
];

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function cleanId(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim().slice(0, MAX_ID_LENGTH);
  return text || null;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function cleanRelation(value) {
  return typeof value === "string" && RELATIONS.has(value) ? value : null;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function cleanSchemaVersion(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : SCHEMA_VERSION;
}

/**
 * Campos de envelope de uma entrada. `ingestedAt` e sempre o relogio do servidor.
 * @param {any} input
 * @returns {Record<string, any>}
 */
function normalizeEnvelope(input) {
  /** @type {Record<string, any>} */
  const envelope = {
    schemaVersion: cleanSchemaVersion(input?.schemaVersion),
    ingestedAt: new Date().toISOString(),
    relation: cleanRelation(input?.relation),
  };
  for (const [key] of ID_FIELDS) envelope[key] = cleanId(input?.[key]);
  return envelope;
}

/**
 * Converte uma linha do SQLite no evento publico. Linhas antigas (pre-migracao) trazem
 * colunas null: schemaVersion cai para 1 e o resto permanece null.
 * @param {any} row
 * @returns {Record<string, any>}
 */
function rowToEvent(row) {
  /** @type {Record<string, any>} */
  const event = {
    id: String(row.id),
    type: String(row.type),
    at: String(row.at),
    source: { provider: String(row.source_provider || ""), kind: String(row.source_kind || "") },
    trust: String(row.trust || "observed"),
    projectId: row.project_id ? String(row.project_id) : null,
    sessionId: row.session_id ? String(row.session_id) : null,
    executionId: row.execution_id ? String(row.execution_id) : null,
    payload: JSON.parse(String(row.payload || "{}")),
    schemaVersion: row.schema_version == null ? SCHEMA_VERSION : Number(row.schema_version),
    ingestedAt: row.ingested_at == null ? null : String(row.ingested_at),
    relation: row.relation == null ? null : String(row.relation),
  };
  for (const [key, column] of ID_FIELDS) event[key] = row[column] == null ? null : String(row[column]);
  return event;
}

module.exports = {
  SCHEMA_VERSION,
  MAX_ID_LENGTH,
  RELATIONS,
  ID_FIELDS,
  ENVELOPE_COLUMNS,
  cleanId,
  normalizeEnvelope,
  rowToEvent,
};
