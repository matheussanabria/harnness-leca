// @ts-check
// Pure builder of the prompt that "Executar etapa" injects into the chat: one stage of a workflow run,
// with the delivery context (seed, story), the stage agents/skills and the exit gate. No I/O.

/**
 * @param {{ workflowId: string, executionId: string, meta?: { seed?: string, storyKey?: string } }} run
 * @param {any} stage plan stage ({ id, label, agents, skills, writes, gate, requiresApproval, permissions }) or null
 * @param {{ id: string, label: string } | null} [previous] last completed stage, for continuity
 * @returns {string}
 */
function buildStagePrompt(run, stage, previous = null) {
  const meta = run.meta || {};
  const label = stage ? stage.label : "";
  const lines = [`Workflow ${run.workflowId} (execução ${run.executionId}) - executar a etapa "${label}".`];

  if (meta.seed) lines.push("", `Contexto da entrega: ${meta.seed}`);
  if (meta.storyKey) lines.push(`História do Scrum: ${meta.storyKey}`);
  if (previous) lines.push(`Etapa anterior concluída: ${previous.label}.`);

  if (stage) {
    const agents = (stage.agents || []).map((agent) => agent.label || agent.id).filter(Boolean);
    const skills = (stage.skills || []).filter((skill) => skill.available || skill.globalAvailable).map((skill) => skill.name);
    if (agents.length) lines.push("", `Agentes da etapa: ${agents.join(", ")}.`);
    if (skills.length) lines.push(`Skills da etapa: ${skills.join(", ")}.`);
    if (stage.gate) lines.push(`Critério de saída (gate): ${stage.gate}.`);
    if (stage.requiresApproval) lines.push("Esta etapa exige aprovação do usuário antes de avançar.");
    if (stage.permissions && stage.permissions.write === false) lines.push("Esta etapa é somente leitura: não altere arquivos.");
  }

  lines.push(
    "",
    "Execute somente esta etapa e pare. Ao terminar, resuma o que foi produzido e o que falta para o gate.",
    "Não avance para a próxima etapa: o usuário conclui a etapa pelo cartão do workflow.",
  );
  return lines.join("\n");
}

module.exports = { buildStagePrompt };
