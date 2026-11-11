// @ts-check
// Chat command handler: lists workflows, resolves slugs against the catalog and starts a run (dossier).
// Runs one stage per request and stops at gates; the card tells the chat what to show.
const { listWorkflows, getWorkflow } = require("./workflow-definitions");
const { startWorkflowRun, advanceWorkflowRun } = require("./workflow-runner.service");
const { parseWorkflowCommand } = require("./workflow-command-parser");

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

function buildCard(run) {
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
    actions: current ? [{ id: awaiting ? "approve" : "advance", label: awaiting ? "Aprovar e avançar" : "Avançar etapa" }] : [],
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
  if (parsed.kind === "none") return fail(400, "Comando de workflow inválido.");

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
    const meta = { seed: parsed.description, storyKey: parsed.story, source: "chat" };
    const started = startWorkflowRun({ slug, projectDir, workflowId: workflow.id, actor: actor || "chat", meta, fromStage: parsed.from });
    let run = started.run;
    // Dossier creation is the "start" stage; resuming with --from skips it. Next stage (story) is seeded by meta.seed.
    if (!parsed.from && run.currentStage?.id === "start") {
      run = advanceWorkflowRun(run.executionId, { stageId: "start", status: "completed", note: "Dossiê criado pelo comando /workflow." }).run;
    }
    return { ok: true, kind: "start", run, card: buildCard(run) };
  } catch (err) {
    return fail(err.status || 500, err.message || "Falha ao iniciar o workflow.");
  }
}

module.exports = { runWorkflowCommand, listCommandSuggestions, buildCard };
