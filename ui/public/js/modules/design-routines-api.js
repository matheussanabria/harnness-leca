// @ts-check
// Chamadas HTTP da aba de Rotinas (EP-08.05).

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export async function fetchProjectRoutines(slug) {
  const res = await fetch(`/api/project/${encodeURIComponent(slug)}/routines`);
  if (!res.ok) return { ok: false, error: (await readJson(res)).error || "Falha ao carregar rotinas." };
  return await res.json();
}

export async function runProjectRoutine(slug, routineId, actor = "") {
  const res = await fetch(`/api/project/${encodeURIComponent(slug)}/routines/${encodeURIComponent(routineId)}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actor }),
  });
  return { ok: res.ok, status: res.status, data: await readJson(res) };
}

export async function fetchApprovals(slug) {
  const res = await fetch(`/api/orchestration/approvals?slug=${encodeURIComponent(slug)}`);
  if (!res.ok) return { ok: false, error: (await readJson(res)).error || "Falha ao carregar aprovações." };
  return await res.json();
}

export async function decideApproval(executionId, decision, actor = "", note = "") {
  const res = await fetch(`/api/orchestration/workflow-runs/${encodeURIComponent(executionId)}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, actor, note }),
  });
  return { ok: res.ok, status: res.status, data: await readJson(res) };
}

export async function fetchWorkflowHistory(slug, limit = 30) {
  const res = await fetch(`/api/project/${encodeURIComponent(slug)}/workflow-history?limit=${limit}`);
  if (!res.ok) return { ok: false, error: (await readJson(res)).error || "Falha ao carregar o histórico." };
  return await res.json();
}
