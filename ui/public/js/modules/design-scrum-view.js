// @ts-check
// Montagem do workspace e troca de vistas sem desmontar o painel lateral.
import { $ } from "../shared/dom.js";
import { ds } from "./design-scrum-store.js";
import { renderSprintKanban } from "./design-scrum-sprint.js";
import { renderProductBacklog, renderEpicsWorkspace } from "./design-scrum-backlog.js";
import { renderScrumFilterBar } from "./design-scrum-filter-bar.js";
import { computeStoryMetrics, renderScrumMetricsBar } from "./design-scrum-metrics.js";
import { jiraSyncButtonHtml } from "./design-scrum-jira-sync.js";
import { visibleStories } from "./design-scrum-filters.js";

export function renderScrumWorkspace(container, projectSlug, scrumData) {
  ds.currentScrumData = scrumData;
  container.innerHTML = `<div class="scrum-workspace-layout">
    <nav class="scrum-nav-bar" aria-label="Vistas Scrum">
      <div class="scrum-nav-tabs">
        <button type="button" class="scrum-nav-tab ${ds.currentScrumTab === "sprint" ? "active" : ""}" onclick="switchScrumTab('sprint')"><i class="fa-solid fa-table-columns"></i> Kanban da Sprint</button>
        <button type="button" class="scrum-nav-tab ${ds.currentScrumTab === "backlog" ? "active" : ""}" onclick="switchScrumTab('backlog')"><i class="fa-solid fa-list"></i> Product Backlog (${scrumData.summary?.backlogStoriesCount || 0})</button>
        <button type="button" class="scrum-nav-tab ${ds.currentScrumTab === "epics" ? "active" : ""}" onclick="switchScrumTab('epics')"><i class="fa-solid fa-layer-group"></i> Epicos & Metas (${scrumData.summary?.totalEpicsCount || 0})</button>
      </div>
      <div class="scrum-nav-summary">${jiraSyncButtonHtml(scrumData)} Sprint: <b>${scrumData.summary?.sprintPointsTotal || 0} pts</b> · Backlog: <b>${scrumData.summary?.backlogPointsTotal || 0} pts</b></div>
    </nav>
    <div id="scrumFiltersBar" class="scrum-filters-host">${renderScrumFilterBar(scrumData)}</div>
    <div id="scrumMetricsBar" class="scrum-metrics-host"></div>
    <div class="scrum-content-body" id="scrumContentBody"></div>
    <aside id="scrumStoryDrawer" class="scrum-story-drawer" role="dialog" aria-modal="false" aria-labelledby="storyDrawerTitle" hidden></aside>
  </div>`;
  renderCurrentScrumView();
}

export function renderCurrentScrumView() {
  const body = $("scrumContentBody");
  if (!body || !ds.currentScrumData) return;
  const metricsBar = $("scrumMetricsBar");
  if (metricsBar) {
    const stories = visibleStories(ds.currentScrumData, { scope: ds.currentScrumTab === "sprint" ? "sprint" : "all" });
    metricsBar.innerHTML = renderScrumMetricsBar(computeStoryMetrics(stories, ds.currentScrumData.lanes || []));
  }
  if (ds.currentScrumTab === "sprint") body.innerHTML = renderSprintKanban(ds.currentScrumData);
  else if (ds.currentScrumTab === "backlog") body.innerHTML = renderProductBacklog(ds.currentScrumData);
  else body.innerHTML = renderEpicsWorkspace(ds.currentScrumData);
}
