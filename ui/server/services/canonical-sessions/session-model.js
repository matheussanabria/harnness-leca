// @ts-check
// Modelo canônico de sessão do Harness (EP-09.01).
// Funções puras: nenhuma dependência de disco, rede ou DOM.

const SCHEMA_VERSION = 1;

const PROJECT_CONFIDENCE = ["explicit", "observed", "inferred", "unknown"];
const EXECUTION_STATUS = ["idle", "queued", "running", "succeeded", "failed", "cancelled", "unknown"];
const WORKFLOW_STATUS = ["none", "ready", "running", "blocked", "completed", "cancelled", "unknown"];
const ATTENTION_STATUS = ["none", "open", "acknowledged", "resolved", "unknown"];
const SOURCE_KIND = ["cli", "api", "ide_log", "sqlite", "bridge", "markdown"];
const RESUME_MODE = ["native", "context_replay", "unsupported", "unknown"];

/**
 * @param {string} provider
 * @param {string} nativeSessionId
 * @param {string} sourceKind
 * @returns {string} chave idempotente
 */
function fingerprint(provider, nativeSessionId, sourceKind) {
  return [String(provider || "").trim(), String(nativeSessionId || "").trim(), String(sourceKind || "").trim()]
    .map((part) => part.toLowerCase())
    .join("|");
}

/**
 * @param {any} value
 * @param {string[]} allowed
 * @param {string} fallback
 * @returns {string}
 */
function oneOf(value, allowed, fallback) {
  const text = String(value || "").trim();
  return allowed.includes(text) ? text : fallback;
}

/**
 * Cria uma sessão canônica com os padrões do modelo.
 * @param {Partial<{id: string, projectId: string, projectConfidence: string, title: string, titleSource: string,
 *   primaryProvider: string, executionStatus: string, workflowStatus: string, attentionStatus: string,
 *   createdAt: string, lastObservedAt: string, archivedAt: string}>} [input]
 * @returns {object}
 */
function makeSession(input = {}) {
  const now = new Date().toISOString();
  return {
    id: String(input.id || "").trim(),
    schemaVersion: SCHEMA_VERSION,
    projectId: String(input.projectId || "").trim() || null,
    projectConfidence: oneOf(input.projectConfidence, PROJECT_CONFIDENCE, "unknown"),
    title: String(input.title || "").trim() || "Sessão sem título",
    titleSource: oneOf(input.titleSource, ["declared", "derived", "fallback"], "fallback"),
    primaryProvider: String(input.primaryProvider || "").trim(),
    executionStatus: oneOf(input.executionStatus, EXECUTION_STATUS, "unknown"),
    workflowStatus: oneOf(input.workflowStatus, WORKFLOW_STATUS, "none"),
    attentionStatus: oneOf(input.attentionStatus, ATTENTION_STATUS, "none"),
    createdAt: String(input.createdAt || "").trim() || now,
    lastObservedAt: String(input.lastObservedAt || "").trim() || now,
    archivedAt: String(input.archivedAt || "").trim() || null,
  };
}

/**
 * Migração aditiva: preenche campos novos com padrão e preserva o que existe.
 * @param {any} session
 * @returns {object}
 */
function migrateSession(session) {
  const base = makeSession(session && typeof session === "object" ? session : {});
  const archived = session && typeof session.archivedAt === "string" ? session.archivedAt : null;
  return { ...base, id: String(session?.id || base.id), archivedAt: archived };
}

/**
 * @param {any} session
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateSession(session) {
  const errors = [];
  if (!session || typeof session !== "object") return { valid: false, errors: ["Sessão ausente."] };
  if (!String(session.id || "").trim()) errors.push("id é obrigatório.");
  if (!PROJECT_CONFIDENCE.includes(session.projectConfidence)) errors.push("projectConfidence inválido.");
  if (!EXECUTION_STATUS.includes(session.executionStatus)) errors.push("executionStatus inválido.");
  if (!WORKFLOW_STATUS.includes(session.workflowStatus)) errors.push("workflowStatus inválido.");
  if (!ATTENTION_STATUS.includes(session.attentionStatus)) errors.push("attentionStatus inválido.");
  return { valid: errors.length === 0, errors };
}

/**
 * Normaliza uma sessão nativa descoberta em um registro de sessão provedora.
 * @param {any} input
 * @returns {object}
 */
function makeProviderSession(input = {}) {
  const provider = String(input.provider || "").trim();
  const nativeSessionId = String(input.nativeSessionId || "").trim();
  const sourceKind = oneOf(input.sourceKind, SOURCE_KIND, "unknown");
  return {
    provider,
    nativeSessionId,
    sourceKind,
    sourceLocator: String(input.sourceLocator || "").trim(),
    resumeMode: oneOf(input.resumeMode, RESUME_MODE, "unknown"),
    capabilities: Array.isArray(input.capabilities) ? input.capabilities.map(String) : [],
    fingerprint: fingerprint(provider, nativeSessionId, sourceKind),
  };
}

/**
 * @param {object} session
 * @param {{ provider?: string, executionStatus?: string, workflowStatus?: string, attentionStatus?: string,
 *   projectConfidence?: string, q?: string }} [filters]
 * @returns {boolean}
 */
function matchesFilters(session, filters = {}) {
  if (!session) return false;
  if (filters.provider && session.primaryProvider !== filters.provider) return false;
  if (filters.executionStatus && session.executionStatus !== filters.executionStatus) return false;
  if (filters.workflowStatus && session.workflowStatus !== filters.workflowStatus) return false;
  if (filters.attentionStatus && session.attentionStatus !== filters.attentionStatus) return false;
  if (filters.projectConfidence && session.projectConfidence !== filters.projectConfidence) return false;
  if (filters.q) {
    const needle = String(filters.q).trim().toLowerCase();
    const haystack = [session.title, session.id, session.projectId || ""].join(" ").toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

module.exports = {
  SCHEMA_VERSION,
  PROJECT_CONFIDENCE,
  EXECUTION_STATUS,
  WORKFLOW_STATUS,
  ATTENTION_STATUS,
  SOURCE_KIND,
  RESUME_MODE,
  fingerprint,
  makeSession,
  migrateSession,
  validateSession,
  makeProviderSession,
  matchesFilters,
};
