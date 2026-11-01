// @ts-check
// Telemetria e Registro de Execução da Camada HIA (HIA-011)
// Armazena eventos e métricas conforme schemas/hia-execution.schema.json

const fs = require("fs");
const path = require("path");
const { ROOT } = require("../root");

const TELEMETRY_DIR = path.join(ROOT, "logs/telemetry");

/**
 * @typedef {Object} ExecutionRecord
 * @property {string} executionId
 * @property {string} [taskId]
 * @property {string} executorType
 * @property {string} executorId
 * @property {string} status
 * @property {number} durationMs
 * @property {number} tokensPrompt
 * @property {number} tokensCompletion
 * @property {number} tokensTotal
 * @property {number} tokensSaved
 * @property {string} [startedAt]
 * @property {string} [completedAt]
 * @property {string} [error]
 * @property {string} [suggestedCombo] combo of 9Router the router would pick (cloud route only)
 * @property {string} [suggestedType] SDLC task type behind the suggestion
 * @property {string} [appliedCombo] model ref the turn actually ran on when HIA_COMBO_ROUTING applied the suggestion
 * @property {string} [project] project slug
 * @property {string} [promptPreview] short redacted prompt excerpt for manual review
 * @property {string} [qualityGate] quality gate code of the answer (ok, empty, truncated, fake_tool_call)
 */

/**
 * Salva registro de telemetria no disco em formato JSONL append-only
 * @param {ExecutionRecord} record
 */
function recordExecution(record) {
  if (!fs.existsSync(TELEMETRY_DIR)) {
    fs.mkdirSync(TELEMETRY_DIR, { recursive: true });
  }

  const logFile = path.join(TELEMETRY_DIR, "hia-executions.jsonl");
  const payload = {
    ...record,
    recordedAt: new Date().toISOString(),
  };

  fs.appendFileSync(logFile, JSON.stringify(payload) + "\n", "utf8");
}

/**
 * Lê métricas consolidadas dos registros de telemetria
 */
function getTelemetryMetrics() {
  const logFile = path.join(TELEMETRY_DIR, "hia-executions.jsonl");
  if (!fs.existsSync(logFile)) {
    return {
      totalExecutions: 0,
      totalTokensSaved: 0,
      byExecutorType: {},
    };
  }

  const content = fs.readFileSync(logFile, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);

  let totalTokensSaved = 0;
  const byExecutorType = {};

  for (const line of lines) {
    try {
      const rec = JSON.parse(line);
      totalTokensSaved += rec.tokensSaved || 0;
      byExecutorType[rec.executorType] = (byExecutorType[rec.executorType] || 0) + 1;
    } catch {}
  }

  return {
    totalExecutions: lines.length,
    totalTokensSaved,
    byExecutorType,
  };
}

module.exports = {
  recordExecution,
  getTelemetryMetrics,
};
