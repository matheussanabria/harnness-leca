// @ts-check
// Lifecycle of the usage ingest at server boot: own unref'd timer, separate from the presence runtime.
// HARNESS_USAGE=0 disables it. While a backlog remains (first backfill) the next tick comes after a short
// delay, so the work is chunked and the event loop is never blocked for long.
const cfg = require("./usage-config");
const { createUsageIngestor } = require("./usage-ingestor");
const { createCodexIngestor } = require("./codex-ingestor");

/** @type {ReturnType<typeof createUsageIngestor> | null} */
let active = null;
/** @type {{ tick: () => { backlog: boolean } | void, getStats: () => any, recordError?: () => void } | null} */
let activeCodex = null;

/** @param {NodeJS.ProcessEnv} env @returns {number} */
function intervalFrom(env) {
  const n = Number(env.HARNESS_USAGE_INTERVAL_MS);
  return Number.isFinite(n) && n >= cfg.LIMITS.minIntervalMs ? n : cfg.LIMITS.intervalMs;
}

/**
 * @param {{ env?: NodeJS.ProcessEnv, ingestor?: { tick: () => { backlog: boolean } | void, getStats: () => any, recordError?: () => void },
 *   ingestorOptions?: Parameters<typeof createUsageIngestor>[0], intervalMs?: number, backlogDelayMs?: number,
 *   codexIngestor?: { tick: () => { backlog: boolean } | void, getStats: () => any, recordError?: () => void } | null }} [options]
 * @returns {{ stop: () => void, ingestor: any } | null} null when disabled
 */
function startUsageIngest(options = {}) {
  const env = options.env || process.env;
  if (String(env.HARNESS_USAGE || "").trim() === "0") return null;
  const ingestor = options.ingestor || createUsageIngestor(options.ingestorOptions);
  active = /** @type {any} */ (ingestor);
  // The Codex rollout ingest runs on the same timer. It is created by default only when the Claude ingestor is
  // also the default one, so tests that inject their own ingestor never read the real ~/.codex.
  const codex = options.codexIngestor !== undefined ? options.codexIngestor : (options.ingestor || options.ingestorOptions) ? null : createCodexIngestor();
  activeCodex = codex;
  const interval = options.intervalMs || intervalFrom(env);
  const backlogDelay = options.backlogDelayMs ?? cfg.LIMITS.backlogDelayMs;
  let stopped = false;
  /** @type {NodeJS.Timeout | null} */
  let timer = null;
  const schedule = (/** @type {number} */ ms) => {
    if (stopped) return;
    timer = setTimeout(run, ms);
    timer.unref();
  };
  function run() {
    let backlog = false;
    for (const source of codex ? [ingestor, codex] : [ingestor]) {
      try {
        const r = source.tick();
        backlog = backlog || Boolean(r && r.backlog);
      } catch {
        source.recordError?.();
      }
    }
    schedule(backlog ? backlogDelay : interval);
  }
  schedule(0); // first tick right after boot, off the listen callback
  return { stop: () => { stopped = true; if (timer) clearTimeout(timer); }, ingestor };
}

/** @returns {{ enabled: boolean } & Record<string, any>} */
function getUsageStats() {
  if (!active) return { enabled: false };
  return { enabled: true, ...active.getStats(), ...(activeCodex ? { codex: activeCodex.getStats() } : {}) };
}

function resetUsageRuntime() {
  active = null;
  activeCodex = null;
}

module.exports = { startUsageIngest, getUsageStats, resetUsageRuntime };
