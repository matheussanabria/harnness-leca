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
// Rota curta (ajuste pequeno): história e BDD obrigatórios; modelagem sempre dispensada; protótipo só com --visual.
const SHORT_ROUTE_STAGE_IDS = Object.freeze(["start", "story", "bdd", "prototype", "modeling", "dev", "tests", "review", "commit-pr"]);
const SHORT_ROUTE_RULE = "até 3 arquivos, sem tela nova, sem mudança de contrato";

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
  Object.freeze({
    id: "rota-curta",
    label: "Rota curta",
    description: `Ajuste pequeno (${SHORT_ROUTE_RULE}): história, BDD, desenvolvimento, testes, revisão e commit. Protótipo só com --visual.`,
    stages: SHORT_ROUTE_STAGE_IDS,
    // Dispensed stages are recorded as skipped with this reason. unlessFlag: the flag brings the stage back.
    dispensed: Object.freeze({
      modeling: Object.freeze({ reason: `Dispensada na rota curta (${SHORT_ROUTE_RULE})`, unlessFlag: "" }),
      prototype: Object.freeze({ reason: "Sem elemento visual novo (use --visual para incluir o protótipo)", unlessFlag: "visual" }),
    }),
  }),
]);

const WORKFLOW_INDEX = new Map(WORKFLOW_DEFINITIONS.map((workflow) => [workflow.id, workflow]));

function stagePolicy(stageId) {
  return {
    stageId,
    // dossier: every stage may write its file inside the feature dossier; write/exec = touches code or runs commands.
    permissions: { read: true, dossier: true, write: WRITE_STAGES.has(stageId), exec: WRITE_STAGES.has(stageId) },
    requiresApproval: APPROVAL_STAGES.has(stageId),
    mode: "local",
  };
}

/**
 * Stages a workflow dispenses for the given flags: { stageId: reason }. Pure.
 * @param {string} workflowId @param {{ [flag: string]: boolean }} [flags]
 */
function getDispensedStages(workflowId, flags = {}) {
  const workflow = WORKFLOW_INDEX.get(String(workflowId || "").trim());
  const rules = workflow && workflow.dispensed ? workflow.dispensed : {};
  /** @type {{ [stageId: string]: string }} */
  const out = {};
  for (const [stageId, rule] of Object.entries(rules)) {
    if (rule.unlessFlag && flags[rule.unlessFlag] === true) continue;
    out[stageId] = rule.reason;
  }
  return out;
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
        // Default dispensation shown in /workflows (a flag such as --visual can bring the stage back).
        dispensed: workflow.dispensed && workflow.dispensed[stageId] ? workflow.dispensed[stageId].reason : "",
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
  getDispensedStages,
};
