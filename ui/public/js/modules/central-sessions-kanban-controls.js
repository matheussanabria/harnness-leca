// @ts-check
// Controles do Kanban da Central: "Mostrar mais" por raia e forçar o Kanban acima do teto.
// Liga os botões gerados por central-sessions-kanban.js; cada clique devolve o novo estado.

import { LANE_STEP, laneLimitFor } from "./central-sessions-kanban.js";

/**
 * @param {HTMLElement} container
 * @param {{ laneLimits?: Record<string, number> }} state
 * @param {(next: object) => void} onChange - recebe o novo estado
 * @returns {void}
 */
export function bindKanbanControls(container, state, onChange) {
  for (const button of Array.from(container.querySelectorAll("[data-lane-more]"))) {
    button.addEventListener("click", () => {
      const laneId = button.getAttribute("data-lane-more") || "";
      const laneLimits = { ...(state.laneLimits || {}), [laneId]: laneLimitFor(state.laneLimits || {}, laneId) + LANE_STEP };
      onChange({ ...state, laneLimits });
    });
  }

  const force = container.querySelector("[data-kanban-force]");
  force?.addEventListener("click", () => onChange({ ...state, kanbanForce: true }));
}
