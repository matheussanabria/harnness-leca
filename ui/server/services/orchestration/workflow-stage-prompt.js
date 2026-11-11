// @ts-check
// Pure builder of the prompt that "Executar etapa" injects into the chat: one stage of a workflow run,
// with the delivery context (seed, story), the stage agents/skills, where to write and what to read, and the gate.
// Two permission levels: "writes the dossier" (every stage, only the dossier folder) and "touches code / runs
// commands" (permissions.write). No I/O.

/**
 * Where the stage writes and reads. `output.path`/`inputs[].path` are shown relative to the repo.
 * @typedef {{ dossier: string, output: { file: string, path: string }, inputs: { file: string, path: string }[] }} DossierContext
 */

/** @param {any} stage @param {DossierContext | null | undefined} ctx @returns {string[]} */
function accessLines(stage, ctx) {
  const perms = stage.permissions || {};
  const writesCode = perms.write === true;
  const lines = [];
  if (ctx && ctx.dossier) {
    const feature = ctx.dossier.split("/").pop();
    lines.push("", `Dossiê da entrega: ${ctx.dossier}`);
    if (ctx.inputs && ctx.inputs.length) lines.push(`Leia antes: ${ctx.inputs.map((item) => item.path).join(", ")}.`);
    if (ctx.output && ctx.output.file) lines.push(`Grave o resultado desta etapa em ${ctx.output.path || `${ctx.dossier}/${ctx.output.file}`}.`);
    lines.push(
      writesCode
        ? `Esta etapa pode alterar código e executar comandos, em um worktree e uma branch próprios (feat/${feature}). Fora do código, grave só no dossiê.`
        : "Fora do dossiê, não altere arquivos nem código.",
    );
  } else if (!writesCode) {
    lines.push("", "Esta etapa não altera código: registre o resultado na resposta.");
  }
  return lines;
}

/**
 * @param {{ workflowId: string, executionId: string, meta?: { seed?: string, storyKey?: string } }} run
 * @param {any} stage plan stage ({ id, label, agents, skills, gate, requiresApproval, permissions }) or null
 * @param {{ id: string, label: string } | null} [previous] last completed stage, for continuity
 * @param {DossierContext | null} [ctx] dossier facts of this stage (optional)
 * @returns {string}
 */
function buildStagePrompt(run, stage, previous = null, ctx = null) {
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
    lines.push(...accessLines(stage, ctx));
  }

  lines.push(
    "",
    "Execute somente esta etapa e pare. Ao terminar, resuma o que foi produzido e o que falta para o gate.",
    "Não avance para a próxima etapa: o usuário conclui a etapa pelo cartão do workflow.",
  );
  return lines.join("\n");
}

module.exports = { buildStagePrompt };
