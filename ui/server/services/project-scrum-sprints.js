// @ts-check
// Sprint lifecycle: planned -> active -> closed, one running sprint, commitment at start, summary and velocity at close.
const { loadProjectScrum, loadStoredProjectScrum, saveProjectScrum } = require("./project-scrum-persist");
const { normalizeActor } = require("./project-scrum-actor");
const { localEntry, sameStory } = require("./project-scrum-ops");

const DONE_LANE = "concluido";
const CARRY_OVER = Object.freeze(["backlog", "next"]);
const points = (/** @type {any} */ story) => Number(story.points) || 0;
const sum = (/** @type {any[]} */ list) => list.reduce((total, story) => total + points(story), 0);

/** @param {any} data @param {string} sprintId */
function requireSprint(data, sprintId) {
  const sprint = data.sprints.find((item) => item.id === sprintId);
  if (!sprint) throw new Error(`Sprint '${sprintId}' nao encontrada.`);
  return sprint;
}

/** Stories of a sprint as the board sees them (local, Jira snapshot and documents). */
function sprintStories(slug, projectDir, repoRoot, sprintId) {
  return loadProjectScrum(slug, projectDir, repoRoot).scrum.stories.filter((story) => story.sprintId === sprintId);
}

function entryFor(data, story) {
  return story.source === "jira-snapshot" ? localEntry(data, story) : data.stories.find((item) => sameStory(item, story.id));
}

function recordHistory(data, entry) {
  data.sprintHistory = [...(Array.isArray(data.sprintHistory) ? data.sprintHistory : []), entry];
}

/** Pure: what a close would produce. Done means the `concluido` lane only. */
function summarizeSprint(sprint, stories, closedAt) {
  const done = stories.filter((story) => story.laneId === DONE_LANE);
  const carried = stories.filter((story) => story.laneId !== DONE_LANE);
  const committedIds = new Set(sprint.commitment?.storyIds || stories.map((story) => story.id));
  return {
    committedStories: committedIds.size,
    committedPoints: sprint.commitment ? sprint.commitment.points : sum(stories),
    completedStories: done.length,
    completedPoints: sum(done),
    carriedStories: carried.map((story) => story.id),
    carriedPoints: sum(carried),
    addedAfterStart: sprint.commitment ? stories.filter((story) => !committedIds.has(story.id)).length : 0,
    closedAt,
  };
}

function startSprint(slug, projectDir, repoRoot, sprintId, options = {}) {
  const actor = normalizeActor(options.actor);
  const now = options.now || new Date().toISOString();
  const data = loadStoredProjectScrum(slug, projectDir, repoRoot);
  const sprint = requireSprint(data, sprintId);
  if (sprint.status !== "planned") {
    throw new Error(`Sprint '${sprint.name}' esta ${sprint.status === "active" ? "ativa" : "encerrada"}: so uma sprint planejada pode ser iniciada.`);
  }
  const running = data.sprints.find((item) => item.status === "active" && item.id !== sprintId);
  if (running) throw Object.assign(new Error(`Encerre a sprint ativa '${running.name}' antes de iniciar outra.`), { code: "SCRUM_SPRINT_CONFLICT" });
  if (!String(sprint.goal || "").trim()) throw new Error("Defina a meta da sprint antes de inicia-la.");
  const stories = sprintStories(slug, projectDir, repoRoot, sprintId);
  if (!stories.length) throw new Error("A sprint precisa de ao menos uma historia pronta.");
  if (stories.some((story) => story.maturity && story.maturity !== "ready")) throw new Error("Ha historia em rascunho ou refinamento na sprint.");
  sprint.status = "active";
  sprint.commitment = { storyIds: stories.map((story) => story.id), points: sum(stories), startedAt: now, startedBy: actor };
  data.activeSprintId = sprintId;
  recordHistory(data, { id: `${sprintId}:start:${now}`, sprintId, type: "start", occurredAt: now, actor, stories: stories.length, points: sprint.commitment.points });
  saveProjectScrum(slug, projectDir, data);
  return loadProjectScrum(slug, projectDir, repoRoot);
}

function closeSprint(slug, projectDir, repoRoot, sprintId, options = {}) {
  const actor = normalizeActor(options.actor);
  const now = options.now || new Date().toISOString();
  const carryOver = options.carryOver || "backlog";
  if (!CARRY_OVER.includes(carryOver)) throw new Error("carryOver deve ser 'backlog' ou 'next'.");
  const data = loadStoredProjectScrum(slug, projectDir, repoRoot);
  const sprint = requireSprint(data, sprintId);
  if (sprint.status !== "active") throw new Error(`Sprint '${sprint.name}' nao esta ativa: nao ha o que encerrar.`);
  const next = carryOver === "next" ? requireSprint(data, String(options.nextSprintId || "")) : null;
  if (next && (next.id === sprintId || next.status !== "planned")) throw new Error("A proxima sprint deve estar planejada.");
  const stories = sprintStories(slug, projectDir, repoRoot, sprintId);
  const summary = { ...summarizeSprint(sprint, stories, now), carryOver, nextSprintId: next ? next.id : null };
  for (const story of stories.filter((item) => item.laneId !== DONE_LANE)) {
    const entry = entryFor(data, story);
    entry.sprintId = next ? next.id : null;
    entry.updatedAt = now;
  }
  sprint.status = "closed";
  sprint.summary = summary;
  sprint.closedAt = now;
  sprint.closedBy = actor;
  // The sprint the board points at must not stay a closed one: follow the carry-over target, else any open sprint.
  if (data.activeSprintId === sprintId) data.activeSprintId = (next || data.sprints.find((item) => item.status !== "closed") || sprint).id;
  recordHistory(data, { id: `${sprintId}:close:${now}`, sprintId, type: "close", occurredAt: now, actor, ...summary });
  saveProjectScrum(slug, projectDir, data);
  return loadProjectScrum(slug, projectDir, repoRoot);
}

module.exports = { startSprint, closeSprint, summarizeSprint, CARRY_OVER, DONE_LANE };
