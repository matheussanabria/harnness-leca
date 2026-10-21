// @ts-check
// Logs de execucao de deploy: trechos de saida por estagio (EP-10.03).
const { readJsonLines, PIPELINE_RUNS_REL } = require("./deploy-timeline.service");

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 200;
const MAX_CHARS = 4000;

/**
 * Extrai os logs das execucoes de pipeline, na ordem real dos estagios.
 * @param {{ executionId?: string, projectId?: string, envId?: string, limit?: number }} [filters]
 * @returns {Object}
 */
function buildDeployLogs(filters = {}) {
  const source = readJsonLines(PIPELINE_RUNS_REL, "Historico de pipelines");
  const executionId = String(filters.executionId || "").trim();
  const projectId = String(filters.projectId || "").trim();
  const envId = String(filters.envId || "").trim();
  const limit = Math.min(Math.max(Number(filters.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  const runs = source.items.filter((run) => {
    if (executionId && String(run?.id || "") !== executionId) return false;
    if (projectId && String(run?.projectId || "") !== projectId) return false;
    if (envId && String(run?.envId || "") !== envId) return false;
    return true;
  });

  const executions = runs.slice(-limit).reverse().map((run) => {
    const stages = Array.isArray(run?.stages) ? run.stages : [];
    let chars = 0;
    const lines = [];
    for (const [index, stage] of stages.entries()) {
      const output = String(stage?.output || "");
      const remaining = Math.max(0, MAX_CHARS - chars);
      const snippet = output.slice(0, remaining);
      chars += snippet.length;
      lines.push({
        order: index,
        id: String(stage?.id || ""),
        name: String(stage?.name || stage?.id || ""),
        type: String(stage?.type || ""),
        status: String(stage?.status || ""),
        exitCode: stage?.exitCode,
        httpStatus: stage?.httpStatus,
        durationMs: Number(stage?.durationMs) || 0,
        endpoint: String(stage?.endpoint || ""),
        output: snippet,
        truncated: snippet.length < output.length,
      });
    }
    return {
      executionId: String(run?.id || ""),
      pipelineId: String(run?.pipelineId || ""),
      pipelineName: String(run?.pipelineName || ""),
      projectId: String(run?.projectId || ""),
      envId: String(run?.envId || ""),
      actor: String(run?.actor || ""),
      status: String(run?.status || ""),
      startedAt: String(run?.startedAt || ""),
      finishedAt: String(run?.finishedAt || ""),
      lines,
      truncated: chars >= MAX_CHARS,
    };
  });

  return {
    ok: true,
    executions,
    totals: { executions: executions.length, runs: runs.length },
    warnings: source.warnings,
  };
}

module.exports = { DEFAULT_LIMIT, MAX_LIMIT, MAX_CHARS, buildDeployLogs };
