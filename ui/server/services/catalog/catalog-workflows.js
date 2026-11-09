// @ts-check
// Reads workflows from workflow sources and canonical definitions for the global catalog.
const fs = require("fs");
const path = require("path");
const { getWorkflow, listWorkflows } = require("../orchestration/workflow-definitions");
const { getStage } = require("../orchestration/agent-stage-catalog");

const SKIP_FOLDERS = new Set(["node_modules", ".git", "_template", "00-workflow-architecture"]);

function enrichStages(stageIds) {
  return (stageIds || []).map((stageRef) => {
    const stageId = typeof stageRef === "string" ? stageRef : stageRef.id;
    const stage = getStage(stageId);
    return {
      id: stageId,
      label: stage ? stage.label : (stageRef.label || stageId),
      order: stage ? stage.order : (typeof stageRef.order === "number" ? stageRef.order : -1),
      gate: stage ? stage.gate : (stageRef.gate || ""),
      agents: stage ? stage.agents.map((a) => ({ ...a })) : [],
      skills: stage ? [...stage.skills] : [],
      requiresApproval: stageRef.requiresApproval === true,
      permissions: stageRef.permissions || { read: true, write: false, exec: false },
    };
  });
}

function parseMarkdownDescription(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || line.startsWith(">") || line.startsWith("```")) continue;
      return line.slice(0, 200);
    }
  } catch {
    // fallback
  }
  return "";
}

function readWorkflowFromDir(dir, name, source) {
  const workflowFile = path.join(dir, "WORKFLOW.md");
  const manifestFile = path.join(dir, "manifest.yaml");
  if (!fs.existsSync(workflowFile) && !fs.existsSync(manifestFile)) return null;

  const canonical = getWorkflow(name);
  let label = canonical ? canonical.label : name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  let description = canonical ? canonical.description : "";

  if (!description && fs.existsSync(workflowFile)) {
    description = parseMarkdownDescription(workflowFile);
  }

  const stages = canonical ? enrichStages(canonical.stages) : [];
  const allAgents = Array.from(new Set(stages.flatMap((s) => s.agents.map((a) => a.id))));
  const allSkills = Array.from(new Set(stages.flatMap((s) => s.skills)));

  return {
    kind: "workflow",
    ref: name,
    name,
    label,
    description: description || "Workflow de execucao.",
    source: source.id,
    sourceLabel: source.label,
    scope: source.scope || "user",
    frontArea: "product",
    stageCount: stages.length,
    stages,
    agents: allAgents,
    skills: allSkills,
  };
}

function listWorkflowsFromSources(source) {
  if (!source || !source.dir || !fs.existsSync(source.dir)) return [];
  const out = [];
  try {
    for (const ent of fs.readdirSync(source.dir, { withFileTypes: true })) {
      if (!ent.isDirectory() || ent.name.startsWith(".") || SKIP_FOLDERS.has(ent.name)) continue;
      const item = readWorkflowFromDir(path.join(source.dir, ent.name), ent.name, source);
      if (item) out.push(item);
    }
  } catch {
    // unreadable directory
  }
  return out;
}

function builtinWorkflows(discovered = []) {
  const seenNames = new Set(discovered.map((w) => w.name));
  const out = [...discovered];
  for (const def of listWorkflows()) {
    if (seenNames.has(def.id)) continue;
    const detail = getWorkflow(def.id);
    const stages = detail ? enrichStages(detail.stages) : [];
    const allAgents = Array.from(new Set(stages.flatMap((s) => s.agents.map((a) => a.id))));
    const allSkills = Array.from(new Set(stages.flatMap((s) => s.skills)));
    out.push({
      kind: "workflow",
      ref: def.id,
      name: def.id,
      label: def.label,
      description: def.description,
      source: "harness",
      sourceLabel: "Harness (Built-in)",
      scope: "harness",
      frontArea: "product",
      stageCount: stages.length,
      stages,
      agents: allAgents,
      skills: allSkills,
    });
    seenNames.add(def.id);
  }
  return out;
}

module.exports = {
  enrichStages,
  readWorkflowFromDir,
  listWorkflowsFromSources,
  builtinWorkflows,
};

