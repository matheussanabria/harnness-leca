// @ts-check
// Persistencia do estado local e composicao das fontes somente-leitura do Scrum.
const fs = require("fs");
const path = require("path");
const { createDefaultScrumData } = require("./project-scrum-defaults");
const { loadJiraSnapshot } = require("./project-scrum-jira-source");
const { loadStoryDocuments } = require("./project-scrum-doc-source");
const { resolveScrumData } = require("./project-scrum-resolver");
const { migrateScrumData, migrateScrumFile, writeJsonAtomic } = require("./project-scrum-migration");
const { mergeLaneConfiguration } = require("./project-scrum-lanes");
const { allowedTransitionLaneIds } = require("./project-scrum-transitions");
const { withMaturity } = require("./project-scrum-maturity");
const { velocityOf } = require("./project-scrum-velocity");

function loadStoredProjectScrum(slug, projectDir, repoRoot) {
  const scrumFile = path.join(projectDir, "scrum.json");
  let data = null;
  if (fs.existsSync(scrumFile)) {
    try {
      data = JSON.parse(fs.readFileSync(scrumFile, "utf8"));
    } catch (error) {
      console.error(`[project-scrum] Erro ao ler scrum.json de ${slug}:`, error.message);
    }
  }
  if (data) data = migrateScrumFile(scrumFile, data).data;
  if (!data || !Array.isArray(data.stories)) {
    data = createDefaultScrumData(slug, projectDir, repoRoot);
    saveProjectScrum(slug, projectDir, data);
  }
  data.sprints = Array.isArray(data.sprints) ? data.sprints : [];
  data.epics = Array.isArray(data.epics) ? data.epics : [];
  data.stories = Array.isArray(data.stories) ? data.stories : [];
  data.lanes = mergeLaneConfiguration(data.lanes);
  data.lanesRevision = Number.isInteger(data.lanesRevision) && data.lanesRevision >= 0 ? data.lanesRevision : 0;
  data.transitionHistory = Array.isArray(data.transitionHistory) ? data.transitionHistory : [];
  data.impedimentHistory = Array.isArray(data.impedimentHistory) ? data.impedimentHistory : [];
  data.sprintHistory = Array.isArray(data.sprintHistory) ? data.sprintHistory : [];
  if (!data.activeSprintId && data.sprints.length) data.activeSprintId = data.sprints[0].id;
  return data;
}

function buildSummary(data) {
  const activeSprint = data.sprints.find((item) => item.id === data.activeSprintId) || data.sprints[0] || null;
  const sprintStories = data.stories.filter((story) => story.sprintId && story.sprintId === activeSprint?.id);
  const backlogStories = data.stories.filter((story) => !story.sprintId);
  const sprintPointsTotal = sprintStories.reduce((total, story) => total + (story.points || 0), 0);
  const sprintPointsDone = sprintStories.filter((story) => story.status === "done")
    .reduce((total, story) => total + (story.points || 0), 0);
  const blockedStories = data.stories.filter((story) => story.impediment?.active);
  const blockedPointsTotal = blockedStories.reduce((total, story) => total + (story.points || 0), 0);
  return {
    activeSprint,
    sprintStoriesCount: sprintStories.length,
    sprintPointsTotal,
    sprintPointsDone,
    sprintPercent: sprintPointsTotal ? Math.round((sprintPointsDone / sprintPointsTotal) * 100) : 0,
    backlogStoriesCount: backlogStories.length,
    backlogPointsTotal: backlogStories.reduce((total, story) => total + (story.points || 0), 0),
    blockedStoriesCount: blockedStories.length,
    blockedPointsTotal,
    impedimentRate: data.stories.length ? Math.round((blockedStories.length / data.stories.length) * 100) : 0,
    totalEpicsCount: data.epics.length,
    totalStoriesCount: data.stories.length,
    velocity: velocityOf(data.sprints),
  };
}

function loadProjectScrum(slug, projectDir, repoRoot) {
  const stored = loadStoredProjectScrum(slug, projectDir, repoRoot);
  const snapshot = loadJiraSnapshot(repoRoot);
  const documents = loadStoryDocuments(repoRoot, snapshot.stories.map((story) => story.key));
  const resolvedData = snapshot.available ? resolveScrumData(stored, snapshot, documents) : stored;
  // Historia sem maturidade gravada vale "ready" na leitura; o arquivo nao e alterado.
  const data = { ...resolvedData, stories: withMaturity(resolvedData.stories) };
  const storyTransitions = Object.fromEntries(data.stories.map((story) => [
    story.id,
    allowedTransitionLaneIds(story.laneId, data.lanes),
  ]));
  return { ok: true, slug, scrum: { ...data, storyTransitions, summary: buildSummary(data) } };
}

function saveProjectScrum(slug, projectDir, data) {
  const scrumFile = path.join(projectDir, "scrum.json");
  const cleanData = {
    schemaVersion: data.schemaVersion,
    migrationHistory: data.migrationHistory || [],
    activeSprintId: data.activeSprintId || data.sprints?.[0]?.id || null,
    sprints: data.sprints || [],
    epics: data.epics || [],
    stories: data.stories || [],
    lanes: mergeLaneConfiguration(data.lanes),
    lanesRevision: Number.isInteger(data.lanesRevision) && data.lanesRevision >= 0 ? data.lanesRevision : 0,
    transitionHistory: data.transitionHistory || [],
    impedimentHistory: data.impedimentHistory || [],
    sprintHistory: data.sprintHistory || [],
    statusMapping: data.statusMapping || {},
    deletedSourceKeys: data.deletedSourceKeys || [],
  };
  try {
    const versioned = migrateScrumData(cleanData).data;
    writeJsonAtomic(scrumFile, versioned);
    return true;
  } catch (error) {
    console.error(`[project-scrum] Erro ao gravar scrum.json para ${slug}:`, error.message);
    return false;
  }
}

module.exports = { loadProjectScrum, loadStoredProjectScrum, saveProjectScrum };
