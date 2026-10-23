// @ts-check
/**
 * Persistência composta do workspace por projeto.
 * Responsabilidade única: armazenar layout e contexto opaco dos módulos.
 */

import {
  applyLayout,
  serializeLayout,
  validateAndSanitizeLayout
} from "./layout-persistence.js";

export const WORKSPACE_STATE_SCHEMA_VERSION = 1;
export const WORKSPACE_STATE_STORAGE_PREFIX = "dai:wm:state:";

/** @param {unknown} value */
function cloneRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const cloned = JSON.parse(JSON.stringify(value));
  return cloned && typeof cloned === "object" && !Array.isArray(cloned) ? cloned : null;
}

export class WorkspacePersistenceManager {
  /**
   * @param {import("./window-store").WindowStore} store
   * @param {{
   *   storage?: Storage | { getItem: (key: string) => string | null, setItem: (key: string, value: string) => void, removeItem: (key: string) => void },
   *   getProjectSlug?: () => string,
   *   getViewport?: () => { width: number, height: number },
   *   getAllowedModuleIds?: () => string[]
   * }} [options]
   */
  constructor(store, options = {}) {
    this.store = store;
    this.storage = options.storage || null;
    this.getProjectSlug = options.getProjectSlug || (() => "");
    this.getViewport = options.getViewport || (() => ({ width: 1280, height: 720 }));
    this.getAllowedModuleIds = options.getAllowedModuleIds || (() => []);
  }

  /**
   * @param {{ filters?: Record<string, unknown>, resources?: Record<string, unknown> }} [context]
   * @param {string} [projectSlug]
   */
  save(context = {}, projectSlug) {
    const project = this.#resolveProject(projectSlug);
    if (!project || !this.storage) return null;
    try {
      const filters = cloneRecord(context.filters || {});
      const resources = cloneRecord(context.resources || {});
      if (!filters || !resources) return null;
      const snapshot = {
        _v: WORKSPACE_STATE_SCHEMA_VERSION,
        updatedAt: Date.now(),
        projectId: project,
        layout: serializeLayout(this.store.getState(), { projectId: project }),
        filters,
        resources
      };
      this.storage.setItem(this.#key(project), JSON.stringify(snapshot));
      return snapshot;
    } catch (_) {
      return null;
    }
  }

  /**
   * @param {{ viewport?: { width: number, height: number }, allowedModuleIds?: string[] }} [options]
   * @param {string} [projectSlug]
   */
  restore(options = {}, projectSlug) {
    const project = this.#resolveProject(projectSlug);
    if (!project || !this.storage) return null;
    try {
      const raw = this.storage.getItem(this.#key(project));
      if (!raw) return null;
      const snapshot = JSON.parse(raw);
      const filters = cloneRecord(snapshot?.filters);
      const resources = cloneRecord(snapshot?.resources);
      if (
        snapshot?._v !== WORKSPACE_STATE_SCHEMA_VERSION
        || snapshot.projectId !== project
        || !filters
        || !resources
      ) return null;

      const allowed = options.allowedModuleIds || this.getAllowedModuleIds();
      const layout = validateAndSanitizeLayout(
        snapshot.layout,
        options.viewport || this.getViewport(),
        allowed.length ? allowed : undefined
      );
      if (!layout) return null;

      applyLayout(this.store, layout, project);
      return {
        projectSlug: project,
        updatedAt: Number(snapshot.updatedAt) || 0,
        filters,
        resources
      };
    } catch (_) {
      return null;
    }
  }

  /** @param {string} [projectSlug] */
  clear(projectSlug) {
    const project = this.#resolveProject(projectSlug);
    if (!project || !this.storage) return false;
    try {
      this.storage.removeItem(this.#key(project));
      return true;
    } catch (_) {
      return false;
    }
  }

  /** @param {string} projectSlug */
  #key(projectSlug) {
    return `${WORKSPACE_STATE_STORAGE_PREFIX}${projectSlug}`;
  }

  /** @param {string} [candidate] */
  #resolveProject(candidate) {
    const project = typeof candidate === "string" ? candidate : this.getProjectSlug();
    return typeof project === "string" ? project.trim() : "";
  }
}
