// @ts-check
// Montagem do workspace e troca de vistas sem desmontar o painel lateral.
import { $ } from "../shared/dom.js";
import { ds } from "./design-scrum-store.js";
import { renderSprintKanban } from "./design-scrum-sprint.js";
import { renderProductBacklog, renderEpicsWorkspace } from "./design-scrum-backlog.js";

export function renderScrumWorkspace(container, projectSlug, scrumData) {
  ds.currentScrumData = scrumData;
  container.innerHTML = `<div class="scrum-workspace-layout">
    <nav class="scrum-nav-bar" aria-label="Vistas Scrum">
      <div class="scrum-nav-tabs">
        <button type="button" class="scrum-nav-tab ${ds.currentScrumTab === "sprint" ? "active" : ""}" onclick="switchScrumTab('sprint')"><i class="fa-solid fa-table-columns"></i> Kanban da Sprint</button>
        <button type="button" class="scrum-nav-tab ${ds.currentScrumTab === "backlog" ? "active" : ""}" onclick="switchScrumTab('backlog')"><i class="fa-solid fa-list"></i> Product Backlog (${scrumData.summary?.backlogStoriesCount || 0})</button>
        <button type="button" class="scrum-nav-tab ${ds.currentScrumTab === "epics" ? "active" : ""}" onclick="switchScrumTab('epics')"><i class="fa-solid fa-layer-group"></i> Epicos & Metas (${scrumData.summary?.totalEpicsCount || 0})</button>
      </div>
      <div class="scrum-nav-summary">Sprint: <b>${scrumData.summary?.sprintPointsTotal || 0} pts</b> · Backlog: <b>${scrumData.summary?.backlogPointsTotal || 0} pts</b></div>
    </nav>
    <div class="scrum-content-body" id="scrumContentBody"></div>
    <aside id="scrumStoryDrawer" class="scrum-story-drawer" role="dialog" aria-modal="false" aria-labelledby="storyDrawerTitle" hidden></aside>
  </div>`;
  renderCurrentScrumView();
}

export function renderCurrentScrumView() {
  const body = $("scrumContentBody");
  if (!body || !ds.currentScrumData) return;
  if (ds.currentScrumTab === "sprint") body.innerHTML = renderSprintKanban(ds.currentScrumData);
  else if (ds.currentScrumTab === "backlog") body.innerHTML = renderProductBacklog(ds.currentScrumData);
  else body.innerHTML = renderEpicsWorkspace(ds.currentScrumData);
}
