// @ts-check
// Runtime Telemetry — Local AI Runtime (EP-04.01)
// Registro estruturado append-only em JSONL sem vazamento de prompts ou dados sensíveis.

const fs = require("fs");
const path = require("path");
const { ROOT } = require("../root");

const TELEMETRY_DIR = path.join(ROOT, "logs/telemetry");
const LOG_FILE = path.join(TELEMETRY_DIR, "runtime-shadow.jsonl");

/**
 * @typedef {Object} InferenceTelemetryEntry
 * @property {string} correlationId
 * @property {string} [slug]
 * @property {string} model
 * @property {boolean} valid
 * @property {string} [tipo]
 * @property {string} [complexidade]
 * @property {string} [executorSugerido]
 * @property {string} [modulo]
 * @property {number} [totalDurationMs]
 * @property {number} [loadDurationMs]
 * @property {number} [promptDurationMs]
 * @property {number} [evalDurationMs]
 * @property {number} [tokensPrompt]
 * @property {number} [tokensGenerated]
 * @property {string[]} [errors]
 */

/**
 * Registra dados de telemetria de inferência de modo sanitizado
 * @param {InferenceTelemetryEntry} entry
 */
function recordInference(entry) {
  try {
    if (!fs.existsSync(TELEMETRY_DIR)) {
      fs.mkdirSync(TELEMETRY_DIR, { recursive: true });
    }

    // Sanitização rigorosa: apenas metadados e contagens, nunca o prompt bruto
    const record = {
      correlationId: String(entry.correlationId || "unknown"),
      slug: entry.slug ? String(entry.slug) : undefined,
      model: String(entry.model || "unknown"),
      valid: Boolean(entry.valid),
      tipo: entry.tipo || undefined,
      complexidade: entry.complexidade || undefined,
      executorSugerido: entry.executorSugerido || undefined,
      modulo: entry.modulo || undefined,
      totalDurationMs: typeof entry.totalDurationMs === "number" ? entry.totalDurationMs : 0,
      loadDurationMs: typeof entry.loadDurationMs === "number" ? entry.loadDurationMs : 0,
      promptDurationMs: typeof entry.promptDurationMs === "number" ? entry.promptDurationMs : 0,
      evalDurationMs: typeof entry.evalDurationMs === "number" ? entry.evalDurationMs : 0,
      tokensPrompt: typeof entry.tokensPrompt === "number" ? entry.tokensPrompt : 0,
      tokensGenerated: typeof entry.tokensGenerated === "number" ? entry.tokensGenerated : 0,
      errors: Array.isArray(entry.errors) && entry.errors.length ? entry.errors : undefined,
      timestamp: new Date().toISOString(),
    };

    fs.appendFileSync(LOG_FILE, JSON.stringify(record) + "\n", "utf8");
  } catch (err) {
    // Falhas de telemetria nunca devem quebrar a aplicação principal
    console.error("[runtime-telemetry] Falha ao persistir telemetria:", err instanceof Error ? err.message : err);
  }
}

/**
 * Lê e sumariza as métricas de telemetria do runtime local
 */
function getRuntimeTelemetryMetrics() {
  if (!fs.existsSync(LOG_FILE)) {
    return {
      totalInferences: 0,
      validInferences: 0,
      invalidInferences: 0,
      totalPromptTokens: 0,
      totalGeneratedTokens: 0,
      avgDurationMs: 0,
      byType: {},
      bySuggestedExecutor: {},
    };
  }

  try {
    const content = fs.readFileSync(LOG_FILE, "utf8");
    const lines = content.split(/\r?\n/).filter(Boolean);

    let validCount = 0;
    let totalPromptTokens = 0;
    let totalGeneratedTokens = 0;
    let totalDurationMs = 0;
    const byType = {};
    const bySuggestedExecutor = {};

    for (const line of lines) {
      try {
        const item = JSON.parse(line);
        if (item.valid) validCount++;
        totalPromptTokens += item.tokensPrompt || 0;
        totalGeneratedTokens += item.tokensGenerated || 0;
        totalDurationMs += item.totalDurationMs || 0;
        if (item.tipo) byType[item.tipo] = (byType[item.tipo] || 0) + 1;
        if (item.executorSugerido) {
          bySuggestedExecutor[item.executorSugerido] = (bySuggestedExecutor[item.executorSugerido] || 0) + 1;
        }
      } catch {}
    }

    return {
      totalInferences: lines.length,
      validInferences: validCount,
      invalidInferences: lines.length - validCount,
      totalPromptTokens,
      totalGeneratedTokens,
      avgDurationMs: lines.length ? Math.round(totalDurationMs / lines.length) : 0,
      byType,
      bySuggestedExecutor,
    };
  } catch {
    return {
      totalInferences: 0,
      validInferences: 0,
      invalidInferences: 0,
      totalPromptTokens: 0,
      totalGeneratedTokens: 0,
      avgDurationMs: 0,
      byType: {},
      bySuggestedExecutor: {},
    };
  }
}

module.exports = {
  LOG_FILE,
  recordInference,
  getRuntimeTelemetryMetrics,
};
