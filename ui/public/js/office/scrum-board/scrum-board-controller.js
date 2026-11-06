// @ts-check
// State and actions of the office Scrum board. The DOM glue renders `state` and calls these actions.
import { ALL, canMoveTo, pickViewId } from "./scrum-board-model.js";

/**
 * @param {{
 *   api: ReturnType<typeof import("./scrum-board-api.js").createScrumApi>,
 *   publish?: (scrum: any) => void,
 *   storage?: { get: () => string | null, set: (value: string) => void },
 * }} options
 */
export function createBoardController({ api, publish = () => {}, storage }) {
  const state = {
    /** @type {any} */ scrum: null,
    viewId: ALL,
    /** @type {string | null} */ selectedId: null,
    /** @type {{ kind: "ok" | "error", text: string } | null} */ message: null,
    busy: false,
    loading: true,
    confirmClose: false,
    impedimentForm: false,
    /** @type {{ storyId: string, ok: boolean, data?: any, error?: string } | null} */ trace: null,
  };
  /** @type {Set<() => void>} */
  const listeners = new Set();
  const emit = () => listeners.forEach((listener) => listener());

  /** @param {any} scrum */
  function setScrum(scrum) {
    state.scrum = scrum;
    state.viewId = pickViewId(scrum, state.viewId);
    if (state.selectedId && !scrum.stories.some((story) => story.id === state.selectedId)) state.selectedId = null;
  }

  /** Runs a mutation: on success adopts the returned Scrum and publishes it; on failure keeps the data and shows the error. */
  async function mutate(/** @type {() => Promise<any>} */ request, /** @type {string} */ okText) {
    if (state.busy) return false;
    state.busy = true;
    state.message = null;
    emit();
    const result = await request();
    state.busy = false;
    if (result.ok) {
      setScrum(result.data.scrum);
      state.message = { kind: "ok", text: okText };
      publish(result.data.scrum);
    } else {
      state.message = { kind: "error", text: result.error };
    }
    emit();
    return result.ok;
  }

  const storyOf = (/** @type {string} */ id) => state.scrum?.stories.find((story) => story.id === id) || null;

  return {
    state,
    subscribe(/** @type {() => void} */ listener) { listeners.add(listener); return () => listeners.delete(listener); },

    async load() {
      state.loading = true;
      emit();
      const result = await api.load();
      state.loading = false;
      if (result.ok) {
        state.viewId = pickViewId(result.data.scrum, storage?.get() ?? undefined);
        setScrum(result.data.scrum);
      } else {
        state.message = { kind: "error", text: result.error };
      }
      emit();
    },

    /** Data pushed from elsewhere (the office refresher); ignored when it is the object already shown. */
    applyExternal(/** @type {any} */ scrum) {
      if (!scrum || scrum === state.scrum || state.busy) return;
      setScrum(scrum);
      emit();
    },

    selectView(/** @type {string} */ viewId) {
      state.viewId = pickViewId(state.scrum, viewId);
      state.confirmClose = false;
      storage?.set(state.viewId);
      emit();
    },

    async selectStory(/** @type {string | null} */ id) {
      state.selectedId = id && storyOf(id) ? id : null;
      state.impedimentForm = false;
      state.trace = null;
      emit();
      if (!state.selectedId) return;
      const storyId = state.selectedId;
      const result = await api.trace(storyId);
      if (state.selectedId !== storyId) return; // another story was opened while loading
      state.trace = result.ok ? { storyId, ok: true, data: result.data } : { storyId, ok: false, error: result.error };
      emit();
    },

    async move(/** @type {string} */ storyId, /** @type {string} */ toLaneId) {
      const story = storyOf(storyId);
      if (!story || !canMoveTo(state.scrum, story, toLaneId)) {
        state.message = { kind: "error", text: "A historia so pode ir para a raia vizinha." };
        emit();
        return false;
      }
      return mutate(() => api.move(storyId, story.laneId, toLaneId), "Historia movida.");
    },

    startSprint: (/** @type {string} */ sprintId) => mutate(() => api.startSprint(sprintId), "Sprint iniciada."),

    requestClose() { state.confirmClose = true; emit(); },
    cancelClose() { state.confirmClose = false; emit(); },

    async closeSprint(/** @type {string} */ sprintId, /** @type {string} */ carryOver, /** @type {string} */ nextSprintId) {
      const options = carryOver === "next" ? { carryOver, nextSprintId } : { carryOver: "backlog" };
      const ok = await mutate(() => api.closeSprint(sprintId, options), "Sprint encerrada.");
      if (ok) state.confirmClose = false;
      return ok;
    },

    toggleImpedimentForm() { state.impedimentForm = !state.impedimentForm; emit(); },

    async setImpediment(/** @type {boolean} */ active, /** @type {string} */ reason) {
      if (!state.selectedId) return false;
      const ok = await mutate(() => api.setImpediment(/** @type {string} */ (state.selectedId), active, reason), active ? "Impedimento registrado." : "Impedimento resolvido.");
      if (ok) state.impedimentForm = false;
      return ok;
    },
  };
}
