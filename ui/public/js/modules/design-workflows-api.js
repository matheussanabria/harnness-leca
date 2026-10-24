// @ts-check
// HTTP calls for the Workflows tab (EP-08.06).

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function failure(res, fallback, data) {
  return { ok: false, status: res.status, error: data?.error || fallback };
}

/** @param {string} url @param {any} body */
async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: response.ok, status: response.status, data: await readJson(response) };
}

export async function fetchWorkflows() {
  const res = await fetch("/api/orchestration/workflows");
  const data = await readJson(res);
  if (!res.ok) return failure(res, "Falha ao carregar o catálogo de workflows.", data);
  return { ok: true, workflows: Array.isArray(data.workflows) ? data.workflows : [] };
}

/** @param {string} slug @param {string} workflowId */
export async function fetchWorkflowPlan(slug, workflowId) {
  const url = `/api/project/${encodeURIComponent(slug)}/workflow-plan/${encodeURIComponent(workflowId)}`;
  const res = await fetch(url);
  const data = await readJson(res);
  if (!res.ok) return failure(res, "Falha ao carregar o plano do workflow.", data);
  return { ok: true, plan: data };
}

/** @param {string} slug */
export async function fetchWorkflowRuns(slug) {
  const res = await fetch(`/api/orchestration/workflow-runs?slug=${encodeURIComponent(slug)}`);
  const data = await readJson(res);
  if (!res.ok) return failure(res, "Falha ao carregar as execuções.", data);
  return { ok: true, runs: Array.isArray(data.runs) ? data.runs : [] };
}

/**
 * @param {string} slug
 * @param {string} workflowId
 * @param {{ dryRun?: boolean, actor?: string }} [options]
 */
export async function startWorkflow(slug, workflowId, options = {}) {
  const url = `/api/project/${encodeURIComponent(slug)}/workflows/${encodeURIComponent(workflowId)}/runs`;
  return postJson(url, { dryRun: options.dryRun === true, actor: options.actor || "" });
}

/**
 * @param {string} executionId
 * @param {{ stageId?: string, status?: string, note?: string }} [options]
 */
export async function advanceWorkflowRun(executionId, options = {}) {
  const url = `/api/orchestration/workflow-runs/${encodeURIComponent(executionId)}/advance`;
  return postJson(url, {
    stageId: options.stageId || "",
    status: options.status || "completed",
    note: options.note || "",
  });
}

/** @param {string} executionId @param {{ reason?: string }} [options] */
export async function cancelWorkflowRun(executionId, options = {}) {
  const url = `/api/orchestration/workflow-runs/${encodeURIComponent(executionId)}/cancel`;
  return postJson(url, { reason: options.reason || "" });
}
