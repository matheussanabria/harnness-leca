// @ts-check
// Reordenação horizontal das raias com drag-and-drop e controles de teclado.
import { showToast } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { ds } from "./design-scrum-store.js";
import { loadScrumData } from "./design-scrum-data.js";
import { renderCurrentScrumView } from "./design-scrum-view.js";
import { replaceVisibleLaneOrder } from "./design-scrum-lane-order-model.js";

let draggedLaneId = null;

function notify(message) {
  const toast = document.getElementById("syncToast");
  toast?.setAttribute("role", "status");
  toast?.setAttribute("aria-live", "polite");
  showToast(message);
}

function focusLaneHandle(laneId) {
  const lane = [...document.querySelectorAll(".scrum-kanban-col")]
    .find((item) => /** @type {HTMLElement} */ (item).dataset.laneId === laneId);
  /** @type {HTMLButtonElement | null} */ (lane?.querySelector(".scrum-lane-drag") || null)?.focus();
}

async function persistLaneOrder(laneIds, focusedLaneId) {
  const slug = state.P?.name || state.S?.active;
  const expectedRevision = ds.currentScrumData?.lanesRevision ?? 0;
  const response = await fetch(`/api/project/${encodeURIComponent(slug)}/scrum/lanes/order`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ laneIds, expectedRevision }),
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 409) {
      await loadScrumData(slug);
      renderCurrentScrumView();
      focusLaneHandle(focusedLaneId);
    }
    throw new Error(data.error || "Falha ao salvar a ordem das raias.");
  }
  ds.currentScrumData = data.scrum;
  renderCurrentScrumView();
  focusLaneHandle(focusedLaneId);
  notify("Ordem das raias atualizada.");
}

export function registerLaneOrder() {
  const moveScrumLane = async (laneId, direction) => {
    const lanes = ds.currentScrumData?.lanes || [];
    const visibleIds = lanes.filter((lane) => lane.visible).map((lane) => lane.id);
    const index = visibleIds.indexOf(laneId);
    const target = index + Number(direction);
    if (index < 0 || target < 0 || target >= visibleIds.length) return;
    [visibleIds[index], visibleIds[target]] = [visibleIds[target], visibleIds[index]];
    try { await persistLaneOrder(replaceVisibleLaneOrder(lanes, visibleIds), laneId); }
    catch (error) { notify(error.message); }
  };
  const startScrumLaneDrag = (event, laneId) => {
    draggedLaneId = laneId;
    event.dataTransfer?.setData("text/plain", laneId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  };
  const allowScrumLaneDrop = (event) => event.preventDefault();
  const dropScrumLane = async (event, targetLaneId) => {
    event.preventDefault();
    const sourceLaneId = event.dataTransfer?.getData("text/plain") || draggedLaneId;
    draggedLaneId = null;
    if (!sourceLaneId || sourceLaneId === targetLaneId) return;
    const lanes = ds.currentScrumData?.lanes || [];
    const visibleIds = lanes.filter((lane) => lane.visible).map((lane) => lane.id);
    const source = visibleIds.indexOf(sourceLaneId);
    const target = visibleIds.indexOf(targetLaneId);
    if (source < 0 || target < 0) return;
    [visibleIds[source], visibleIds[target]] = [visibleIds[target], visibleIds[source]];
    try { await persistLaneOrder(replaceVisibleLaneOrder(lanes, visibleIds), sourceLaneId); }
    catch (error) { notify(error.message); }
  };
  Object.assign(window, { moveScrumLane, startScrumLaneDrag, allowScrumLaneDrop, dropScrumLane });
}
