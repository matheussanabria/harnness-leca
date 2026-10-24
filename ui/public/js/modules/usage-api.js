// @ts-check
// Aba Consumo: cliente de leitura de GET /api/project/:slug/usage/summary.

/**
 * @param {string} slug
 * @param {{ window: string, groupBy: string, signal?: AbortSignal, fetchImpl?: typeof fetch }} opts
 * @returns {Promise<any>}
 */
export async function fetchUsageSummary(slug, opts) {
  const f = opts.fetchImpl || (typeof fetch === "function" ? fetch : null);
  if (!f) throw new Error("Sem transporte HTTP disponível.");
  const q = new URLSearchParams({ window: opts.window, groupBy: opts.groupBy });
  const url = `/api/project/${encodeURIComponent(slug)}/usage/summary?${q}`;
  const res = await f(url, { headers: { Accept: "application/json" }, signal: opts.signal });
  if (!res.ok) throw new Error(`Falha ao consultar o consumo (${res.status}).`);
  return res.json();
}

/**
 * Três agrupamentos em paralelo (o endpoint aceita um groupBy por chamada).
 * @param {string} slug
 * @param {{ window: string, signal?: AbortSignal, fetchImpl?: typeof fetch }} opts
 */
export async function loadUsage(slug, opts) {
  const get = (/** @type {string} */ groupBy) => fetchUsageSummary(slug, { ...opts, groupBy });
  const [day, model, session] = await Promise.all([get("day"), get("model"), get("session")]);
  return { window: opts.window, day, model, session };
}
