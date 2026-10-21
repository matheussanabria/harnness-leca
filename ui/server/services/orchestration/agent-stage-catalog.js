// @ts-check
// Fachada do catálogo de etapas do SDLC e agentes associados (EP-08.02).
// Módulo puro: sem I/O, sem leitura de arquivo, ambiente ou projeto.
const {
  DAI_AGENTS,
  BUILTIN_AGENTS,
  STAGES,
  SESSION_EXECUTOR,
} = require("./agent-stage-definitions");

const STAGE_CATALOG_VERSION = 1;

const DAI_AGENT_SET = new Set(DAI_AGENTS);
const STAGE_INDEX = new Map(STAGES.map((stage) => [stage.id, stage]));

function buildAgentIndex() {
  const index = {};
  for (const stage of STAGES) {
    for (const agent of stage.agents) {
      if (!index[agent.id]) {
        index[agent.id] = { id: agent.id, label: agent.label, builtin: Boolean(agent.builtin), stages: [] };
      }
      index[agent.id].stages.push(stage.id);
    }
  }
  return index;
}

const AGENT_INDEX = buildAgentIndex();

function getAgentStageCatalog({ now = new Date() } = {}) {
  return {
    version: STAGE_CATALOG_VERSION,
    checkedAt: now.toISOString(),
    stages: STAGES.map((stage) => ({
      ...stage,
      executors: [...stage.executors],
      agents: stage.agents.map((agent) => ({ ...agent })),
      skills: [...stage.skills],
      writes: [...stage.writes],
    })),
    agents: Object.fromEntries(Object.entries(AGENT_INDEX).map(([id, entry]) => [id, { ...entry, stages: [...entry.stages] }])),
  };
}

function isValidStage(stageId) {
  return STAGE_INDEX.has(stageId);
}

function getStage(stageId) {
  const stage = STAGE_INDEX.get(stageId);
  return stage ? { ...stage, agents: stage.agents.map((agent) => ({ ...agent })) } : null;
}

function agentsForStage(stageId) {
  const stage = STAGE_INDEX.get(stageId);
  if (!stage) return null;
  return stage.agents.map((agent) => ({ ...agent }));
}

function stagesForAgent(agentId) {
  const entry = AGENT_INDEX[agentId];
  return entry ? [...entry.stages] : [];
}

function isKnownAgent(agentId) {
  return DAI_AGENT_SET.has(agentId) || BUILTIN_AGENTS.includes(agentId);
}

module.exports = {
  STAGE_CATALOG_VERSION,
  SESSION_EXECUTOR,
  getAgentStageCatalog,
  getStage,
  agentsForStage,
  stagesForAgent,
  isValidStage,
  isKnownAgent,
};
