// @ts-check
// Limita tentativas de PIN: por cliente e global, janela deslizante e bloqueio temporário.
// O limite global cobre quem troca de identificador a cada tentativa.

const DEFAULTS = {
  windowMs: 15 * 60 * 1000,
  lockMs: 15 * 60 * 1000,
  maxPerClient: 5,
  maxGlobal: 40,
  maxTracked: 5000,
};

/**
 * @param {Partial<typeof DEFAULTS> & { now?: () => number }} [options]
 */
function createThrottle(options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const now = options.now || Date.now;
  /** @type {Map<string, { fails: number[], lockedUntil: number }>} */
  const clients = new Map();
  const global = { fails: /** @type {number[]} */ ([]), lockedUntil: 0 };

  /** @param {{ fails: number[], lockedUntil: number }} entry @param {number} limit */
  function register(entry, limit) {
    const t = now();
    entry.fails = entry.fails.filter((ts) => t - ts < cfg.windowMs);
    entry.fails.push(t);
    if (entry.fails.length >= limit) {
      entry.lockedUntil = t + cfg.lockMs;
      entry.fails = [];
    }
  }

  /** @param {string} key @returns {number} segundos até poder tentar de novo; 0 quando liberado */
  function retryAfterSec(key) {
    const t = now();
    const until = Math.max(global.lockedUntil, (clients.get(key) || { lockedUntil: 0 }).lockedUntil);
    return until > t ? Math.ceil((until - t) / 1000) : 0;
  }

  /** @param {string} key */
  function recordFailure(key) {
    let entry = clients.get(key);
    if (!entry) {
      if (clients.size >= cfg.maxTracked) clients.delete(/** @type {string} */ (clients.keys().next().value));
      entry = { fails: [], lockedUntil: 0 };
      clients.set(key, entry);
    }
    register(entry, cfg.maxPerClient);
    register(global, cfg.maxGlobal);
  }

  /** @param {string} key */
  function recordSuccess(key) {
    clients.delete(key);
  }

  return { retryAfterSec, recordFailure, recordSuccess };
}

module.exports = { createThrottle, defaultThrottle: createThrottle(), DEFAULTS };
