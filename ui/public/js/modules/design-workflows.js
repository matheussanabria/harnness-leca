// @ts-check
// Workflows tab: catalog, plan, dry run, start and runs (EP-08.06).
import { $, showToast } from "../shared/dom.js";
import {
  fetchWorkflows,
  fetchWorkflowPlan,
  fetchWorkflowRuns,
  startWorkflow,
  advanceWorkflowRun,
  cancelWorkflowRun,
} from "./design-workflows-api.js";
import { createWorkflowsState, workflowsReducer } from "./design-workflows-state.js";
import { renderWorkflowsShell } from "./design-workflows-view.js";

/**
 * Renders the Workflows tab for a project.
 * @param {HTMLElement} container
 * @param {string} slug
 */
export async function renderWorkflowsWorkspace(container, slug) {
  let state = createWorkflowsState();
  const paint = () => {
    container.innerHTML = renderWorkflowsShell(state, slug);
    bind();
  };
  const dispatch = (action) => {
    state = workflowsReducer(state, action);
  };
  const fail = (fallback, result) => {
    const message = result?.data?.error || result?.error || fallback;
    dispatch({ type: "notice", message });
    showToast(message);
    return message;
  };

  async function loadRuns() {
    dispatch({ type: "runs/loading" });
    paint();
    const result = await fetchWorkflowRuns(slug);
    if (!result.ok) {
      dispatch({ type: "runs/error", error: result.error });
      paint();
      return;
    }
    dispatch({ type: "runs/loaded", runs: result.runs });
    paint();
  }

  async function selectWorkflow(workflowId) {
    dispatch({ type: "workflow/select", workflowId });
    dispatch({ type: "plan/loading" });
    paint();
    const result = await fetchWorkflowPlan(slug, workflowId);
    if (!result.ok) {
      dispatch({ type: "plan/error", error: result.error });
      paint();
      return;
    }
    dispatch({ type: "plan/loaded", plan: result.plan });
    paint();
  }

  async function loadWorkflows() {
    dispatch({ type: "workflows/loading" });
    paint();
    const result = await fetchWorkflows();
    if (!result.ok) {
      dispatch({ type: "workflows/error", error: result.error });
      paint();
      return;
    }
    dispatch({ type: "workflows/loaded", workflows: result.workflows });
    if (result.workflows.length) await selectWorkflow(result.workflows[0].id);
    else paint();
  }

  async function startCurrent(dryRun) {
    if (!state.selectedWorkflowId) return;
    if (dryRun) {
      dispatch({ type: "dryRun/loading" });
      paint();
    }
    const result = await startWorkflow(slug, state.selectedWorkflowId, { dryRun, actor: "interface" });
    if (!result.ok) {
      const message = fail("Falha ao iniciar o workflow.", result);
      dispatch(dryRun ? { type: "dryRun/error", error: message } : { type: "notice", message });
      paint();
      return;
    }
    if (dryRun) {
      dispatch({ type: "dryRun/loaded", plan: result.data?.plan || null });
      paint();
      showToast("Simulação concluída; nada foi iniciado.");
      return;
    }
    dispatch({ type: "notice", message: result.data?.idempotent ? "Execução já existente reaproveitada." : "Workflow iniciado." });
    paint();
    await loadRuns();
  }

  async function advance(executionId) {
    const run = state.runs.find((item) => item.executionId === executionId);
    const stageId = run?.currentStage?.id || "";
    const result = await advanceWorkflowRun(executionId, { stageId, status: "completed", note: "Avançado pela interface" });
    if (!result.ok) {
      fail("Falha ao avançar a execução.", result);
      paint();
      return;
    }
    dispatch({ type: "notice", message: "Etapa concluída." });
    await loadRuns();
  }

  async function cancel(executionId) {
    const result = await cancelWorkflowRun(executionId, { reason: "Cancelado pela interface" });
    if (!result.ok) {
      fail("Falha ao cancelar a execução.", result);
      paint();
      return;
    }
    dispatch({ type: "notice", message: "Execução cancelada." });
    await loadRuns();
  }

  function bind() {
    container.querySelectorAll("[data-workflow-id]").forEach((card) => {
      card.addEventListener("click", () => {
        void selectWorkflow(/** @type {HTMLElement} */ (card).dataset.workflowId || "");
      });
    });
    $("workflowStart")?.addEventListener("click", () => {
      const check = /** @type {HTMLInputElement | null} */ ($("workflowDryRun"));
      void startCurrent(Boolean(check?.checked));
    });
    $("workflowRefreshRuns")?.addEventListener("click", () => {
      void loadRuns();
    });
    container.querySelectorAll("[data-run-advance]").forEach((button) => {
      button.addEventListener("click", () => {
        void advance(/** @type {HTMLElement} */ (button).dataset.runAdvance || "");
      });
    });
    container.querySelectorAll("[data-run-cancel]").forEach((button) => {
      button.addEventListener("click", () => {
        void cancel(/** @type {HTMLElement} */ (button).dataset.runCancel || "");
      });
    });
  }

  paint();
  await loadWorkflows();
  await loadRuns();
}
