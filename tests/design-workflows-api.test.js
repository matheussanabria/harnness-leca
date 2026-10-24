// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");

const MODULE = "../ui/public/js/modules/design-workflows-api.js";

function fakeFetch(handler) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return handler(String(url), options);
  };
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

test("workflows api: catalog, plan and runs use GET with encoded identifiers", async () => {
  const api = await import(MODULE);
  const fake = fakeFetch(() => jsonResponse({ workflows: [{ id: "hotfix" }] }));
  try {
    const workflows = await api.fetchWorkflows();
    assert.equal(fake.calls[0].url, "/api/orchestration/workflows");
    assert.equal(fake.calls[0].options, undefined);
    assert.deepEqual(workflows.workflows, [{ id: "hotfix" }]);

    const plan = await api.fetchWorkflowPlan("meu projeto/1", "feature-delivery");
    assert.equal(fake.calls[1].url, "/api/project/meu%20projeto%2F1/workflow-plan/feature-delivery");
    assert.equal(fake.calls[1].options, undefined);
    assert.equal(plan.ok, true);

    const runs = await api.fetchWorkflowRuns("meu projeto");
    assert.equal(fake.calls[2].url, "/api/orchestration/workflow-runs?slug=meu%20projeto");
    assert.equal(fake.calls[2].options, undefined);
    assert.deepEqual(runs.runs, []);
  } finally {
    fake.restore();
  }
});

test("workflows api: start sends dryRun and actor in a POST body", async () => {
  const api = await import(MODULE);
  const fake = fakeFetch(() => jsonResponse({ ok: true, dryRun: true, plan: { stages: [] } }));
  try {
    const result = await api.startWorkflow("projeto", "hotfix", { dryRun: true, actor: "interface" });
    const call = fake.calls[0];
    assert.equal(call.url, "/api/project/projeto/workflows/hotfix/runs");
    assert.equal(call.options.method, "POST");
    assert.equal(call.options.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(call.options.body), { dryRun: true, actor: "interface" });
    assert.equal(result.ok, true);
    assert.equal(result.data.dryRun, true);
  } finally {
    fake.restore();
  }
});

test("workflows api: advance and cancel use POST with defaults", async () => {
  const api = await import(MODULE);
  const fake = fakeFetch(() => jsonResponse({ ok: true, run: { executionId: "wf-1" } }));
  try {
    await api.advanceWorkflowRun("wf-1", { stageId: "dev", status: "completed", note: "ok" });
    assert.equal(fake.calls[0].url, "/api/orchestration/workflow-runs/wf-1/advance");
    assert.equal(fake.calls[0].options.method, "POST");
    assert.deepEqual(JSON.parse(fake.calls[0].options.body), { stageId: "dev", status: "completed", note: "ok" });

    await api.cancelWorkflowRun("wf-1", { reason: "mudou" });
    assert.equal(fake.calls[1].url, "/api/orchestration/workflow-runs/wf-1/cancel");
    assert.deepEqual(JSON.parse(fake.calls[1].options.body), { reason: "mudou" });
  } finally {
    fake.restore();
  }
});

test("workflows api: refused start returns the server error text", async () => {
  const api = await import(MODULE);
  const fake = fakeFetch(() => jsonResponse({ error: "Início de execução restrito ao host local." }, false, 403));
  try {
    const refused = await api.startWorkflow("projeto", "hotfix");
    assert.equal(refused.ok, false);
    assert.equal(refused.status, 403);
    assert.equal(refused.data.error, "Início de execução restrito ao host local.");

    const plan = await api.fetchWorkflowPlan("projeto", "hotfix");
    assert.equal(plan.ok, false);
    assert.equal(plan.error, "Início de execução restrito ao host local.");
  } finally {
    fake.restore();
  }
});
