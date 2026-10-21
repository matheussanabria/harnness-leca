// @ts-check
// Modelo puro da projeção Scrum no telão (EP-05.06).

function storyPoints(story) {
  const value = Number(story?.points);
  return Number.isFinite(value) ? value : 0;
}

function sortLanes(lanes) {
  return [...lanes].sort((left, right) => (Number(left.order) || 0) - (Number(right.order) || 0));
}

export function activeSprintOf(scrum = {}) {
  const sprints = Array.isArray(scrum.sprints) ? scrum.sprints : [];
  return sprints.find((sprint) => sprint.id === scrum.activeSprintId)
    || sprints.find((sprint) => sprint.status === "active")
    || null;
}

export function storiesForProjection(scrum = {}) {
  const stories = Array.isArray(scrum.stories) ? scrum.stories : [];
  const sprint = activeSprintOf(scrum);
  if (!sprint) return stories;
  return stories.filter((story) => story.sprintId === sprint.id);
}

export function buildScrumProjection(scrum = {}, { maxCards = 3 } = {}) {
  const stories = storiesForProjection(scrum);
  const lanes = sortLanes((Array.isArray(scrum.lanes) ? scrum.lanes : []).filter((lane) => lane.visible !== false));
  const cardsPerLane = Math.max(1, Number(maxCards) || 1);

  const projectedLanes = lanes.map((lane) => {
    const items = stories.filter((story) => story.laneId === lane.id);
    const cards = items.slice(0, cardsPerLane).map((story) => ({
      id: story.id,
      key: story.key || story.id || "",
      title: story.title || "História sem título",
      points: storyPoints(story),
      blocked: Boolean(story.impediment?.active)
    }));
    return {
      id: lane.id,
      name: lane.name || lane.id,
      color: lane.color || "#64748b",
      storyCount: items.length,
      points: items.reduce((total, story) => total + storyPoints(story), 0),
      cards
    };
  });

  const totalPoints = stories.reduce((total, story) => total + storyPoints(story), 0);
  const doneStories = stories.filter((story) => story.laneId === "concluido" || story.status === "done");
  const donePoints = doneStories.reduce((total, story) => total + storyPoints(story), 0);
  const blockedStories = stories.filter((story) => story.impediment?.active);
  const sprint = activeSprintOf(scrum);

  return {
    sprintName: sprint?.name || "Todas as sprints",
    sprintGoal: sprint?.goal || "",
    hasSprint: Boolean(sprint),
    lanes: projectedLanes,
    metrics: {
      stories: stories.length,
      points: totalPoints,
      doneStories: doneStories.length,
      donePoints,
      blockedStories: blockedStories.length,
      completion: totalPoints ? Math.round((donePoints / totalPoints) * 100) : 0
    }
  };
}
