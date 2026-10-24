// @ts-check
// Ciclo de vida do scanner de presenca no servidor: primeira varredura ao iniciar, timer com
// unref, desligavel por HARNESS_PRESENCE=0. Erros sao engolidos e contados; nunca derrubam o boot.
const cfg = require("./presence-config");
const { createPresenceScanner } = require("./presence-scanner");

/** @type {ReturnType<typeof createPresenceScanner> | null} */
let active = null;

/** @param {NodeJS.ProcessEnv} env @returns {number} */
function intervalFrom(env) {
  const n = Number(env.HARNESS_PRESENCE_INTERVAL_MS);
  return Number.isFinite(n) && n >= cfg.MIN_INTERVAL_MS ? n : cfg.DEFAULT_INTERVAL_MS;
}

/**
 * @param {{ env?: NodeJS.ProcessEnv, scanner?: { scanOnce: () => void, getStats: () => any, recordError?: () => void },
 *   scannerOptions?: Parameters<typeof createPresenceScanner>[0], intervalMs?: number }} [options]
 * @returns {{ stop: () => void, scanner: any } | null} null quando desabilitado
 */
function startPresenceScanner(options = {}) {
  const env = options.env || process.env;
  if (String(env.HARNESS_PRESENCE || "").trim() === "0") return null;
  const scanner = options.scanner || createPresenceScanner(options.scannerOptions);
  active = /** @type {any} */ (scanner);
  const run = () => {
    try {
      scanner.scanOnce();
    } catch {
      scanner.recordError?.();
    }
  };
  run(); // primeira varredura: a Central nao nasce vazia
  const timer = setInterval(run, options.intervalMs || intervalFrom(env));
  timer.unref();
  return { stop: () => clearInterval(timer), scanner };
}

/** @returns {{ enabled: boolean } & Record<string, any>} */
function getPresenceStats() {
  return active ? { enabled: true, ...active.getStats() } : { enabled: false };
}

function resetPresenceRuntime() {
  active = null;
}

module.exports = { startPresenceScanner, getPresenceStats, resetPresenceRuntime };
