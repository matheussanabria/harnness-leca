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
    kind: "start", slug: "feature-delivery", description: "Cadastro de cliente", story: "US-9", from: "bdd",
  });
  assert.deepEqual(parseWorkflowCommand("/workflows feature-delivery Cadastro"), { kind: "start", slug: "feature-delivery", description: "Cadastro", story: "", from: "" }); // plural alias
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
  assert.equal(out.card.actions[0].id, "approve");
  assert.equal(out.run.stages[0].status, "skipped");
  const bad = runWorkflowCommand({ slug: SLUG, projectDir, text: "/workflow feature-delivery x --from zzz" });
  assert.equal(bad.ok, false);
});

test("suggestions come from the catalog", () => {
  const s = listCommandSuggestions();
  assert.deepEqual(s.workflows.map((w) => w.slug).sort(), ["feature-delivery", "hotfix"].sort());
  assert.ok(s.commands.some((c) => c.command === "/workflows"));
});
