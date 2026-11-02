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
 * Loads quotas, 9Router combos, OpenCode and (when a project is given) the daily trend in parallel.
 * @param {{ project?: string, window?: string, signal?: AbortSignal, fetchImpl?: typeof fetch }} opts
 */
export async function loadConsumo(opts) {
  const base = { signal: opts.signal, fetchImpl: opts.fetchImpl };
  const trendUrl = opts.project
    ? `/api/project/${encodeURIComponent(opts.project)}/usage/summary?window=${encodeURIComponent(opts.window || "14d")}&groupBy=day`
    : "";
  const [quotas, combos, opencode, trend] = await Promise.all([
    getJson("/api/usage/quotas", base),
    getJson("/api/usage/combos", base),
    getJson("/api/usage/opencode", base),
    trendUrl ? getJson(trendUrl, base) : Promise.resolve(/** @type {Source} */ ({ ok: false, error: "Nenhum projeto selecionado." })),
  ]);
  return { quotas, combos, opencode, trend, loadedAt: new Date().toISOString() };
}
