// @ts-check
// Chat command handler: lists workflows, resolves slugs against the catalog and starts a run (dossier).
// Runs one stage per request and stops at gates; the card tells the chat what to show.
const { listWorkflows, getWorkflow } = require("./workflow-definitions");
const { startWorkflowRun, advanceWorkflowRun } = require("./workflow-runner.service");
const { parseWorkflowCommand } = require("./workflow-command-parser");
const { buildWorkflowPlan } = require("./workflow-plan.service");
const { buildStagePrompt } = require("./workflow-stage-prompt");
const { getRun, snapshot } = require("./workflow-run-store");

const COMMANDS = Object.freeze([
  { command: "/workflows", description: "Lista os workflows do catálogo com suas etapas." },
  { command: "/workflow", description: "Inicia um workflow: /workflow <slug> <descrição> [--story <chave>] [--from <etapa>]." },
]);

/** Single source of chat commands and slugs, derived from the workflow catalog (autocomplete). */
function listCommandSuggestions() {
  return {
    commands: COMMANDS.map((item) => ({ ...item })),
    workflows: listWorkflows().map((workflow) => ({ slug: workflow.id, label: workflow.label, description: workflow.description })),
  };
}

/** "Executar etapa" injects the stage context into the chat; the conclusion is a separate, explicit click. */
function cardActions(awaiting) {
  return [
    { id: "run", label: "Executar etapa" },
    { id: awaiting ? "approve" : "advance", label: awaiting ? "Aprovar e avançar" : "Concluir e avançar" },
    { id: "cancel", label: "Cancelar execução" },
  ];
}

/** Prompt for the current stage; a plan failure never breaks the card (generic prompt instead). */
function stagePromptFor(run, projectDir) {
  const current = run.currentStage;
  if (!current) return "";
  let stage = null;
  try {
    stage = buildWorkflowPlan({ slug: run.slug, projectDir, workflowId: run.workflowId }).stages.find((item) => item.id === current.id) || null;
  } catch {
    stage = null;
  }
  const done = (run.stages || []).filter((item) => item.status === "completed");
  const previous = done.length ? done[done.length - 1] : null;
  return buildStagePrompt(run, stage, previous);
}

function buildCard(run, projectDir = "") {
  const current = run.currentStage;
  const awaiting = Boolean(current && current.requiresApproval);
  return {
    executionId: run.executionId,
    workflowId: run.workflowId,
    status: run.status,
    stageId: current ? current.id : "",
    stageLabel: current ? current.label : "",
    gate: awaiting,
    awaitingApproval: awaiting,
    seed: run.meta?.seed || "",
    storyKey: run.meta?.storyKey || "",
    stagePrompt: projectDir ? stagePromptFor(run, projectDir) : "",
    actions: current ? cardActions(awaiting) : [],
  };
}

function fail(status, message, extra = {}) {
  return { ok: false, status, error: message, ...extra };
}

/**
 * @param {{ slug: string, projectDir: string, text: string, actor?: string }} params
 */
function runWorkflowCommand({ slug, projectDir, text, actor }) {
  const parsed = parseWorkflowCommand(text);
  if (parsed.kind === "none") return fail(400, "Comando de workflow inválido. Use /workflows para listar ou /workflow <slug> <descrição> para iniciar.");

  if (parsed.kind === "list") {
    const workflows = listWorkflows().map((item) => getWorkflow(item.id)).filter(Boolean);
    return { ok: true, kind: "list", workflows };
  }

  const validSlugs = listWorkflows().map((item) => item.id);
  const workflow = getWorkflow(parsed.slug);
  if (!workflow) {
    const given = parsed.slug ? `Workflow '${parsed.slug}' não existe.` : "Informe o slug do workflow.";
    return fail(404, `${given} Slugs válidos: ${validSlugs.join(", ")}.`, { validSlugs });
  }
  if (parsed.from && !workflow.stages.some((stage) => stage.id === parsed.from)) {
    return fail(400, `Etapa '${parsed.from}' não existe em '${workflow.id}'. Etapas: ${workflow.stages.map((s) => s.id).join(", ")}.`);
  }

  try {
    if (!parsed.description && !parsed.from) {
      return fail(400, `Descreva o que quer entregar: /workflow ${workflow.id} <descrição curta>.`);
    }
    const meta = { seed: parsed.description, storyKey: parsed.story, source: "chat" };
    const started = startWorkflowRun({ slug, projectDir, workflowId: workflow.id, actor: actor || "chat", meta, fromStage: parsed.from });
    let run = started.run;
    // Dossier creation is the "start" stage; resuming with --from skips it. Next stage (story) is seeded by meta.seed.
    if (!parsed.from && run.currentStage?.id === "start") {
      run = advanceWorkflowRun(run.executionId, { stageId: "start", status: "completed", note: "Dossiê criado pelo comando /workflow." }).run;
    }
    return { ok: true, kind: "start", run, card: buildCard(run, projectDir) };
  } catch (err) {
    return fail(err.status || 500, err.message || "Falha ao iniciar o workflow.");
  }
}

/** Fresh card for a run (after the user advanced a stage); null when the run is unknown (e.g. server restarted). */
function cardForExecution(slug, projectDir, executionId) {
  const run = getRun(executionId);
  if (!run || run.slug !== slug) return null;
  return buildCard(snapshot(run), projectDir);
}

module.exports = { runWorkflowCommand, listCommandSuggestions, buildCard, cardForExecution };
