// @ts-check
/**
 * Gerenciador de workspaces nomeados.
 * Responsabilidade única: persistir layouts customizados e aplicar presets.
 */

import { applyLayout, serializeLayout, validateAndSanitizeLayout } from "./layout-persistence.js";
import { SYSTEM_WORKSPACES } from "./workspace-templates.js";

export { SYSTEM_WORKSPACES } from "./workspace-templates.js";
export const WORKSPACE_STORAGE_PREFIX = "dai:wm:workspaces:";

/**
 * @typedef {Object} WorkspacePreset
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 * @property {string} description
 * @property {boolean} isSystem
 * @property {string} [templateKey]
 * @property {import("./layout-persistence.js").LayoutPayload} layout
 */

export class WorkspacePresetManager {
  /**
   * @param {import("./window-store").WindowStore} store
   * @param {Storage | { getItem: (key: string) => string | null, setItem: (key: string, value: string) => void, removeItem: (key: string) => void }} [storage]
   */
  constructor(store, storage = typeof window !== "undefined" ? window.localStorage : undefined) {
    this.store = store;
    this.storage = storage;
  }

  /** @param {string} projectSlug */
  #getStorageKey(projectSlug) {
    return `${WORKSPACE_STORAGE_PREFIX}${projectSlug || "default"}`;
  }

  /**
   * @param {string} projectSlug
   * @returns {WorkspacePreset[]}
   */
  #getCustomWorkspaces(projectSlug) {
    if (!this.storage) return [];
    try {
      const raw = this.storage.getItem(this.#getStorageKey(projectSlug));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  /**
   * @param {string} projectSlug
   * @returns {WorkspacePreset[]}
   */
  listWorkspaces(projectSlug) {
    return [...SYSTEM_WORKSPACES, ...this.#getCustomWorkspaces(projectSlug)];
  }

  /**
   * @param {string} projectSlug
   * @param {string} name
   * @param {string} [icon]
   * @returns {WorkspacePreset | null}
   */
  saveWorkspace(projectSlug, name, icon = "fa-solid fa-shapes") {
    if (!name || typeof name !== "string") return null;
    const trimmed = name.trim();
    if (!trimmed) return null;

    const id = `custom-${trimmed.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}`;
    /** @type {WorkspacePreset} */
    const workspace = {
      id,
      name: trimmed,
      icon,
      description: `Workspace customizado de ${projectSlug || "projeto"}`,
      isSystem: false,
      layout: serializeLayout(this.store.getState(), { projectId: projectSlug })
    };

    const updated = this.#getCustomWorkspaces(projectSlug).filter((item) => item.id !== id);
    updated.push(workspace);
    this.storage?.setItem(this.#getStorageKey(projectSlug), JSON.stringify(updated));
    return workspace;
  }

  /**
   * @param {string} projectSlug
   * @param {string} workspaceId
   * @param {{ width: number, height: number }} viewport
   */
  loadWorkspace(projectSlug, workspaceId, viewport) {
    const target = this.listWorkspaces(projectSlug).find((item) => item.id === workspaceId);
    if (!target?.layout) return false;
    const layout = validateAndSanitizeLayout(target.layout, viewport);
    if (!layout) return false;
    applyLayout(this.store, layout, projectSlug);
    return true;
  }

  /**
   * @param {string} projectSlug
   * @param {string} workspaceId
   */
  deleteWorkspace(projectSlug, workspaceId) {
    if (SYSTEM_WORKSPACES.some((item) => item.id === workspaceId)) return false;
    const current = this.#getCustomWorkspaces(projectSlug);
    const filtered = current.filter((item) => item.id !== workspaceId);
    if (filtered.length === current.length) return false;
    this.storage?.setItem(this.#getStorageKey(projectSlug), JSON.stringify(filtered));
    return true;
  }
}
