// @ts-check
// Barra de filtros compartilhada do Scrum (EP-05.05).
import { esc } from "../shared/dom.js";
import { currentStoryFilters, listStoryAssignees } from "./design-scrum-filters.js";

export function renderScrumFilterBar(scrum = {}) {
  const filters = currentStoryFilters();
  const assignees = listStoryAssignees(scrum.stories || []);
  const assigneeOptions = [
    `<option value="all">Todos os responsáveis</option>`,
    ...assignees.map((assignee) => `<option value="${esc(assignee)}" ${assignee === filters.assignee ? "selected" : ""}>${esc(assignee)}</option>`),
  ].join("");
  const hasFilters = Boolean(filters.query) || filters.assignee !== "all" || filters.onlyImpediments;

  return `<div class="scrum-filter-bar" role="search" aria-label="Filtros de histórias">
    <label class="scrum-filter-field">
      <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
      <span class="sr-only">Buscar história</span>
      <input type="search" class="chats-search-input" placeholder="Buscar história..." value="${esc(filters.query)}" oninput="onScrumSearchInput(this.value)">
    </label>
    <label class="scrum-filter-field">
      <i class="fa-solid fa-user" aria-hidden="true"></i>
      <span class="sr-only">Responsável</span>
      <select class="scrum-sprint-select" onchange="onScrumAssigneeFilterChange(this.value)">${assigneeOptions}</select>
    </label>
    <label class="scrum-filter-toggle">
      <input type="checkbox" ${filters.onlyImpediments ? "checked" : ""} onchange="onScrumImpedimentFilterChange(this.checked)">
      <span><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Somente impedidas</span>
    </label>
    <button type="button" class="btn-card-action" ${hasFilters ? "" : "disabled"} onclick="clearScrumFilters()">
      <i class="fa-solid fa-filter-circle-xmark" aria-hidden="true"></i> Limpar filtros
    </button>
  </div>`;
}
