// @ts-check
// DOM glue of the office Scrum board: renders the controller state and routes clicks, drag and keyboard to its actions.
// Handlers are assigned as properties (not addEventListener) so remounting the same container never stacks listeners.
import { esc } from "../../shared/dom.js";
import { createScrumApi } from "./scrum-board-api.js";
import { createBoardController } from "./scrum-board-controller.js";
import { boardHtml } from "./scrum-board-view.js";
import { detailHtml, sprintBarHtml } from "./scrum-board-sprint-view.js";

/** @type {(() => void) | null} */
let detachExternal = null;

/**
 * @param {HTMLElement} el
 * @param {string} slug
 * @param {{ publish?: (scrum: any) => void, onSubtitle?: (text: string) => void, fetchImpl?: typeof fetch }} [hooks]
 * @returns {Promise<ReturnType<typeof createBoardController>>}
 */
export async function mountScrumBoard(el, slug, hooks = {}) {
  detachExternal?.();
  const storageKey = `office.scrumBoard.view.${slug}`;
  const storage = {
    get: () => { try { return sessionStorage.getItem(storageKey); } catch { return null; } },
    set: (/** @type {string} */ value) => { try { sessionStorage.setItem(storageKey, value); } catch { /* storage is optional */ } },
  };
  const controller = createBoardController({ api: createScrumApi(slug, hooks.fetchImpl), publish: hooks.publish, storage });
  const { state } = controller;
  /** @type {string | null} */
  let dragId = null;

  function render() {
    if (state.loading && !state.scrum) { el.innerHTML = `<p class="sb-empty">Carregando Scrum...</p>`; return; }
    if (!state.scrum) { el.innerHTML = `<p class="sb-empty is-danger">${esc(state.message ? state.message.text : "Scrum indisponivel.")}</p>`; return; }
    const scrum = state.scrum;
    const story = state.selectedId ? scrum.stories.find((item) => item.id === state.selectedId) : null;
    const message = state.message ? `<p class="sb-message is-${state.message.kind}" role="status">${esc(state.message.text)}</p>` : "";
    el.innerHTML = `<div class="sb-root">${sprintBarHtml({ scrum, viewId: state.viewId, busy: state.busy, confirmClose: state.confirmClose })}${message}
      <div class="sb-main">${boardHtml({ scrum, viewId: state.viewId, selectedId: state.selectedId, busy: state.busy })}${story ? detailHtml(scrum, story, state.trace, state.impedimentForm, state.busy) : ""}</div></div>`;
    const sprint = scrum.sprints.find((item) => item.id === state.viewId);
    hooks.onSubtitle?.(sprint ? `${sprint.name} - ${sprint.status}` : "Todas as historias");
  }

  const attr = (/** @type {Element | null} */ node, /** @type {string} */ name) => node?.getAttribute(name) ?? null;

  el.onclick = (event) => {
    const target = /** @type {Element} */ (event.target);
    const closest = (/** @type {string} */ selector) => target.closest(selector);
    const move = closest("[data-move]");
    if (move) { event.stopPropagation(); void controller.move(/** @type {string} */ (attr(move, "data-move")), /** @type {string} */ (attr(move, "data-to"))); return; }
    const start = closest("[data-sprint-start]");
    if (start) { void controller.startSprint(/** @type {string} */ (attr(start, "data-sprint-start"))); return; }
    if (closest("[data-sprint-close-ask]")) { controller.requestClose(); return; }
    if (closest("[data-sprint-close-cancel]")) { controller.cancelClose(); return; }
    const close = closest("[data-sprint-close]");
    if (close) {
      const carry = /** @type {HTMLSelectElement | null} */ (el.querySelector("[data-carry]"));
      const value = carry?.value || "backlog";
      void controller.closeSprint(/** @type {string} */ (attr(close, "data-sprint-close")), value === "backlog" ? "backlog" : "next", value);
      return;
    }
    if (closest("[data-story-close]")) { void controller.selectStory(null); return; }
    if (closest("[data-impediment-toggle]")) { controller.toggleImpedimentForm(); return; }
    if (closest("[data-impediment-resolve]")) { void controller.setImpediment(false, ""); return; }
    if (closest("[data-impediment-save]")) {
      const input = /** @type {HTMLInputElement | null} */ (el.querySelector("[data-impediment-reason]"));
      void controller.setImpediment(true, input?.value || "");
      return;
    }
    const card = closest("[data-story]");
    if (card) void controller.selectStory(attr(card, "data-story"));
  };

  el.onchange = (event) => {
    const select = /** @type {HTMLSelectElement} */ (event.target);
    if (select.matches("[data-view]")) controller.selectView(select.value);
  };

  el.onkeydown = (event) => {
    const card = /** @type {Element} */ (event.target).closest?.("[data-story]");
    if (card && (event.key === "Enter" || event.key === " ") && /** @type {Element} */ (event.target) === card) {
      event.preventDefault();
      void controller.selectStory(attr(card, "data-story"));
    }
  };

  el.ondragstart = (event) => {
    const card = /** @type {Element} */ (event.target).closest?.("[data-story]");
    dragId = attr(card || null, "data-story");
    if (dragId && event.dataTransfer) { event.dataTransfer.setData("text/plain", dragId); event.dataTransfer.effectAllowed = "move"; }
  };
  el.ondragover = (event) => {
    const lane = /** @type {Element} */ (event.target).closest?.("[data-lane]");
    const story = dragId ? state.scrum?.stories.find((item) => item.id === dragId) : null;
    const targets = story ? state.scrum.storyTransitions?.[story.id] : null;
    const laneId = attr(lane || null, "data-lane");
    if (laneId && targets && (targets.forward === laneId || targets.backward === laneId)) event.preventDefault();
  };
  el.ondrop = (event) => {
    event.preventDefault();
    const lane = /** @type {Element} */ (event.target).closest?.("[data-lane]");
    const laneId = attr(lane || null, "data-lane");
    if (dragId && laneId) void controller.move(dragId, laneId);
    dragId = null;
  };

  controller.subscribe(render);
  /** @param {Event} event */
  const onExternal = (event) => controller.applyExternal(/** @type {CustomEvent} */ (event).detail?.scrum);
  window.addEventListener("dai:scrumChanged", onExternal);
  detachExternal = () => window.removeEventListener("dai:scrumChanged", onExternal);

  render();
  await controller.load();
  return controller;
}
