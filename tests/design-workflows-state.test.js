// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");

const MODULE = "../ui/public/js/modules/design-workflows-state.js";

test("workflows state: initial shape and workflow list transitions", async () => {
  const { createWorkflowsState, workflowsReducer } = await import(MODULE);
  const initial = createWorkflowsState();
  assert.deepEqual(initial.workflows, []);
  assert.equal(initial.workflowsStatus, "idle");
  assert.equal(initial.selectedWorkflowId, "");
  assert.equal(initial.plan, null);

  const loading = workflowsReducer(initial, { type: "workflows/loading" });
  assert.equal(loading.workflowsStatus, "loading");

  const loaded = workflowsReducer(loading, {
    type: "workflows/loaded",
    workflows: [{ id: "hotfix", label: "Hotfix" }],
  });
  assert.equal(loaded.workflowsStatus, "ready");
  assert.equal(loaded.workflows.length, 1);

  const invalid = workflowsReducer(loaded, { type: "workflows/loaded", workflows: "nope" });
  assert.deepEqual(invalid.workflows, []);

  const failed = workflowsReducer(loaded, { type: "workflows/error", error: "offline" });
  assert.equal(failed.workflowsStatus, "error");
  assert.equal(failed.workflowsError, "offline");
});

test("workflows state: selection resets plan and dry run", async () => {
  const { createWorkflowsState, workflowsReducer } = await import(MODULE);
  const base = {
    ...createWorkflowsState(),
    plan: { workflowId: "feature-delivery" },
    planStatus: "ready",
    dryRunPlan: { workflowId: "feature-delivery" },
    dryRunStatus: "ready",
  };
  const selected = workflowsReducer(base, { type: "workflow/select", workflowId: "hotfix" });
  assert.equal(selected.selectedWorkflowId, "hotfix");
  assert.equal(selected.plan, null);
  assert.equal(selected.planStatus, "idle");
  assert.equal(selected.dryRunPlan, null);
  assert.equal(selected.dryRunStatus, "idle");
});

test("workflows state: plan, dry run and runs transitions", async () => {
  const { createWorkflowsState, workflowsReducer } = await import(MODULE);
  let state = createWorkflowsState();

  state = workflowsReducer(state, { type: "plan/loading" });
  assert.equal(state.planStatus, "loading");
  state = workflowsReducer(state, { type: "plan/loaded", plan: { stages: [] } });
  assert.equal(state.planStatus, "ready");
  assert.deepEqual(state.plan, { stages: [] });
  state = workflowsReducer(state, { type: "plan/loaded", plan: "bad" });
  assert.equal(state.plan, null);
  state = workflowsReducer(state, { type: "plan/error", error: "404" });
  assert.equal(state.planStatus, "error");
  assert.equal(state.planError, "404");

  state = workflowsReducer(state, { type: "dryRun/loading" });
  assert.equal(state.dryRunStatus, "loading");
  state = workflowsReducer(state, { type: "dryRun/loaded", plan: { stages: [] } });
  assert.equal(state.dryRunStatus, "ready");
  state = workflowsReducer(state, { type: "dryRun/error", error: "403" });
  assert.equal(state.dryRunStatus, "error");
  assert.equal(state.dryRunPlan, null);
  assert.equal(state.dryRunError, "403");

  state = workflowsReducer(state, { type: "runs/loaded", runs: [{ executionId: "wf-1" }] });
  assert.equal(state.runsStatus, "ready");
  assert.equal(state.runs.length, 1);
  state = workflowsReducer(state, { type: "runs/error", error: "500" });
  assert.equal(state.runsStatus, "error");
  assert.equal(state.runsError, "500");
});

test("workflows state: notice is bounded and unknown actions keep identity", async () => {
  const { createWorkflowsState, workflowsReducer } = await import(MODULE);
  const state = createWorkflowsState();
  const noticed = workflowsReducer(state, { type: "notice", message: "x".repeat(400) });
  assert.equal(noticed.notice.length, 300);
  assert.equal(workflowsReducer(state, { type: "unknown/action" }), state);
  assert.deepEqual(workflowsReducer(null, { type: "unknown/action" }), createWorkflowsState());
});
