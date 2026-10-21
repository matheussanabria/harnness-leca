// @ts-check
// Metricas puras e barra visual da visao filtrada (EP-05.05).
import { isStoryBlocked } from "./design-scrum-filters.js";

/**
 * @param {any[]} stories
 * @param {any[]} lanes
 */
export function computeStoryMetrics(stories = [], lanes = []) {
  const totalStories = stories.length;
  const totalPoints = stories.reduce((total, story) => total + (Number(story.points) || 0), 0);
  const doneStories = stories.filter((story) => story.status === "done");
  const donePoints = doneStories.reduce((total, story) => total + (Number(story.points) || 0), 0);
  const blockedStories = stories.filter(isStoryBlocked);
  const blockedPoints = blockedStories.reduce((total, story) => total + (Number(story.points) || 0), 0);
  const visibleLaneIds = new Set((lanes || []).map((lane) => lane.id));
  const byLane = Object.fromEntries([...visibleLaneIds].map((laneId) => [laneId, { stories: 0, points: 0, blocked: 0 }]));
  for (const story of stories) {
    const entry = byLane[story.laneId];
    if (!entry) continue;
    entry.stories += 1;
    entry.points += Number(story.points) || 0;
    if (isStoryBlocked(story)) entry.blocked += 1;
  }

  return {
    totalStories,
    totalPoints,
    doneStories: doneStories.length,
    donePoints,
    blockedStories: blockedStories.length,
    blockedPoints,
    completionPercent: totalStories ? Math.round((doneStories.length / totalStories) * 100) : 0,
    byLane,
  };
}

export function renderScrumMetricsBar(metrics) {
  const items = [
    ["fa-list-check", "Histórias", String(metrics.totalStories)],
    ["fa-star", "Pontos", String(metrics.totalPoints)],
    ["fa-circle-check", "Concluídas", `${metrics.doneStories} (${metrics.completionPercent}%)`],
    ["fa-triangle-exclamation", "Impedidas", `${metrics.blockedStories} · ${metrics.blockedPoints} pts`],
  ];
  return `<div class="scrum-metrics-strip" role="status" aria-live="polite">${items.map(([icon, label, value]) => `
    <div class="scrum-metric-item"><i class="fa-solid ${icon}" aria-hidden="true"></i><span>${label}</span><b>${value}</b></div>`).join("")}
  </div>`;
}
