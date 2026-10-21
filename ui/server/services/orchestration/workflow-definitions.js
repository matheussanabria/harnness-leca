// @ts-check
// Definições canônicas dos workflows de execução (EP-08.04).
// Fonte da ordem e dos gates: catálogo de etapas do SDLC (EP-08.02). Somente dados, sem I/O.
const { STAGES } = require("./agent-stage-definitions");

const STAGE_IDS = Object.freeze(STAGES.map((stage) => stage.id));

// Etapas que escrevem no repositório ou executam processos.
const WRITE_STAGES = new Set(["dev", "tests", "commit-pr", "deploy"]);
// Etapas que exigem confirmação explícita antes de seguir.
const APPROVAL_STAGES = new Set(["prototype", "commit-pr", "deploy"]);
// Atalho de correção pontual: subconjunto ordenado do fluxo completo.
const HOTFIX_STAGE_IDS = Object.freeze(["start", "dev", "tests", "review", "commit-pr", "deploy"]);

const WORKFLOW_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "feature-delivery",
    label: "Feature Delivery",
    description: "Fluxo completo de entrega: da história ao deploy.",
    stages: STAGE_IDS,
  }),
  Object.freeze({
    id: "hotfix",
    label: "Hotfix",
    description: "Atalho de correção pontual, sem protótipo nem modelagem.",
    stages: HOTFIX_STAGE_IDS,
  }),
]);

const WORKFLOW_INDEX = new Map(WORKFLOW_DEFINITIONS.map((workflow) => [workflow.id, workflow]));

function stagePolicy(stageId) {
  return {
    stageId,
    permissions: { read: true, write: WRITE_STAGES.has(stageId), exec: WRITE_STAGES.has(stageId) },
    requiresApproval: APPROVAL_STAGES.has(stageId),
    mode: "local",
  };
}

function workflowDetail(workflow) {
  return {
    id: workflow.id,
    label: workflow.label,
    description: workflow.description,
    stageCount: workflow.stages.length,
    stages: workflow.stages.map((stageId) => {
      const stage = STAGES.find((item) => item.id === stageId);
      return {
        id: stageId,
        label: stage ? stage.label : stageId,
        order: stage ? stage.order : -1,
        gate: stage ? stage.gate : "",
        ...stagePolicy(stageId),
      };
    }),
  };
}

function listWorkflows() {
  return WORKFLOW_DEFINITIONS.map((workflow) => ({
    id: workflow.id,
    label: workflow.label,
    description: workflow.description,
    stageCount: workflow.stages.length,
  }));
}

function getWorkflow(workflowId) {
  const workflow = WORKFLOW_INDEX.get(String(workflowId || "").trim());
  return workflow ? workflowDetail(workflow) : null;
}

function isValidWorkflow(workflowId) {
  return WORKFLOW_INDEX.has(String(workflowId || "").trim());
}

function getWorkflowStageIds(workflowId) {
  const workflow = WORKFLOW_INDEX.get(String(workflowId || "").trim());
  return workflow ? [...workflow.stages] : [];
}

module.exports = {
  APPROVAL_STAGES,
  WRITE_STAGES,
  STAGE_IDS,
  stagePolicy,
  listWorkflows,
  getWorkflow,
  isValidWorkflow,
  getWorkflowStageIds,
};
