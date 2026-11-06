// @ts-check
// Pure rules for the office Scrum board: lanes, the sprint view, allowed moves and sprint actions. No DOM, no network.

export const ALL = "all";
const DAY_MS = 86400000;

export const SPRINT_STATUS_LABEL = Object.freeze({ planned: "Planejada", active: "Ativa", closed: "Encerrada" });

/** @param {any} scrum */
export function boardLanes(scrum) {
  return (scrum?.lanes || []).filter((lane) => lane.visible !== false && lane.active !== false).sort((a, b) => a.order - b.order);
}

/** @param {any} scrum @param {string} viewId */
export function viewStories(scrum, viewId) {
  const stories = scrum?.stories || [];
  return viewId === ALL ? stories : stories.filter((story) => story.sprintId === viewId);
}

/** Saved view when it still exists, else the active sprint, else every story. */
export function pickViewId(scrum, saved) {
  const sprints = scrum?.sprints || [];
  if (saved === ALL || sprints.some((sprint) => sprint.id === saved)) return saved;
  return sprints.some((sprint) => sprint.id === scrum?.activeSprintId) ? scrum.activeSprintId : ALL;
}

const sumPoints = (/** @type {any[]} */ list) => list.reduce((total, story) => total + (Number(story.points) || 0), 0);

/** @param {any[]} lanes @param {any[]} stories */
export function groupByLane(lanes, stories) {
  return lanes.map((lane) => {
    const inLane = stories.filter((story) => story.laneId === lane.id);
    return { lane, stories: inLane, points: sumPoints(inLane) };
  });
}

/** Adjacent lanes a story may move to, as computed by the server. */
export function laneTargets(scrum, story) {
  const targets = scrum?.storyTransitions?.[story.id] || {};
  return { backward: targets.backward || null, forward: targets.forward || null };
}

export function canMoveTo(scrum, story, toLaneId) {
  const { backward, forward } = laneTargets(scrum, story);
  return Boolean(toLaneId) && (toLaneId === backward || toLaneId === forward);
}

/** @param {any} scrum @param {string} sprintId */
export function sprintProgress(scrum, sprintId) {
  const stories = viewStories(scrum, sprintId);
  const done = stories.filter((story) => story.laneId === "concluido");
  const points = sumPoints(stories);
  const donePoints = sumPoints(done);
  return { stories: stories.length, doneStories: done.length, points, donePoints, percent: points ? Math.round((donePoints / points) * 100) : 0 };
}

/** Whole days until the sprint end date (negative when late); null without a valid date. */
export function daysLeft(sprint, now = Date.now()) {
  const end = Date.parse(`${sprint?.endDate || ""}T23:59:59`);
  return Number.isNaN(end) ? null : Math.ceil((end - now) / DAY_MS);
}

/**
 * What the user may do with the viewed sprint. Mirrors the server rules so the buttons explain themselves;
 * the server still decides.
 * @param {any} scrum
 * @param {any} sprint
 */
export function sprintActions(scrum, sprint) {
  if (!sprint) return { canStart: false, canClose: false, blockedBy: null, nextOptions: [] };
  const running = (scrum.sprints || []).find((item) => item.status === "active" && item.id !== sprint.id);
  const planned = sprint.status === "planned";
  return {
    canStart: planned && !running,
    canClose: sprint.status === "active",
    blockedBy: planned && running ? running.name : null,
    nextOptions: (scrum.sprints || []).filter((item) => item.status === "planned" && item.id !== sprint.id),
  };
}

/** Preview of a close: what would be delivered and what would carry over. */
export function closePreview(scrum, sprintId) {
  const stories = viewStories(scrum, sprintId);
  const done = stories.filter((story) => story.laneId === "concluido");
  const carried = stories.filter((story) => story.laneId !== "concluido");
  return { doneStories: done.length, donePoints: sumPoints(done), carriedStories: carried.length, carriedPoints: sumPoints(carried) };
}
