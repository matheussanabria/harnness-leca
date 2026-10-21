// @ts-check
// Controller do catálogo de etapas do SDLC e agentes associados (EP-08.02).
const { send } = require("../config");
const { getAgentStageCatalog } = require("../services/orchestration/agent-stage-catalog");

/**
 * GET /api/orchestration/agent-stages
 * Retorna o catálogo versionado de etapas e o índice invertido de agentes.
 */
function apiOrchestrationAgentStages({ res }) {
  return send(res, 200, getAgentStageCatalog());
}

/**
 * GET /api/orchestration/agent-stages/:stage
 * Retorna uma etapa específica com o mesmo `checkedAt` do catálogo.
 */
function apiOrchestrationAgentStage({ res, params: [stageId] }) {
  const catalog = getAgentStageCatalog();
  const stage = catalog.stages.find((item) => item.id === stageId);
  if (!stage) return send(res, 404, { error: "Etapa do SDLC não encontrada" });
  return send(res, 200, {
    version: catalog.version,
    checkedAt: catalog.checkedAt,
    stage,
  });
}

module.exports = {
  apiOrchestrationAgentStages,
  apiOrchestrationAgentStage,
};
