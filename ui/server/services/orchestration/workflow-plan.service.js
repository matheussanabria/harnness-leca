// @ts-check
// Plano de execução de um workflow para um projeto (EP-08.04).
// Combina o catálogo de etapas (08.02), as skills reais do projeto e os vínculos de raia (08.03).
const { getStage } = require("./agent-stage-catalog");
const { getWorkflow } = require("./workflow-definitions");
const { buildBindingReport } = require("../skill-bindings.service");
const { getCanonicalLanes } = require("../project-scrum-lanes");
const { listProjectSkills } = require("../../../../tools/lib/skills");

function fail(status, message) {
  const error = new Error(message);
  // @ts-ignore
  error.status = status;
  return error;
}

function normalizeLane(value, lanes) {
  const id = String(value || "").trim();
  if (!id) return "";
  return lanes.some((lane) => lane.id === id) ? id : null;
}

function projectSkillKeys(slug) {
  const catalog = listProjectSkills(slug);
  const byName = new Map();
  const keys = new Set();
  for (const skill of catalog.skills || []) {
    const key = `${skill.targetId}:${skill.name}`;
    keys.add(key);
    if (!byName.has(skill.name)) byName.set(skill.name, []);
    byName.get(skill.name).push(key);
  }
  return { byName, keys };
}

function resolveSkill(name, byName, bound) {
  const candidates = byName.get(name) || [];
  const key = bound ? candidates.find((item) => bound.has(item)) : undefined;
  if (key) return { name, key, available: true, bound: true };
  if (bound) {
    if (candidates.length) return { name, key: candidates[0], available: true, bound: false };
    return { name, key: "", available: false, bound: false };
  }
  return candidates.length
    ? { name, key: candidates[0], available: true, bound: true }
    : { name, key: "", available: false, bound: true };
}

function buildWorkflowPlan({ slug, projectDir, workflowId, laneId }) {
  const workflow = getWorkflow(workflowId);
  if (!workflow) throw fail(404, "Workflow desconhecido.");

  const lanes = getCanonicalLanes();
  const resolvedLane = normalizeLane(laneId, lanes);
  if (resolvedLane === null) throw fail(400, "Raia do Scrum não encontrada.");

  const { byName, keys } = projectSkillKeys(slug);
  const bound = resolvedLane
    ? new Set(buildBindingReport(projectDir, lanes, keys).items[resolvedLane] || [])
    : null;

  const totals = {
    stages: workflow.stages.length,
    skillsRequired: 0,
    skillsAvailable: 0,
    skillsMissing: 0,
    skillsUnbound: 0,
    approvalsRequired: 0,
    writes: 0,
  };

  const stages = workflow.stages.map((stageRef) => {
    const stage = getStage(stageRef.id);
    const skills = (stage ? stage.skills : []).map((name) => {
      const item = resolveSkill(name, byName, bound);
      totals.skillsRequired += 1;
      if (!item.available) totals.skillsMissing += 1;
      else if (!item.bound) totals.skillsUnbound += 1;
      if (item.available) totals.skillsAvailable += 1;
      return item;
    });
    if (stageRef.requiresApproval) totals.approvalsRequired += 1;
    if (stageRef.permissions.write) totals.writes += 1;
    return {
      id: stageRef.id,
      label: stage ? stage.label : stageRef.label,
      order: stage ? stage.order : -1,
      executors: stage ? [...stage.executors] : [],
      agents: stage ? stage.agents.map((agent) => ({ ...agent })) : [],
      skills,
      writes: stage ? [...stage.writes] : [],
      gate: stageRef.gate,
      mode: stageRef.mode,
      permissions: { ...stageRef.permissions },
      requiresApproval: stageRef.requiresApproval,
    };
  });

  const warnings = [];
  if (totals.skillsMissing) {
    warnings.push(`${totals.skillsMissing} skill(s) das etapas não existem no catálogo do projeto.`);
  }
  if (totals.skillsUnbound) {
    warnings.push(`${totals.skillsUnbound} skill(s) das etapas não estão vinculadas à raia '${resolvedLane}'.`);
  }
  if (!keys.size) warnings.push("O projeto não expõe catálogo de skills.");

  return {
    ok: true,
    slug,
    workflowId: workflow.id,
    laneId: resolvedLane || "",
    workflow: { id: workflow.id, label: workflow.label, description: workflow.description, stageCount: workflow.stageCount },
    stages,
    totals,
    warnings,
  };
}

module.exports = { buildWorkflowPlan };
