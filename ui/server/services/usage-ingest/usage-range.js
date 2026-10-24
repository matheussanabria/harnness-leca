// @ts-check
// Parses the time-range query of the usage summary: `since` (ISO) xor `window` (24h|7d|14d|all), plus `until`.
const WINDOWS_MS = { "24h": 24 * 3600e3, "7d": 7 * 86400e3, "14d": 14 * 86400e3, all: 0 };

/**
 * @param {{ since?: string, window?: string, until?: string }} q raw (trimmed) query values, "" when absent
 * @param {number} [nowMs]
 * @returns {{ error: string } | { since: string | null, until: string | null, window: string | null }}
 */
function parseUsageRange(q, nowMs = Date.now()) {
  const { since = "", window = "", until = "" } = q;
  if (since && window) return { error: "since e window sao mutuamente exclusivos." };
  if (since && Number.isNaN(Date.parse(since))) return { error: "since deve ser uma data ISO válida." };
  if (until && Number.isNaN(Date.parse(until))) return { error: "until deve ser uma data ISO válida." };
  if (window && !Object.hasOwn(WINDOWS_MS, window)) return { error: "window deve ser 24h, 7d, 14d ou all." };
  let sinceIso = since ? new Date(since).toISOString() : null;
  if (window && window !== "all") sinceIso = new Date(nowMs - WINDOWS_MS[/** @type {keyof typeof WINDOWS_MS} */ (window)]).toISOString();
  return { since: sinceIso, until: until ? new Date(until).toISOString() : null, window: window || null };
}

module.exports = { parseUsageRange };
