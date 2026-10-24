// @ts-check
/**
 * Office Window Manager controller.
 * Single responsibility: own the WM bootstrap and guard project switches with unsaved changes.
 */

import { officeState } from "../office-state.js";
import { windowManager } from "../window-manager/window-manager.js";
import { createWindowManagerBootstrap } from "../window-manager/wm-bootstrap.js";
import { guardUnsavedTransition } from "../shared/unsaved-dialog.js";
import { unsavedChanges } from "../shared/unsaved-changes.js";
import { officeSessionStorage } from "./office-session-storage.js";
import { mountWorkspaceMenu } from "./workspace-menu.js";

/** @type {ReturnType<typeof createWindowManagerBootstrap> | null} */
let bootstrap = null;
/** @type {ReturnType<typeof mountWorkspaceMenu> | null} */
let workspaceMenu = null;

/**
 * Builds the persistence/responsive managers, restores the active project layout
 * and mounts the workspace menu in the office HUD.
 * @returns {ReturnType<typeof createWindowManagerBootstrap>}
 */
export function bootOfficeWindowManager() {
  bootstrap = createWindowManagerBootstrap({
    storage: officeSessionStorage,
    getProjectSlug: () => officeState.activeProject || ""
  });
  workspaceMenu = mountWorkspaceMenu({
    container: /** @type {HTMLElement | null} */ (document.getElementById("workspaceMenu")),
    windowManager,
    getProjectSlug: () => officeState.activeProject || ""
  });
  return bootstrap.start(officeState.activeProject);
}

/**
 * Switches the office project, saving the current layout and restoring the next one.
 * @param {HTMLSelectElement} select
 * @returns {Promise<string>} selected slug, or "" when cancelled/failed
 */
export async function switchOfficeProject(select) {
  const slug = select.value;
  try {
    const selected = await guardUnsavedTransition(async ({ force }) => {
      bootstrap?.saveNow();
      const next = await officeState.setProject(slug, { force });
      if (!next) return "";
      if (!bootstrap?.restore(next)) windowManager.reset();
      return next;
    }, {
      title: "Trocar de projeto",
      message: "Há alterações não salvas. Como deseja continuar?",
      save: typeof globalThis.saveStudioSourceFile === "function"
        ? () => globalThis.saveStudioSourceFile()
        : undefined,
      clear: (id) => unsavedChanges.clear(id)
    });
    if (!selected) select.value = officeState.activeProject;
    return selected || "";
  } catch (error) {
    select.value = officeState.activeProject;
    console.error("[Office] Falha ao trocar de projeto:", error);
    return "";
  }
}

export function disposeOfficeWindowManager() {
  workspaceMenu?.dispose();
  workspaceMenu = null;
  bootstrap?.dispose();
  bootstrap = null;
}
