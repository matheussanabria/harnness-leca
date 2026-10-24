// @ts-check
// State reducer for the Workflows tab (EP-08.06).

export const WORKFLOWS_VIEW = "workflows";

function text(value, limit = 200) {
  return typeof value === "string" ? value.slice(0, limit) : "";
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

export function createWorkflowsState() {
  return {
    workflows: [],
    workflowsStatus: "idle",
    workflowsError: "",
    selectedWorkflowId: "",
    plan: null,
    planStatus: "idle",
    planError: "",
    dryRunStatus: "idle",
    dryRunPlan: null,
    dryRunError: "",
    runs: [],
    runsStatus: "idle",
    runsError: "",
    notice: "",
  };
}

/**
 * @param {any} state
 * @param {any} action
 */
export function workflowsReducer(state, action) {
  const current = record(state) || createWorkflowsState();
  const type = text(action?.type, 40);
  const error = text(action?.error, 300);
  switch (type) {
    case "workflows/loading":
      return { ...current, workflowsStatus: "loading", workflowsError: "" };
    case "workflows/loaded":
      return { ...current, workflowsStatus: "ready", workflows: list(action?.workflows), workflowsError: "" };
    case "workflows/error":
      return { ...current, workflowsStatus: "error", workflowsError: error };
    case "workflow/select":
      return {
        ...current,
        selectedWorkflowId: text(action?.workflowId, 120),
        plan: null,
        planStatus: "idle",
        planError: "",
        dryRunStatus: "idle",
        dryRunPlan: null,
        dryRunError: "",
      };
    case "plan/loading":
      return { ...current, planStatus: "loading", planError: "" };
    case "plan/loaded":
      return { ...current, planStatus: "ready", plan: record(action?.plan), planError: "" };
    case "plan/error":
      return { ...current, planStatus: "error", planError: error };
    case "dryRun/loading":
      return { ...current, dryRunStatus: "loading", dryRunError: "" };
    case "dryRun/loaded":
      return { ...current, dryRunStatus: "ready", dryRunPlan: record(action?.plan), dryRunError: "" };
    case "dryRun/error":
      return { ...current, dryRunStatus: "error", dryRunPlan: null, dryRunError: error };
    case "runs/loading":
      return { ...current, runsStatus: "loading", runsError: "" };
    case "runs/loaded":
      return { ...current, runsStatus: "ready", runs: list(action?.runs), runsError: "" };
    case "runs/error":
      return { ...current, runsStatus: "error", runsError: error };
    case "notice":
      return { ...current, notice: text(action?.message, 300) };
    default:
      return current;
  }
}
