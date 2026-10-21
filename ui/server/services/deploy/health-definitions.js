// @ts-check
// Modelo canonico de verificacoes de saude de ambientes (EP-10.02).
const CHECK_TYPES = Object.freeze(["http", "command"]);
const STATES = Object.freeze(["saudavel", "degradado", "instavel", "desconhecido"]);
const STATE_PRIORITY = Object.freeze({ saudavel: 0, desconhecido: 1, degradado: 2, instavel: 3 });
const MAX_ID = 60;
const MAX_TARGET = 240;

function fail(status, message) {
  const error = new Error(message);
  // @ts-ignore
  error.status = status;
  return error;
}

/**
 * Normaliza e valida uma verificacao de saude.
 * @param {any} input
 * @returns {Object}
 */
function normalizeCheck(input = {}) {
  const id = String(input.id || "").trim().slice(0, MAX_ID);
  if (!id) throw fail(400, "Verificacao sem identificador.");
  const type = String(input.type || "http").trim();
  if (!CHECK_TYPES.includes(type)) throw fail(400, "Tipo de verificacao invalido.");
  const projectId = String(input.projectId || "").trim().slice(0, MAX_ID);
  const envId = String(input.envId || "").trim().slice(0, MAX_ID);
  if (!projectId || !envId) throw fail(400, "Verificacao exige projeto e ambiente.");
  const target = String(input.target || "").trim().slice(0, MAX_TARGET);
  if (!target) throw fail(400, "Verificacao exige alvo.");
  if (type === "http" && !/^https?:\/\//i.test(target)) {
    throw fail(400, "Alvo http invalido: deve comecar com http:// ou https://");
  }
  const expectedStatus = Math.min(Math.max(Number(input.expectedStatus) || 200, 100), 599);
  const args = Array.isArray(input.args) ? input.args.map((item) => String(item)).slice(0, 20) : [];
  return {
    id,
    projectId,
    envId,
    type,
    target,
    args,
    method: String(input.method || "GET").trim().toUpperCase().slice(0, 8),
    expectedStatus,
    timeoutMs: Math.min(Math.max(Number(input.timeoutMs) || 10000, 500), 120000),
    description: String(input.description || "").trim().slice(0, 200),
    updatedAt: String(input.updatedAt || "").trim().slice(0, 40),
  };
}

/**
 * Classifica o resultado de uma verificacao.
 * @param {{ ok: boolean, degraded?: boolean }} outcome
 * @returns {string}
 */
function classifyOutcome(outcome) {
  if (!outcome?.ok) return "instavel";
  if (outcome.degraded) return "degradado";
  return "saudavel";
}

/**
 * Agrega o estado de um ambiente a partir das suas verificacoes.
 * @param {Array<{ state: string }>} states
 * @returns {string}
 */
function aggregateState(states = []) {
  if (!states.length) return "desconhecido";
  let worst = "saudavel";
  for (const item of states) {
    const state = STATES.includes(item?.state) ? item.state : "desconhecido";
    if (STATE_PRIORITY[state] > STATE_PRIORITY[worst]) worst = state;
  }
  return worst;
}

module.exports = {
  CHECK_TYPES,
  STATES,
  STATE_PRIORITY,
  MAX_ID,
  MAX_TARGET,
  fail,
  normalizeCheck,
  classifyOutcome,
  aggregateState,
};
