// @ts-check
// Leitura tolerante e validação de limiares do monitor de motores (EP-09.06).
const fs = require("fs");
const path = require("path");

const DEFAULT_THRESHOLDS = /** @type {const} */ ({
  enabled: true,
  pollIntervalMs: 10000,
  idlePollIntervalMs: 30000,
  minDwellMs: 3000,
  hibernateAfterMs: 15 * 60 * 1000, // 15 minutos
  inactiveAfterMs: 2 * 60 * 60 * 1000, // 2 horas
  staleAfterMs: 30 * 60 * 1000, // 30 minutos
});

/**
 * Normaliza e valida um número garantindo limites positivos.
 * @param {any} val
 * @param {number} fallback
 * @param {number} [min=100]
 * @returns {number}
 */
function normalizePositiveInt(val, fallback, min = 100) {
  const n = Number(val);
  if (!Number.isFinite(n) || n < min) return fallback;
  return Math.round(n);
}

/**
 * Lê a configuração do monitor em global/engine-monitor.json com leitura tolerante.
 * @param {string} rootDir
 * @returns {{ thresholds: typeof DEFAULT_THRESHOLDS, rawLoaded: boolean, warnings: string[] }}
 */
function loadThresholds(rootDir) {
  const configFile = path.join(rootDir, "global", "engine-monitor.json");
  const warnings = [];

  if (!fs.existsSync(configFile)) {
    return {
      thresholds: { ...DEFAULT_THRESHOLDS },
      rawLoaded: false,
      warnings,
    };
  }

  try {
    const raw = fs.readFileSync(configFile, "utf8");
    const json = JSON.parse(raw);

    const thresholds = {
      enabled: json.enabled !== false,
      pollIntervalMs: normalizePositiveInt(json.pollIntervalMs, DEFAULT_THRESHOLDS.pollIntervalMs, 1000),
      idlePollIntervalMs: normalizePositiveInt(json.idlePollIntervalMs, DEFAULT_THRESHOLDS.idlePollIntervalMs, 2000),
      minDwellMs: normalizePositiveInt(json.minDwellMs, DEFAULT_THRESHOLDS.minDwellMs, 500),
      hibernateAfterMs: normalizePositiveInt(json.hibernateAfterMs, DEFAULT_THRESHOLDS.hibernateAfterMs, 60000),
      inactiveAfterMs: normalizePositiveInt(json.inactiveAfterMs, DEFAULT_THRESHOLDS.inactiveAfterMs, 120000),
      staleAfterMs: normalizePositiveInt(json.staleAfterMs, DEFAULT_THRESHOLDS.staleAfterMs, 60000),
    };

    if (json.pollIntervalMs !== undefined && thresholds.pollIntervalMs !== json.pollIntervalMs) {
      warnings.push(`pollIntervalMs inválido (${json.pollIntervalMs}), usado padrão ${thresholds.pollIntervalMs}`);
    }

    return {
      thresholds,
      rawLoaded: true,
      warnings,
    };
  } catch (err) {
    warnings.push(`Falha ao ler global/engine-monitor.json (${err.message}); usando padrões`);
    return {
      thresholds: { ...DEFAULT_THRESHOLDS },
      rawLoaded: false,
      warnings,
    };
  }
}

module.exports = {
  DEFAULT_THRESHOLDS,
  loadThresholds,
};
