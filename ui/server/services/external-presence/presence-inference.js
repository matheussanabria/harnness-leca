// @ts-check
// Inferencia pura de atividade e presenca a partir da idade do ultimo sinal (design 06).
//
// Funcao pura: sem relogio global, sem I/O. Tudo aqui e `inferred`: um agente esperando uma
// ferramenta longa ou uma aprovacao pode parecer ocioso (limitacao documentada, nao escondida).
// Expirar a presenca NUNCA vira "completed".
const { THRESHOLDS, HEARTBEAT_MS } = require("./presence-config");

/**
 * @typedef {{ activity: "processing" | "idle" | "unknown", presence: "connected" | "no_recent_signal" }} Inference
 */

/**
 * @param {number} signalMs mtime do ultimo sinal (epoch ms)
 * @param {number} nowMs
 * @param {typeof THRESHOLDS} [limits]
 * @returns {Inference | null} null = antigo demais, nao publicar
 */
function inferPresence(signalMs, nowMs, limits = THRESHOLDS) {
  if (!Number.isFinite(signalMs) || !Number.isFinite(nowMs)) return null;
  // Relogio do arquivo ligeiramente a frente do nosso: idade negativa vale como agora.
  const age = Math.max(0, nowMs - signalMs);
  if (age < limits.processingMs) return { activity: "processing", presence: "connected" };
  if (age < limits.idleMs) return { activity: "idle", presence: "connected" };
  if (age < limits.noRecentSignalMs) return { activity: "unknown", presence: "no_recent_signal" };
  return null;
}

/**
 * Balde da chave de idempotencia: derivado do proprio sinal, nao do relogio de varredura.
 * Mesmo estado + mesmo balde = replay no-op (inclusive apos reiniciar o servidor); enquanto
 * processing, o balde avanca a cada HEARTBEAT_MS de escrita, o que gera um batimento por minuto.
 * @param {number} signalMs
 * @returns {number}
 */
function bucketOf(signalMs) {
  return Math.floor(signalMs / HEARTBEAT_MS);
}

/**
 * Chave de idempotencia do design: presence|<engine>|<sessionId>|<activity>|<presence>|<bucket>.
 * @param {string} engine
 * @param {string} sessionId
 * @param {Inference} state
 * @param {number} signalMs
 * @returns {string}
 */
function idempotencyKeyOf(engine, sessionId, state, signalMs) {
  return `presence|${engine}|${sessionId}|${state.activity}|${state.presence}|${bucketOf(signalMs)}`;
}

module.exports = { inferPresence, bucketOf, idempotencyKeyOf };
