// @ts-check
// Movimento de historias: rede, drag, foco e feedback; regras permanecem no backend.
import { showToast } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { ds } from "./design-scrum-store.js";
import { loadScrumData } from "./design-scrum-data.js";
import { renderCurrentScrumView } from "./design-scrum-view.js";
import { logScrumAction } from "./design-scrum-state.js";

let draggedStory = null;

function notify(message) {
  const toast = document.getElementById("syncToast");
  if (toast) { toast.setAttribute("role", "status"); toast.setAttribute("aria-live", "polite"); }
  showToast(message);
}

function findStory(id) {
  return ds.currentScrumData?.stories?.find((story) => story.id === id || story.key === id);
}

function focusStory(id) {
  requestAnimationFrame(() => document.getElementById(`story_${id}`)?.focus());
}

async function persistTransition(storyId, fromLaneId, toLaneId) {
  const slug = state.P?.name || state.S?.active;
  const story = findStory(storyId);
  const response = await fetch(`/api/project/${encodeURIComponent(slug)}/scrum/story/transition`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storyId, fromLaneId, toLaneId }),
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 409) {
      await loadScrumData(slug);
      renderCurrentScrumView();
      focusStory(storyId);
    }
    throw new Error(data.error || "Falha ao mover historia.");
  }
  ds.currentScrumData = data.scrum;
  renderCurrentScrumView();
  focusStory(storyId);
  const lane = data.scrum.lanes?.find((item) => item.id === toLaneId);
  void logScrumAction("transicao-de-historia", `${story?.key || storyId}:${lane?.name || toLaneId}`);
  notify(`${story?.key || storyId} movida para ${lane?.name || toLaneId}.`);
}

async function move(storyId, fromLaneId, toLaneId) {
  if (!toLaneId || fromLaneId === toLaneId) return;
  try { await persistTransition(storyId, fromLaneId, toLaneId); }
  catch (error) { notify(error.message); }
}

export function registerStoryTransitions() {
  const moveScrumStoryByStep = (storyId, direction) => {
    const story = findStory(storyId);
    const allowed = ds.currentScrumData?.storyTransitions?.[story?.id];
    const target = direction < 0 ? allowed?.backward : allowed?.forward;
    if (story) move(story.id, story.laneId, target);
  };
  const startScrumStoryDrag = (event, storyId, laneId) => {
    event.stopPropagation();
    draggedStory = { storyId, laneId };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", storyId);
  };
  const endScrumStoryDrag = () => { draggedStory = null; };
  const allowScrumStoryDrop = (event, laneId) => {
    if (!draggedStory || draggedStory.laneId === laneId) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
  };
  const dropScrumStory = (event, laneId) => {
    if (!draggedStory) return;
    event.preventDefault();
    event.stopPropagation();
    const source = draggedStory;
    draggedStory = null;
    move(source.storyId, source.laneId, laneId);
  };
  Object.assign(window, {
    moveScrumStoryByStep,
    startScrumStoryDrag,
    endScrumStoryDrag,
    allowScrumStoryDrop,
    dropScrumStory,
  });
}
