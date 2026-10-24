// @ts-check
/**
 * Window Manager bootstrap for the office.
 * Single responsibility: build persistence/responsive managers once, restore on boot
 * and save the active project layout (debounced) when windows change.
 */

import { windowManager, store } from "./window-manager.js";
import * as registry from "./window-registry.js";
import { LayoutPersistenceManager } from "./layout-persistence.js";
import { ResponsiveLayoutManager } from "./responsive-layout.js";

const DEFAULT_DEBOUNCE_MS = 300;

function defaultViewport() {
  return {
    width: globalThis.innerWidth || 1280,
    height: globalThis.innerHeight || 720
  };
}

/**
 * @param {{
 *   manager?: any,
 *   store?: import("./window-store").WindowStore,
 *   storage?: any,
 *   getProjectSlug?: () => string,
 *   getViewport?: () => { width: number, height: number },
 *   getAllowedModuleIds?: () => string[],
 *   layoutPersistence?: LayoutPersistenceManager,
 *   responsiveLayout?: ResponsiveLayoutManager | null,
 *   win?: any,
 *   debounceMs?: number
 * }} [options]
 */
export function createWindowManagerBootstrap(options = {}) {
  const manager = options.manager || windowManager;
  const storeRef = options.store || store;
  const storage = options.storage || null;
  const getProjectSlug = options.getProjectSlug || (() => "");
  const getViewport = options.getViewport || defaultViewport;
  const getAllowedModuleIds = options.getAllowedModuleIds
    || (() => registry.listModules().map((module) => module.id));
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const win = options.win ?? (typeof window !== "undefined" ? window : undefined);

  const layoutPersistence = options.layoutPersistence
    || new LayoutPersistenceManager(storeRef, storage);
  const responsiveLayout = options.responsiveLayout !== undefined
    ? options.responsiveLayout
    : (win ? new ResponsiveLayoutManager(storeRef, win) : null);

  let timer = null;
  let restoring = false;
  let disposed = false;
  let unsubscribe = null;

  const currentProject = (projectSlug) => (typeof projectSlug === "string" ? projectSlug : getProjectSlug()) || "";

  function saveNow(projectSlug) {
    const project = currentProject(projectSlug);
    if (!project || !storage) return false;
    return layoutPersistence.save(project);
  }

  function scheduleSave() {
    if (restoring || disposed || !storage) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      saveNow();
    }, debounceMs);
  }

  function restore(projectSlug) {
    const project = currentProject(projectSlug);
    if (!project) return false;
    restoring = true;
    try {
      return layoutPersistence.restore(project, getViewport(), getAllowedModuleIds());
    } finally {
      restoring = false;
    }
  }

  function start(projectSlug) {
    if (unsubscribe || disposed) return api;
    restore(projectSlug);
    responsiveLayout?.attach();
    unsubscribe = manager.subscribe(scheduleSave);
    return api;
  }

  function dispose() {
    disposed = true;
    clearTimeout(timer);
    timer = null;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    responsiveLayout?.detach();
  }

  const api = {
    manager,
    layoutPersistence,
    responsiveLayout,
    start,
    restore,
    saveNow,
    scheduleSave,
    dispose
  };

  if (manager && typeof manager === "object") {
    manager.layoutPersistence = layoutPersistence;
    manager.responsiveLayout = responsiveLayout;
  }

  return api;
}
