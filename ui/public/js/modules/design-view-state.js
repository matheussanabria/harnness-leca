// @ts-check
// Restauração da view ativa do Design no F5 (EP-14.12).
import { readStudioState, saveStudioState } from "./studio-state.js";
import { getRouter, routeTo, VIEW_SCREENS } from "../shared/router.js";

const DESIGN_VIEWS = new Set(["scrum", "layers", "board", "audit", "prototypes", "artifacts", "routines"]);
let savedDesign = null;

/** @param {unknown} value */
export function validDesignView(value) {
  return typeof value === "string" && DESIGN_VIEWS.has(value) ? value : "";
}

function loadSavedDesign(options = {}) {
  if (!savedDesign || options.client) {
    savedDesign = readStudioState({ client: options.client })
      .then((saved) => ({
        view: validDesignView(saved.designView) || "scrum",
        open: saved.designOpen === true,
      }))
      .catch(() => ({ view: "scrum", open: false }));
  }
  return savedDesign;
}

export async function restoredDesignView(options = {}) {
  return (await loadSavedDesign(options)).view;
}

export async function restoredDesignState(options = {}) {
  return loadSavedDesign(options);
}

/** @param {string} view @param {boolean} open */
export function persistDesignView(view, open) {
  void saveStudioState({ designView: view, designOpen: open });
  const route = getRouter()?.current();
  if (open) {
    // Switching tabs adds a history entry (Back returns to the previous tab); the prototype in the address is kept.
    routeTo(view, route && route.screen === view ? route.params : [], { push: true });
  } else if (route && VIEW_SCREENS.includes(route.screen)) {
    routeTo("chats", [], { push: true });
  }
}
