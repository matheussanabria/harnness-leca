// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");

const MODULE = "../ui/public/js/modules/design-workflows-view.js";

function planFixture() {
  return {
    workflow: { id: "feature-delivery", label: "Feature Delivery" },
    workflowId: "feature-delivery",
    totals: { stages: 2, skillsRequired: 2, skillsAvailable: 1, skillsMissing: 1, approvalsRequired: 1, writes: 1 },
    warnings: ["1 skill(s) das etapas não existem no catálogo do projeto."],
    stages: [
      {
        id: "bdd",
        label: "BDD <script>alert(1)</script>",
        order: 2,
        executors: ["qa-engineer"],
        agents: [{ id: "qa-engineer", label: "QA Engineer", role: "executor" }],
        skills: [
          { name: "bdd-scenarios", available: true, bound: true },
          { name: "api-security", available: false, bound: false },
        ],
        gate: "Gate <b>forte</b>",
        permissions: { read: true, write: false, exec: false },
        requiresApproval: true,
      },
      {
        id: "start",
        label: "Início",
        order: 0,
        executors: ["sessao"],
        agents: [],
        skills: [],
        gate: "Dossiê criado",
        permissions: { read: true, write: false, exec: false },
        requiresApproval: false,
      },
    ],
  };
}

test("workflows view: renders stages in order with agent, gate, permissions and skills", async () => {
  const { renderPlan } = await import(MODULE);
  const html = renderPlan(planFixture());
  assert.match(html, /Feature Delivery/);
  assert.match(html, /QA Engineer/);
  assert.match(html, /Aprovação obrigatória/);
  assert.match(html, /Permissões: leitura/);
  assert.match(html, /bdd-scenarios/);
  assert.match(html, /disponível e vinculada/);
  assert.match(html, /1 skill\(s\) ausente\(s\) no projeto\./);
  assert.ok(html.indexOf("Início") < html.indexOf("BDD"), "Stages must be sorted by order.");
});

test("workflows view: missing skill is marked and API text is escaped", async () => {
  const { renderPlan } = await import(MODULE);
  const html = renderPlan(planFixture());
  assert.match(html, /api-security/);
  assert.match(html, /ausente no projeto/);
  assert.match(html, /workflow-skill is-missing/);
  assert.match(html, /Gate &lt;b&gt;forte&lt;\/b&gt;/);
  assert.match(html, /BDD &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes("<b>forte</b>"), false);
});

test("workflows view: shell exposes loading, empty and error states", async () => {
  const { renderWorkflowsShell } = await import(MODULE);
  const state = {
    workflows: [],
    workflowsStatus: "error",
    workflowsError: "offline",
    selectedWorkflowId: "",
    plan: null,
    planStatus: "idle",
    planError: "",
    dryRunStatus: "idle",
    dryRunPlan: null,
    dryRunError: "",
    runs: [],
    runsStatus: "loading",
    runsError: "",
    notice: "",
  };
  const html = renderWorkflowsShell(state, "projeto");
  assert.match(html, /Falha ao carregar workflows|offline/);
  assert.match(html, /Selecione um workflow/);
  assert.match(html, /Carregando execuções/);
  assert.match(html, /fa-solid fa-diagram-project/);
});
