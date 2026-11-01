// @ts-check
// Pure renderers for the Workflows tab (EP-08.06).
import { esc } from "../shared/dom.js";
import { pagedHtml } from "../shared/pagination.js";

function loadingBox(message) {
  return `<div class="workflow-loading" role="status"><i class="fa-solid fa-spinner fa-spin"></i> ${esc(message)}</div>`;
}

function errorBox(message) {
  return `<div class="workflow-error" role="alert"><i class="fa-solid fa-triangle-exclamation"></i><strong>Falha</strong><p>${esc(message)}</p></div>`;
}

function emptyBox(message, icon = "fa-inbox") {
  return `<div class="workflow-empty"><i class="fa-solid ${icon}"></i><p>${esc(message)}</p></div>`;
}

function agentNames(stage) {
  const executors = (stage.agents || [])
    .filter((agent) => agent.role === "executor")
    .map((agent) => agent.label || agent.id);
  if (executors.length) return executors.join(", ");
  return (stage.executors || []).join(", ");
}

function permissionText(permissions) {
  const value = permissions || {};
  const parts = [];
  if (value.read) parts.push("leitura");
  if (value.write) parts.push("escrita");
  if (value.exec) parts.push("execução");
  return parts.length ? parts.join(", ") : "nenhuma";
}

export function renderSkill(skill) {
  const available = skill.available === true;
  const state = available ? (skill.bound ? "disponível e vinculada" : "disponível, não vinculada") : "ausente no projeto";
  return `<li class="workflow-skill ${available ? "is-available" : "is-missing"}">
    <i class="fa-solid ${available ? "fa-circle-check" : "fa-circle-xmark"}"></i>
    <span class="workflow-skill-name">${esc(skill.name)}</span>
    <span class="workflow-skill-state">${esc(state)}</span>
  </li>`;
}

export function renderStage(stage) {
  const skills = stage.skills || [];
  const missing = skills.filter((skill) => skill.available !== true).length;
  const approval = stage.requiresApproval
    ? `<span class="workflow-badge is-approval"><i class="fa-solid fa-user-check"></i> Aprovação obrigatória</span>`
    : "";
  const gate = stage.gate
    ? `<p class="workflow-gate"><i class="fa-solid fa-door-closed"></i> ${esc(stage.gate)}</p>`
    : "";
  const skillList = skills.length
    ? `<ul class="workflow-skills">${skills.map(renderSkill).join("")}</ul>`
    : `<p class="workflow-empty-line">Sem skills exigidas.</p>`;
  return `<article class="workflow-stage" data-stage-id="${esc(stage.id)}">
    <header class="workflow-stage-head">
      <span class="workflow-order">${esc(String(stage.order))}</span>
      <h5>${esc(stage.label || stage.id)}</h5>
      ${approval}
    </header>
    <p class="workflow-agent"><i class="fa-solid fa-user-gear"></i> ${esc(agentNames(stage) || "—")}</p>
    ${gate}
    ${skillList}
    <p class="workflow-permissions"><i class="fa-solid fa-lock"></i> Permissões: ${esc(permissionText(stage.permissions))}</p>
    ${missing ? `<p class="workflow-missing"><i class="fa-solid fa-triangle-exclamation"></i> ${missing} skill(s) ausente(s) no projeto.</p>` : ""}
  </article>`;
}

export function renderPlan(plan, options = {}) {
  if (!plan) return "";
  const stages = [...(plan.stages || [])].sort((a, b) => Number(a.order) - Number(b.order));
  const totals = plan.totals || {};
  const warnings = plan.warnings || [];
  return `<section class="workflow-plan ${options.dryRun ? "is-dry-run" : ""}" aria-label="Plano do workflow">
    <header class="workflow-plan-head">
      <h4><i class="fa-solid fa-diagram-project"></i> ${esc(plan.workflow?.label || plan.workflowId || "")}</h4>
      <span class="workflow-badge">${esc(String(stages.length))} etapa(s)</span>
      ${options.dryRun ? `<span class="workflow-badge is-dry-run"><i class="fa-solid fa-flask"></i> Simulação</span>` : ""}
    </header>
    <p class="workflow-plan-summary">Skills: ${esc(String(totals.skillsAvailable ?? 0))} disponível(is) · ${esc(String(totals.skillsMissing ?? 0))} ausente(s) · Aprovações: ${esc(String(totals.approvalsRequired ?? 0))}</p>
    ${warnings.length ? `<ul class="workflow-warnings">${warnings.map((warning) => `<li>${esc(warning)}</li>`).join("")}</ul>` : ""}
    <div class="workflow-stages">${stages.length ? stages.map(renderStage).join("") : `<p class="workflow-empty-line">O plano não possui etapas.</p>`}</div>
  </section>`;
}

export function renderWorkflowCard(workflow, selectedId) {
  const selected = workflow.id === selectedId;
  return `<button type="button" class="workflow-card ${selected ? "is-selected" : ""}" data-workflow-id="${esc(workflow.id)}" aria-selected="${selected}">
    <header><strong>${esc(workflow.label || workflow.id)}</strong><span class="workflow-badge">${esc(String(workflow.stageCount ?? 0))}</span></header>
    <p>${esc(workflow.description || "")}</p>
  </button>`;
}

export function renderRun(run) {
  const active = run.status === "running" || run.status === "blocked";
  return `<tr data-run-id="${esc(run.executionId)}">
    <td><code>${esc(run.executionId)}</code></td>
    <td>${esc(run.workflowId)}</td>
    <td><span class="workflow-status">${esc(run.status)}</span></td>
    <td>${esc(run.currentStage?.label || "—")}</td>
    <td>${esc(String(run.totals?.completed ?? 0))}/${esc(String(run.totals?.stages ?? 0))}</td>
    <td class="workflow-actions">
      <button type="button" class="workflow-advance" data-run-advance="${esc(run.executionId)}" title="Concluir a etapa atual" ${active ? "" : "disabled"}>
        <i class="fa-solid fa-forward"></i> Avançar
      </button>
      <button type="button" class="workflow-cancel" data-run-cancel="${esc(run.executionId)}" title="Cancelar a execução" ${active ? "" : "disabled"}>
        <i class="fa-solid fa-ban"></i> Cancelar
      </button>
    </td>
  </tr>`;
}

function renderWorkflowList(state) {
  if (state.workflowsStatus === "loading") return loadingBox("Carregando workflows...");
  if (state.workflowsStatus === "error") return errorBox(state.workflowsError || "Falha ao carregar workflows.");
  if (!state.workflows.length) return emptyBox("Nenhum workflow disponível.");
  const paged = pagedHtml(state.workflows, "workflows", (workflow) => renderWorkflowCard(workflow, state.selectedWorkflowId), { label: "Paginação dos workflows" });
  return paged.html + paged.pager;
}

function renderPlanArea(state) {
  if (!state.selectedWorkflowId) return emptyBox("Selecione um workflow para ver o plano.", "fa-diagram-project");
  if (state.planStatus === "loading") return loadingBox("Carregando o plano do workflow...");
  if (state.planStatus === "error") return errorBox(state.planError || "Falha ao carregar o plano.");
  if (state.planStatus !== "ready" || !state.plan) return emptyBox("O plano ainda não foi carregado.");
  const dryRunBody = state.dryRunStatus === "loading"
    ? loadingBox("Simulando o workflow...")
    : state.dryRunStatus === "error"
      ? errorBox(state.dryRunError || "Falha na simulação.")
      : state.dryRunStatus === "ready"
        ? renderPlan(state.dryRunPlan, { dryRun: true })
        : "";
  return `<div class="workflow-actions-bar">
      <label class="workflow-check" for="workflowDryRun"><input id="workflowDryRun" type="checkbox"> Execução simulada (dry run)</label>
      <button type="button" id="workflowStart" class="workflow-start"><i class="fa-solid fa-play"></i> Iniciar workflow</button>
    </div>
    ${renderPlan(state.plan)}
    ${dryRunBody}`;
}

function renderRunsArea(state) {
  if (state.runsStatus === "loading") return loadingBox("Carregando execuções...");
  if (state.runsStatus === "error") return errorBox(state.runsError || "Falha ao carregar execuções.");
  if (!state.runs.length) return emptyBox("Nenhuma execução para este projeto.");
  const paged = pagedHtml(state.runs, "workflow-runs", renderRun, { label: "Paginação das execuções" });
  return `<div class="workflow-table-wrap">
    <table class="workflow-table">
      <caption class="workflow-caption">Execuções do workflow no projeto</caption>
      <thead><tr><th scope="col">Execução</th><th scope="col">Workflow</th><th scope="col">Status</th><th scope="col">Etapa atual</th><th scope="col">Progresso</th><th scope="col">Ações</th></tr></thead>
      <tbody>${paged.html}</tbody>
    </table>
  </div>${paged.pager}`;
}

export function renderWorkflowsShell(state, slug) {
  return `<section class="workflow-panel" aria-label="Workflows do projeto">
    <header class="workflow-header">
      <h3><i class="fa-solid fa-diagram-project"></i> Workflows, planos e execuções</h3>
      <p>Catálogo de workflows, plano por etapa e execuções de <code>${esc(slug)}</code>.</p>
    </header>
    <p class="workflow-notice" role="status" aria-live="polite">${esc(state.notice || "")}</p>
    <div class="workflow-layout">
      <aside class="workflow-list" aria-label="Catálogo de workflows">${renderWorkflowList(state)}</aside>
      <div class="workflow-detail">${renderPlanArea(state)}</div>
    </div>
    <section class="workflow-runs" aria-label="Execuções do projeto">
      <header class="workflow-runs-head">
        <h4><i class="fa-solid fa-clock-rotate-left"></i> Execuções do projeto</h4>
        <button type="button" id="workflowRefreshRuns" class="workflow-refresh" title="Recarregar execuções"><i class="fa-solid fa-rotate"></i> Atualizar</button>
      </header>
      ${renderRunsArea(state)}
    </section>
  </section>`;
}
