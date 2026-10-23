// @ts-check
// Aba de Rotinas: rotinas executáveis, fila de aprovações e histórico (EP-08.05).
import { $, esc, showToast } from "../shared/dom.js";
import {
  fetchProjectRoutines,
  runProjectRoutine,
  fetchApprovals,
  decideApproval,
  fetchWorkflowHistory,
} from "./design-routines-api.js";
import { readRoutinesState, saveRoutinesState } from "./design-routines-state.js";

const TRIGGER_LABEL = {
  manual: { label: "Manual", icon: "fa-hand-pointer" },
  daily: { label: "Diária", icon: "fa-calendar-day" },
  weekly: { label: "Semanal", icon: "fa-calendar-week" },
};

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function triggerLabel(routine) {
  const meta = TRIGGER_LABEL[routine.trigger?.type] || TRIGGER_LABEL.manual;
  if (routine.trigger?.type === "daily") return `${meta.label} às ${String(routine.trigger.hour).padStart(2, "0")}:00`;
  if (routine.trigger?.type === "weekly") return `${meta.label} às ${String(routine.trigger.hour).padStart(2, "0")}:00`;
  return meta.label;
}

function renderRoutineCard(routine, selectedRoutine = "") {
  const meta = TRIGGER_LABEL[routine.trigger?.type] || TRIGGER_LABEL.manual;
  const due = routine.due ? `<span class="routine-badge is-due"><i class="fa-solid fa-bell"></i> Vencida</span>` : "";
  const last = routine.lastRun
    ? `<span class="routine-last">Última execução: ${esc(formatDate(routine.lastRun.startedAt))} · ${esc(routine.lastRun.status)}</span>`
    : `<span class="routine-last">Sem execução registrada</span>`;
  const warnings = (routine.plan?.warnings || []).map((warning) => `<li>${esc(warning)}</li>`).join("");
  return `<article class="routine-card ${routine.id === selectedRoutine ? "is-selected" : ""}" data-routine-id="${esc(routine.id)}" aria-selected="${routine.id === selectedRoutine}">
    <header class="routine-card-head">
      <h4><i class="fa-solid fa-repeat"></i> ${esc(routine.label)}</h4>
      ${due}
    </header>
    <p class="routine-desc">${esc(routine.description)}</p>
    <ul class="routine-meta">
      <li><i class="fa-solid ${meta.icon}"></i> ${esc(triggerLabel(routine))}</li>
      <li><i class="fa-solid fa-diagram-project"></i> ${esc(routine.workflowLabel)}</li>
      <li><i class="fa-solid fa-user-check"></i> Aprovações: ${esc((routine.approvalStages || []).join(", ") || "nenhuma")}</li>
    </ul>
    ${warnings ? `<ul class="routine-warnings">${warnings}</ul>` : ""}
    ${last}
    <button type="button" class="routine-run-button" data-routine-run="${esc(routine.id)}" title="Executar a rotina agora">
      <i class="fa-solid fa-play"></i> Executar
    </button>
  </article>`;
}

function renderApprovalRow(item) {
  return `<tr data-approval-row="${esc(item.executionId)}">
    <td>${esc(item.stageLabel || item.stageId)}</td>
    <td><code>${esc(item.executionId)}</code></td>
    <td>${esc(item.workflowId)}</td>
    <td>${esc(formatDate(item.startedAt))}</td>
    <td class="routine-actions">
      <button type="button" class="routine-approve-button" data-approval-approve="${esc(item.executionId)}" title="Aprovar a etapa">
        <i class="fa-solid fa-check"></i> Aprovar
      </button>
      <button type="button" class="routine-reject-button" data-approval-reject="${esc(item.executionId)}" title="Rejeitar a etapa">
        <i class="fa-solid fa-xmark"></i> Recusar
      </button>
    </td>
  </tr>`;
}

function renderHistoryEntry(entry) {
  const decision = entry.decision
    ? `<span class="routine-badge ${entry.decision === "approved" ? "is-approved" : "is-rejected"}">${esc(entry.decision)}</span>`
    : "";
  return `<li class="routine-history-item">
    <span class="routine-history-type">${esc(entry.type)}</span>
    ${decision}
    <span class="routine-history-meta">${esc(entry.stageId || entry.workflowId || "")}</span>
    <span class="routine-history-date">${esc(formatDate(entry.at))}</span>
    ${entry.actor ? `<span class="routine-history-meta">por ${esc(entry.actor)}</span>` : ""}
    ${entry.note ? `<span class="routine-history-note">${esc(entry.note)}</span>` : ""}
  </li>`;
}

/**
 * Renderiza a aba de Rotinas do projeto.
 * @param {HTMLElement} container
 * @param {string} slug
 */
export async function renderRoutinesWorkspace(container, slug) {
  container.innerHTML = `<section class="routine-panel" aria-label="Rotinas e aprovações do projeto">
    <header class="routine-header">
      <h3><i class="fa-solid fa-repeat"></i> Rotinas, aprovações e histórico</h3>
      <p>Execuções agendadas com chave de idempotência, aprovações sensíveis e histórico persistido de <code>${esc(slug)}</code>.</p>
    </header>
    <p class="routine-status" id="routineStatus" role="status" aria-live="polite"></p>
    <div class="routine-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando rotinas...</div>
  </section>`;

  const status = /** @type {HTMLElement} */ ($("routineStatus"));
  const [routines, approvals, history] = await Promise.all([
    fetchProjectRoutines(slug),
    fetchApprovals(slug),
    fetchWorkflowHistory(slug, 30),
  ]);

  if (!routines.ok) {
    container.innerHTML = `<div class="routine-empty"><i class="fa-solid fa-triangle-exclamation"></i><strong>Rotinas indisponíveis</strong><p>${esc(routines.error || "Falha ao carregar as rotinas.")}</p></div>`;
    return;
  }

  const items = routines.routines || [];
  const pending = approvals.approvals || [];
  const entries = history.entries || [];
  const saved = await readRoutinesState();
  const needle = saved.filter.trim().toLowerCase();
  const pendingWorkflows = new Set(pending.map((item) => item.workflowId).filter(Boolean));
  const byApproval = saved.approvalFilter === "pending"
    ? items.filter((routine) => pendingWorkflows.has(routine.workflowId))
    : items;
  const visibleItems = needle
    ? byApproval.filter((routine) => [routine.label, routine.id, routine.description, routine.workflowLabel]
      .some((value) => String(value || "").toLowerCase().includes(needle)))
    : byApproval;

  container.innerHTML = `<section class="routine-panel" aria-label="Rotinas e aprovações do projeto">
    <header class="routine-header">
      <h3><i class="fa-solid fa-repeat"></i> Rotinas, aprovações e histórico</h3>
      <p>${visibleItems.length} de ${items.length} rotina(s) · ${pending.length} aprovação(ões) pendente(s) · ${entries.length} registro(s) no histórico.</p>
    </header>
    <p class="routine-status" id="routineStatus" role="status" aria-live="polite"></p>
    <div class="routine-toolbar">
      <label class="routine-search" for="routineSearch">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input id="routineSearch" type="search" placeholder="Buscar rotina" value="${esc(saved.filter)}" autocomplete="off">
      </label>
      <label class="routine-filter" for="routineApprovalFilter">
        <i class="fa-solid fa-user-check"></i>
        <select id="routineApprovalFilter">
          <option value="all" ${saved.approvalFilter === "all" ? "selected" : ""}>Todas as rotinas</option>
          <option value="pending" ${saved.approvalFilter === "pending" ? "selected" : ""}>Só pendências</option>
        </select>
      </label>
    </div>
    <div class="routine-grid">
      ${visibleItems.map((routine) => renderRoutineCard(routine, saved.selectedRoutine)).join("")}
    </div>
    <section class="routine-section">
      <h4><i class="fa-solid fa-user-check"></i> Aprovações pendentes</h4>
      ${pending.length ? `<div class="routine-table-wrap">
        <table class="routine-table">
          <caption class="routine-caption">Etapas sensíveis que aguardam decisão</caption>
          <thead><tr><th scope="col">Etapa</th><th scope="col">Execução</th><th scope="col">Workflow</th><th scope="col">Iniciada</th><th scope="col">Decisão</th></tr></thead>
          <tbody>${pending.map(renderApprovalRow).join("")}</tbody>
        </table>
      </div>` : `<p class="routine-empty-line">Nenhuma aprovação pendente.</p>`}
    </section>
    <section class="routine-section">
      <h4><i class="fa-solid fa-clock-rotate-left"></i> Histórico do projeto</h4>
      ${entries.length ? `<ul class="routine-history">${entries.slice().reverse().map(renderHistoryEntry).join("")}</ul>` : `<p class="routine-empty-line">Sem registros no histórico.</p>`}
      ${history.warnings?.length ? `<p class="routine-warning"><i class="fa-solid fa-triangle-exclamation"></i> ${history.warnings.map(esc).join(" ")}</p>` : ""}
    </section>
  </section>`;

  const search = /** @type {HTMLInputElement | null} */ ($("routineSearch"));
  const approvalFilter = /** @type {HTMLSelectElement | null} */ ($("routineApprovalFilter"));
  search?.addEventListener("input", () => {
    void saveRoutinesState({ filter: search.value, selectedRoutine: saved.selectedRoutine, approvalFilter: approvalFilter?.value || saved.approvalFilter });
  });
  approvalFilter?.addEventListener("change", () => {
    void saveRoutinesState({ filter: search?.value || saved.filter, selectedRoutine: saved.selectedRoutine, approvalFilter: approvalFilter.value });
    void refresh();
  });
  container.querySelectorAll(".routine-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (/** @type {HTMLElement} */ (event.target).closest("button")) return;
      const element = /** @type {HTMLElement} */ (card);
      const selected = element.dataset.routineId || "";
      void saveRoutinesState({ filter: search?.value || saved.filter, selectedRoutine: selected, approvalFilter: approvalFilter?.value || saved.approvalFilter });
      container.querySelectorAll(".routine-card").forEach((other) => {
        const on = other === card;
        other.classList.toggle("is-selected", on);
        other.setAttribute("aria-selected", String(on));
      });
    });
  });

  const refresh = async () => {
    await renderRoutinesWorkspace(container, slug);
  };

  container.querySelectorAll("[data-routine-run]").forEach((button) => {
    button.addEventListener("click", async () => {
      const routineId = /** @type {HTMLElement} */ (button).dataset.routineRun || "";
      const result = await runProjectRoutine(slug, routineId, "interface");
      if (!result.ok) {
        showToast(result.data?.error || "Falha ao executar a rotina.");
        return;
      }
      showToast(result.data?.idempotent ? "Rotina já executada nesta janela." : "Rotina iniciada.");
      await refresh();
    });
  });

  container.querySelectorAll("[data-approval-approve], [data-approval-reject]").forEach((button) => {
    button.addEventListener("click", async () => {
      const element = /** @type {HTMLElement} */ (button);
      const executionId = element.dataset.approvalApprove || element.dataset.approvalReject || "";
      const decision = element.dataset.approvalApprove ? "approved" : "rejected";
      const result = await decideApproval(executionId, decision, "interface");
      if (!result.ok) {
        showToast(result.data?.error || "Falha ao registrar a decisão.");
        return;
      }
      showToast(decision === "approved" ? "Etapa aprovada." : "Etapa recusada; execução cancelada.");
      await refresh();
    });
  });

  status.textContent = "";
}
