// @ts-check
// Filtros compartilhados entre Kanban e Backlog (EP-05.05).
import { ds } from "./design-scrum-store.js";

export function isStoryBlocked(story) {
  return Boolean(story?.impediment?.active);
}

export function normalizeFilterText(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function currentStoryFilters() {
  return {
    query: ds.currentSearchQuery || "",
    assignee: ds.currentAssigneeFilter || "all",
    onlyImpediments: Boolean(ds.onlyImpediments),
  };
}

/**
 * @param {any} story
 * @param {{ query?: string, assignee?: string, onlyImpediments?: boolean }} [filters]
 */
export function storyMatchesFilters(story, filters = {}) {
  if (filters.onlyImpediments && !isStoryBlocked(story)) return false;
  if (filters.assignee && filters.assignee !== "all" && String(story.assignee || "") !== filters.assignee) return false;
  const query = normalizeFilterText(filters.query);
  if (!query) return true;
  const haystack = normalizeFilterText([
    story.key,
    story.title,
    story.description,
    story.assignee,
    story.impediment?.reason,
  ].filter(Boolean).join(" "));
  return haystack.includes(query);
}

export function applyStoryFilters(stories = [], filters = {}) {
  return stories.filter((story) => storyMatchesFilters(story, filters));
}

export function storiesForSprint(stories = [], scrum = {}, selectedFilter = ds.selectedSprintFilter) {
  const current = selectedFilter || (scrum.activeSprintId ? "active" : "all");
  if (current === "all") return stories;
  const targetSprintId = current === "active" ? scrum.activeSprintId : current;
  return stories.filter((story) => story.sprintId === targetSprintId);
}

/**
 * @param {any} scrum
 * @param {{ scope?: "sprint" | "all", filters?: Record<string, any> }} [options]
 */
export function visibleStories(scrum = {}, { scope = "all", filters = currentStoryFilters() } = {}) {
  const stories = Array.isArray(scrum.stories) ? scrum.stories : [];
  const scoped = scope === "sprint" ? storiesForSprint(stories, scrum) : stories;
  return applyStoryFilters(scoped, filters);
}

export function listStoryAssignees(stories = []) {
  return [...new Set(stories.map((story) => String(story.assignee || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
