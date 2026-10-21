// @ts-check
// Controller dos pipelines de deploy (EP-10.01).
const { send, readJsonBody } = require("../config");
const netLib = require("../../../tools/lib/network");
const { readPipelines, writePipelines, readPipelineRuns } = require("../services/deploy/pipeline-store");
const { normalizePipeline, fail } = require("../services/deploy/pipeline-definitions");
const { listPipelines, runPipeline } = require("../services/deploy/pipeline-runner.service");
const { loadDeployConfig, findEnvironment } = require("../services/deploy/deploy-config.service");

function respondError(res, err) {
  return send(res, err.status || 500, { error: err.message || "Falha na operacao." });
}

/** GET /api/deploy/pipelines */
function apiDeployPipelines({ res, url }) {
  try {
    const limit = Number(url.searchParams.get("limit") || 50) || 50;
    return send(res, 200, listPipelines({ limit }));
  } catch (err) {
    return respondError(res, err);
  }
}

/** POST /api/deploy/pipelines */
async function apiDeployPipelinesSave({ req, res }) {
  if (!netLib.isLocalhostRequest(req)) {
    return send(res, 403, { error: "Gravacao de pipelines restrita ao host local." });
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON invalido" });
  }
  if (!body || typeof body !== "object") return send(res, 400, { error: "JSON invalido" });
  try {
    const incoming = Array.isArray(body.pipelines) ? body.pipelines : [body.pipeline];
    const pipelines = incoming.filter(Boolean).map(normalizePipeline);
    if (!pipelines.length) throw fail(400, "Nenhum pipeline informado.");
    const config = loadDeployConfig();
    for (const pipeline of pipelines) {
      if (!pipeline.stages.some((stage) => stage.type === "webhook")) continue;
      const found = findEnvironment(config, pipeline.projectId, pipeline.envId);
      if (!found || !found.env.webhookUrl) {
        throw fail(400, "Ambiente sem webhook configurado para este pipeline.");
      }
    }
    const manifest = readPipelines();
    const merged = new Map(manifest.pipelines.map((item) => [item.id, item]));
    for (const pipeline of pipelines) merged.set(pipeline.id, pipeline);
    const list = [...merged.values()];
    if (!writePipelines(list)) throw fail(500, "Nao foi possivel gravar o manifesto de pipelines.");
    return send(res, 200, { ok: true, pipelines: list, totals: { pipelines: list.length } });
  } catch (err) {
    return respondError(res, err);
  }
}

/** POST /api/deploy/pipelines/:id/run */
async function apiDeployPipelineRun({ req, res, params: [pipelineId] }) {
  if (!netLib.isLocalhostRequest(req)) {
    return send(res, 403, { error: "Execucao de pipeline restrita ao host local." });
  }
  let body = {};
  try {
    body = (await readJsonBody(req)) || {};
  } catch {
    return send(res, 400, { error: "JSON invalido" });
  }
  try {
    const result = await runPipeline({
      pipelineId,
      confirm: body.confirm === true,
      actor: body.actor,
    });
    return send(res, 200, result);
  } catch (err) {
    return respondError(res, err);
  }
}

/** GET /api/deploy/pipelines/runs */
function apiDeployPipelineRuns({ res, url }) {
  try {
    const limit = Number(url.searchParams.get("limit") || 50) || 50;
    const pipelineId = url.searchParams.get("pipelineId") || "";
    const history = readPipelineRuns({ limit });
    const runs = pipelineId ? history.runs.filter((run) => run.pipelineId === pipelineId) : history.runs;
    return send(res, 200, { ok: true, runs, totals: { runs: runs.length, ...history.totals }, warnings: history.warnings });
  } catch (err) {
    return respondError(res, err);
  }
}

module.exports = {
  apiDeployPipelines,
  apiDeployPipelinesSave,
  apiDeployPipelineRun,
  apiDeployPipelineRuns,
};
