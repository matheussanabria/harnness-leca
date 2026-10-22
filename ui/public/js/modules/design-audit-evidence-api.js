// @ts-check
// Cliente HTTP da matriz de auditoria com evidencias (EP-11.01).

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/**
 * Carrega a matriz de auditoria com evidencias e filtros.
 * @param {string} slug
 * @param {{ state?: string, query?: string }} [filters]
 */
export async function fetchAuditMatrix(slug, filters = {}) {
  const params = new URLSearchParams();
  if (filters.state) params.set("state", filters.state);
  if (filters.query) params.set("q", filters.query);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`/api/project/${encodeURIComponent(slug)}/audit/matrix${suffix}`);
  if (!res.ok) return { ok: false, error: (await readJson(res)).error || "Falha ao carregar a matriz de auditoria." };
  return await res.json();
}

/**
 * Carrega as acoes disponiveis por regra no pipeline de estados.
 * @param {string} slug
 */
export async function fetchAuditPipeline(slug) {
  const res = await fetch(`/api/project/${encodeURIComponent(slug)}/audit/pipeline`);
  if (!res.ok) return { ok: false, error: (await readJson(res)).error || "Falha ao carregar o pipeline de auditoria." };
  return await res.json();
}

/**
 * Registra a evidencia de uma regra (somente loopback).
 * @param {string} slug
 * @param {Object} payload
 */
export async function saveAuditEvidence(slug, payload) {
  const res = await fetch(`/api/project/${encodeURIComponent(slug)}/audit/evidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, status: res.status, data: await readJson(res) };
}

/**
 * Executa uma acao do pipeline: generate, execute ou approve.
 * @param {string} slug
 * @param {string} action
 * @param {Object} payload
 */
export async function runAuditAction(slug, action, payload) {
  const res = await fetch(`/api/project/${encodeURIComponent(slug)}/audit/evidence/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, status: res.status, data: await readJson(res) };
}
