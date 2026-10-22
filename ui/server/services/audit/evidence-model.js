// @ts-check
// Modelo de evidencia de teste: quatro estados distintos e estado efetivo (EP-11.01).
const crypto = require("node:crypto");

const STATES = Object.freeze(["planned", "generated", "executed", "approved"]);
const STATE_RANK = Object.freeze({ planned: 0, generated: 1, executed: 2, approved: 3 });
const TEST_KINDS = Object.freeze(["bdd", "unit", "integration", "visual", "req"]);
const MAX_TEXT = Object.freeze({ file: 240, command: 240, actor: 80, note: 300 });

function isState(value) {
  return STATES.includes(String(value || "").trim());
}

function isKind(value) {
  return TEST_KINDS.includes(String(value || "").trim());
}

function fail(status, message) {
  const error = new Error(message);
  // @ts-ignore
  error.status = status;
  return error;
}

/**
 * Chave estavel de uma evidencia por regra do projeto.
 * @param {string} screenId
 * @param {string} ruleTitle
 * @returns {string}
 */
function evidenceKey(screenId, ruleTitle) {
  const screen = String(screenId || "").trim().toLowerCase();
  const rule = String(ruleTitle || "").trim().toLowerCase();
  return crypto.createHash("sha256").update(`${screen}|${rule}`).digest("hex").slice(0, 16);
}

/**
 * Normaliza uma evidencia vinda do manifesto ou da API.
 * @param {any} input
 * @returns {Object}
 */
function normalizeEvidence(input = {}) {
  const state = String(input.state || "planned").trim();
  if (!isState(state)) throw fail(400, "Estado de evidencia invalido.");
  const kind = String(input.kind || "unit").trim();
  if (!isKind(kind)) throw fail(400, "Tipo de teste invalido.");
  const evidence = input.evidence && typeof input.evidence === "object" ? input.evidence : {};
  return {
    id: String(input.id || evidenceKey(input.screenId, input.ruleTitle)).slice(0, 32),
    screenId: String(input.screenId || "").trim().slice(0, 80),
    screenName: String(input.screenName || "").trim().slice(0, 120),
    ruleTitle: String(input.ruleTitle || "").trim().slice(0, 240),
    kind,
    state,
    evidence: {
      file: String(evidence.file || "").trim().slice(0, MAX_TEXT.file),
      command: String(evidence.command || "").trim().slice(0, MAX_TEXT.command),
      actor: String(evidence.actor || "").trim().slice(0, MAX_TEXT.actor),
      at: String(evidence.at || "").trim().slice(0, 40),
    },
    history: Array.isArray(input.history) ? input.history.slice(-20) : [],
    updatedAt: String(input.updatedAt || "").trim().slice(0, 40),
  };
}

/**
 * Estado efetivo verificado: o maior estado comprovado por evidencia real.
 * Sem artefato no disco, nada e declarado; aprovacao exige arquivo, comando e responsavel.
 * @param {string} declaredState
 * @param {{ hasArtifact?: boolean, hasExecution?: boolean, hasApproval?: boolean }} facts
 * @returns {string}
 */
function effectiveState(declaredState, facts = {}) {
  if (!facts.hasArtifact) return "planned";
  if (facts.hasApproval) return "approved";
  if (facts.hasExecution) return "executed";
  return "generated";
}

/**
 * Valida a transicao de estados entre duas evidencias.
 * @param {string} current
 * @param {string} next
 * @param {Object} evidence
 */
function assertTransition(current, next, evidence = {}) {
  if (!isState(next)) throw fail(400, "Estado de evidencia invalido.");
  const from = isState(current) ? current : "planned";
  if (STATE_RANK[next] < STATE_RANK[from]) {
    throw fail(409, `Transicao invalida: '${from}' nao volta para '${next}'.`);
  }
  if (STATE_RANK[next] === STATE_RANK[from] && next !== from) {
    throw fail(409, "Transicao invalida entre estados diferentes.");
  }
  if (next === "executed" || next === "approved") {
    if (!evidence.file) throw fail(400, "Evidencia executada exige o arquivo do teste.");
    if (!evidence.command) throw fail(400, "Evidencia executada exige o comando executado.");
  }
  if (next === "approved" && !evidence.actor) {
    throw fail(400, "Aprovacao exige o responsavel.");
  }
}

/**
 * Metricas por estado, sem somar estados diferentes.
 * @param {Object[]} rows
 * @returns {Object}
 */
function summarizeByState(rows = []) {
  const counts = { planned: 0, generated: 0, executed: 0, approved: 0 };
  for (const row of rows) {
    const state = isState(row?.state) ? row.state : "planned";
    counts[state] += 1;
  }
  const total = rows.length;
  return {
    counts,
    total,
    approvedPercent: total ? Math.round((counts.approved / total) * 100) : 0,
    executedPercent: total ? Math.round(((counts.approved + counts.executed) / total) * 100) : 0,
    artifactPercent: total ? Math.round(((counts.approved + counts.executed + counts.generated) / total) * 100) : 0,
  };
}

module.exports = {
  STATES,
  STATE_RANK,
  TEST_KINDS,
  isState,
  isKind,
  fail,
  evidenceKey,
  normalizeEvidence,
  effectiveState,
  assertTransition,
  summarizeByState,
};
