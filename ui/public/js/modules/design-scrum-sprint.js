// @ts-check
// Banner e quadro Kanban da sprint.
import { esc } from "../shared/dom.js";
import { ds } from "./design-scrum-store.js";
import { renderStoryCard } from "./design-scrum-story-card.js";

export function renderSprintBanner(scrum) {
  const summary = scrum.summary || {};
  const currentFilter = ds.selectedSprintFilter || (scrum.activeSprintId ? "active" : "all");
  const isAll = currentFilter === "all";
  const activeSprint = summary.activeSprint || scrum.sprints?.[0] || { name: "Sprint 1", goal: "Sprint em andamento" };
  const currentSprint = isAll ? null : (scrum.sprints?.find((s) => s.id === currentFilter) || activeSprint);

  const sprintOptions = (scrum.sprints || []).map((item) => {
    const isSelected = !isAll && (item.id === currentFilter || (currentFilter === "active" && item.id === scrum.activeSprintId));
    return `<option value="${esc(item.id)}" ${isSelected ? "selected" : ""}>${esc(item.name)} (${item.status === "active" ? "Ativa" : "Planejada"})</option>`;
  }).join("");

  const allSelected = isAll ? "selected" : "";
  const options = `<option value="all" ${allSelected}>Todas as Sprints (${scrum.stories?.length || 0} histórias)</option>${sprintOptions}`;

  const badgeHtml = isAll
    ? '<span class="scrum-badge-active"><i class="fa-solid fa-layer-group"></i> TODAS AS SPRINTS</span>'
    : '<span class="scrum-badge-active"><i class="fa-solid fa-person-running"></i> SPRINT ATIVA</span>';

  const titleHtml = isAll ? "Visão Geral de Todas as Sprints" : esc(currentSprint?.name || "Sprint");
  const goalHtml = isAll
    ? "Exibindo todas as histórias do projeto distribuídas nas etapas."
    : `<b>Meta:</b> ${esc(currentSprint?.goal || "Sem meta declarada.")} ${currentSprint?.startDate && currentSprint?.endDate ? `<span><i class="fa-regular fa-calendar"></i> ${esc(currentSprint.startDate)} ate ${esc(currentSprint.endDate)}</span>` : ""}`;

  const sprintPointsDone = isAll
    ? (scrum.stories || []).filter((s) => s.status === "done").reduce((t, s) => t + (s.points || 0), 0)
    : (summary.sprintPointsDone || 0);
  const sprintPointsTotal = isAll
    ? (scrum.stories || []).reduce((t, s) => t + (s.points || 0), 0)
    : (summary.sprintPointsTotal || 0);
  const sprintPercent = sprintPointsTotal ? Math.round((sprintPointsDone / sprintPointsTotal) * 100) : 0;

  return `<div class="scrum-sprint-banner"><div class="scrum-sprint-banner-row">
    <div><div class="scrum-sprint-heading">${badgeHtml}<select class="scrum-sprint-select" onchange="onSelectSprintChange(this.value)">${options}</select></div>
      <h2>${titleHtml}</h2><div class="scrum-sprint-goal">${goalHtml}</div></div>
    <div class="scrum-sprint-controls"><div class="sprint-stats-box"><small>${isAll ? "Progresso Global" : "Progresso da Sprint"}</small><b>${sprintPointsDone} / ${sprintPointsTotal} <span>pts (${sprintPercent}%)</span></b><div class="scorecard-progress-bar"><div class="scorecard-progress-fill" style="width:${sprintPercent}%"></div></div></div>
      <div class="scrum-button-group"><button type="button" class="btn-card-action" onclick="openLaneConfigModal()"><i class="fa-solid fa-sliders"></i> Configurar raias</button><button type="button" class="btn-card-action" onclick="openStatusMappingModal()"><i class="fa-solid fa-shuffle"></i> Mapear status</button><button type="button" class="btn-card-action" onclick="openNewStoryModal()"><i class="fa-solid fa-plus"></i> Nova historia</button><button type="button" class="btn-card-action" onclick="openNewSprintModal()"><i class="fa-regular fa-calendar-plus"></i> Nova sprint</button></div></div>
  </div></div>`;
}

export function renderSprintKanban(scrum) {
  const currentFilter = ds.selectedSprintFilter || (scrum.activeSprintId ? "active" : "all");
  const targetSprintId = currentFilter === "active" ? scrum.activeSprintId : currentFilter;
  const stories = currentFilter === "all"
    ? (scrum.stories || [])
    : (scrum.stories || []).filter((story) => story.sprintId === targetSprintId);

  const visibleLanes = (scrum.lanes || []).filter((lane) => lane.visible);
  const columns = visibleLanes.map((lane, index) => {
    const items = stories.filter((story) => story.laneId === lane.id);
    const estimated = items.filter((story) => story.points !== null && story.points !== undefined);
    const points = estimated.reduce((total, story) => total + story.points, 0);
    const leftDisabled = index === 0 ? "disabled" : "";
    const rightDisabled = index === visibleLanes.length - 1 ? "disabled" : "";
    return `<section class="scrum-kanban-col${lane.active ? "" : " is-inactive"}" data-lane-id="${esc(lane.id)}" style="--lane-color:${esc(lane.color)}" aria-label="Raia ${esc(lane.name)}" ondragover="allowScrumLaneDrop(event)" ondrop="dropScrumLane(event,'${esc(lane.id)}')"><div class="scrum-col-head"><div class="scrum-col-title"><button type="button" class="scrum-lane-drag" draggable="true" ondragstart="startScrumLaneDrag(event,'${esc(lane.id)}')" aria-label="Arrastar raia ${esc(lane.name)}"><i class="fa-solid fa-grip-vertical" aria-hidden="true"></i></button><i class="fa-solid fa-${esc(lane.icon)}" aria-hidden="true"></i> ${esc(lane.name)} <span class="scrum-col-count">${items.length}</span></div><div class="scrum-lane-order-actions">${lane.active ? "" : '<span class="scrum-lane-state">Inativa</span>'}${estimated.length ? `<span>${points} pts</span>` : ""}<button type="button" ${leftDisabled} onclick="moveScrumLane('${esc(lane.id)}',-1)" aria-label="Mover raia ${esc(lane.name)} para a esquerda"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i></button><button type="button" ${rightDisabled} onclick="moveScrumLane('${esc(lane.id)}',1)" aria-label="Mover raia ${esc(lane.name)} para a direita"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button></div></div><p class="scrum-lane-description">${esc(lane.description)}</p><div class="scrum-cards-container" ondragover="allowScrumStoryDrop(event,'${esc(lane.id)}')" ondrop="dropScrumStory(event,'${esc(lane.id)}')">${items.map((story) => renderStoryCard(story, scrum.epics || [], scrum.storyTransitions?.[story.id], scrum.lanes || [])).join("") || '<div class="scrum-empty-column">Nenhuma historia nesta etapa</div>'}</div></section>`;
  }).join("");
  return `<div class="scrum-sprint-view">${renderSprintBanner(scrum)}<div class="scrum-kanban-board">${columns}</div></div>`;
}
