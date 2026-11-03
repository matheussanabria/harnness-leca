// @ts-check
// Consumo page: read-only client of the global usage endpoints. Each source fails on its own.

/** @typedef {{ ok: true, data: any } | { ok: false, error: string }} Source */

/**
 * @param {string} url
 * @param {{ signal?: AbortSignal, fetchImpl?: typeof fetch }} opts
 * @returns {Promise<Source>}
 */
async function getJson(url, opts) {
  const f = opts.fetchImpl || (typeof fetch === "function" ? fetch : null);
  if (!f) return { ok: false, error: "Sem transporte HTTP disponível." };
  try {
    const res = await f(url, { headers: { Accept: "application/json" }, signal: opts.signal });
    if (!res.ok) return { ok: false, error: `Falha ao consultar (${res.status}).` };
    return { ok: true, data: await res.json() };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    return { ok: false, error: "Servidor indisponível." };
  }
}

/**
 * Loads quotas, 9Router combos, OpenCode, Gemini activity and routing outcomes in parallel.
 * @param {{ signal?: AbortSignal, fetchImpl?: typeof fetch }} opts
 */
export async function loadConsumo(opts) {
  const base = { signal: opts.signal, fetchImpl: opts.fetchImpl };
  const [quotas, combos, opencode, gemini, routing] = await Promise.all([
    getJson("/api/usage/quotas", base),
    getJson("/api/usage/combos", base),
    getJson("/api/usage/opencode", base),
    getJson("/api/usage/gemini", base),
    getJson("/api/usage/routing", base),
  ]);
  return { quotas, combos, opencode, gemini, routing, loadedAt: new Date().toISOString() };
}
