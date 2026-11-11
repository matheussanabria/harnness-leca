// @ts-check
const os = require("os");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { removeDir } = require("./helpers/temp-dir");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-wfcmd-"));
process.env.HARNESS_ROOT = TMP_ROOT;
const SLUG = "projeto-teste";
const projectDir = path.join(TMP_ROOT, "projects", SLUG);
fs.mkdirSync(projectDir, { recursive: true });
const { closeStore } = require("../ui/server/services/events/event-store");
test.after(() => {
  closeStore(SLUG);
  removeDir(TMP_ROOT);
});

const { parseWorkflowCommand, isWorkflowCommand } = require("../ui/server/services/orchestration/workflow-command-parser");
const { runWorkflowCommand, listCommandSuggestions } = require("../ui/server/services/orchestration/workflow-command.service");
const { listWorkflowRuns } = require("../ui/server/services/orchestration/workflow-runner.service");

test("parser: list, start with flags, and non-commands", () => {
  assert.deepEqual(parseWorkflowCommand("/workflows"), { kind: "list" });
  assert.deepEqual(parseWorkflowCommand("/workflow feature-delivery Cadastro de cliente --story US-9 --from=bdd"), {
    kind: "start", slug: "feature-delivery", description: "Cadastro de cliente", story: "US-9", from: "bdd", visual: false,
  });
  assert.deepEqual(parseWorkflowCommand("/workflows feature-delivery Cadastro"), { kind: "start", slug: "feature-delivery", description: "Cadastro", story: "", from: "", visual: false }); // plural alias
  assert.equal(parseWorkflowCommand("oi /workflow").kind, "none");
  assert.equal(parseWorkflowCommand("/workflowx a").kind, "none");
  assert.equal(isWorkflowCommand("/workflow"), true);
  assert.equal(parseWorkflowCommand("/workflow").kind, "start");
});

test("list returns catalog workflows with stages", () => {
  const out = runWorkflowCommand({ slug: SLUG, projectDir, text: "/workflows" });
  assert.equal(out.ok, true);
  const feature = out.workflows.find((w) => w.id === "feature-delivery");
  assert.ok(feature.stages.length > 3);
});

test("invalid slug returns valid slugs and creates no run", () => {
  const before = listWorkflowRuns(SLUG).length;
  const out = runWorkflowCommand({ slug: SLUG, projectDir, text: "/workflow nada algo" });
  assert.equal(out.ok, false);
  assert.equal(out.status, 404);
  assert.ok(out.validSlugs.includes("feature-delivery"));
  assert.match(out.error, /feature-delivery/);
  assert.equal(listWorkflowRuns(SLUG).length, before);
});

test("start creates dossier, completes start and seeds the story stage", () => {
  const out = runWorkflowCommand({ slug: SLUG, projectDir, text: "/workflow feature-delivery Cadastro de cliente --story US-9" });
  assert.equal(out.ok, true);
  assert.equal(out.card.stageId, "story");
  assert.equal(out.card.seed, "Cadastro de cliente");
  assert.equal(out.card.storyKey, "US-9");
  assert.equal(out.run.stages[0].status, "completed");
  assert.ok(listWorkflowRuns(SLUG).some((r) => r.executionId === out.run.executionId));
});

test("--from resumes at a stage and the gate card asks for approval", () => {
  const out = runWorkflowCommand({ slug: SLUG, projectDir, text: "/workflow feature-delivery x --from prototype" });
  assert.equal(out.ok, true);
  assert.equal(out.card.stageId, "prototype");
  assert.equal(out.card.gate, true);
  assert.deepEqual(out.card.actions.map((a) => a.id), ["run", "cancel"]);
  assert.deepEqual(out.card.actionsAfterRun.map((a) => a.id), ["run", "approve", "cancel"]);
  assert.equal(out.run.stages[0].status, "skipped");
  const bad = runWorkflowCommand({ slug: SLUG, projectDir, text: "/workflow feature-delivery x --from zzz" });
  assert.equal(bad.ok, false);
});

test("suggestions come from the catalog", () => {
  const s = listCommandSuggestions();
  assert.deepEqual(s.workflows.map((w) => w.slug).sort(), ["feature-delivery", "hotfix", "rota-curta"].sort());
  assert.ok(s.commands.some((c) => c.command === "/workflows"));
});

test("start without a description is refused and creates no run", () => {
  const before = listWorkflowRuns().length;
  const out = runWorkflowCommand({ slug: SLUG, projectDir, text: "/workflow feature-delivery" });
  assert.equal(out.ok, false);
  assert.equal(out.status, 400);
  assert.match(out.error, /Descreva o que quer entregar/);
  assert.equal(listWorkflowRuns().length, before);
});

test("the card always offers cancel next to the primary action", () => {
  const out = runWorkflowCommand({ slug: SLUG, projectDir, text: "/workflow feature-delivery Teste do cancelar" });
  assert.equal(out.ok, true);
  assert.deepEqual(out.card.actions.map((a) => a.id), ["run", "cancel"]); // no conclude before the stage ran
  assert.deepEqual(out.card.actionsAfterRun.map((a) => a.id), ["run", "advance", "cancel"]);
  assert.equal(out.card.executed, false);
});

test("stage prompt carries the delivery context, the stage gate and the stop rule", () => {
  const { buildStagePrompt } = require("../ui/server/services/orchestration/workflow-stage-prompt");
  const run = { workflowId: "feature-delivery", executionId: "wf-1", meta: { seed: "Cadastro de cliente", storyKey: "US-9" } };
  const stage = { label: "História", gate: "Critérios de aceite verificáveis", agents: [{ id: "business-analyst", label: "Business Analyst" }], skills: [{ name: "spec-templates", available: true }, { name: "ausente", available: false }], requiresApproval: false, permissions: { write: true } };
  const text = buildStagePrompt(run, stage, { id: "start", label: "Início" });
  assert.match(text, /executar a etapa "História"/);
  assert.match(text, /Cadastro de cliente/);
  assert.match(text, /US-9/);
  assert.match(text, /Business Analyst/);
  assert.match(text, /spec-templates/);
  assert.doesNotMatch(text, /ausente/);
  assert.match(text, /Critérios de aceite verificáveis/);
  assert.match(text, /Execute somente esta etapa e pare/);
});

test("the card exposes run, conclude and cancel, with the stage prompt and a refreshable card by execution", () => {
  const { cardForExecution } = require("../ui/server/services/orchestration/workflow-command.service");
  const out = runWorkflowCommand({ slug: SLUG, projectDir, text: "/workflow feature-delivery Contexto do prompt" });
  assert.equal(out.ok, true);
  assert.deepEqual(out.card.actions.map((a) => a.id), ["run", "cancel"]); // no conclude before the stage ran
  assert.deepEqual(out.card.actionsAfterRun.map((a) => a.id), ["run", "advance", "cancel"]);
  assert.equal(out.card.executed, false);
  assert.match(out.card.stagePrompt, /executar a etapa "História"/);
  assert.match(out.card.stagePrompt, /Contexto do prompt/);
  const again = cardForExecution(SLUG, projectDir, out.card.executionId);
  assert.equal(again.stageId, out.card.stageId);
  assert.equal(cardForExecution("outro-projeto", projectDir, out.card.executionId), null);
  assert.equal(cardForExecution(SLUG, projectDir, "wf-inexistente"), null);
});
