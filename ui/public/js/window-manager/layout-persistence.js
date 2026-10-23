// @ts-check
/**
 * Gerenciador de Persistência e Restauração de Layout
 * Responsabilidade Única: Serializar com versionamento de schema (_v: 1), validar e restaurar layouts de janelas confinados em viewport.
 */

import { constrainBounds } from "./drag-resize.js";

export const SCHEMA_VERSION = 1;
export const STORAGE_PREFIX = "dai:wm:layout:";

/**
 * @typedef {Object} SerializedWindow
 * @property {string} id
 * @property {string} moduleId
 * @property {string} [projectId]
 * @property {string} [resourceId]
 * @property {import("../types/window-manager").WindowPresentation} presentation
 * @property {import("../types/window-manager").WindowVisibility} visibility
 * @property {import("../types/window-manager").WindowBounds} bounds
 * @property {boolean} isFocused
 */

/**
 * @typedef {Object} LayoutPayload
 * @property {number} _v
 * @property {number} updatedAt
 * @property {string} projectId
 * @property {SerializedWindow[]} windows
 * @property {string | null} activeWindowId
 */

/**
 * Serializa o estado atual do WindowStore em um snapshot versionado
 * @param {import("../types/window-manager").WindowManagerState} state
 * @param {{ projectId?: string }} [metadata]
 * @returns {LayoutPayload}
 */
export function serializeLayout(state, metadata = {}) {
  const projectId = metadata.projectId || "default";

  /** @type {SerializedWindow[]} */
  const windows = (state.windows || []).map((win) => ({
    id: win.id,
    moduleId: win.moduleId,
    projectId: win.projectId || projectId,
    resourceId: win.resourceId,
    presentation: win.presentation || "floating",
    visibility: win.visibility || "visible",
    bounds: { ...win.bounds },
    isFocused: Boolean(win.isFocused)
  }));

  return {
    _v: SCHEMA_VERSION,
    updatedAt: Date.now(),
    projectId,
    windows,
    activeWindowId: state.activeWindowId || null
  };
}

/**
 * Valida a integridade do payload e confina os limites das janelas ao viewport atual
 * @param {any} payload
 * @param {{ width: number, height: number }} viewport
 * @param {string[]} [allowedModuleIds]
 * @returns {LayoutPayload | null}
 */
export function validateAndSanitizeLayout(payload, viewport, allowedModuleIds) {
  if (!payload || typeof payload !== "object") return null;
  if (payload._v !== SCHEMA_VERSION) {
    console.warn(`[LayoutPersistence] Versão de schema incompatível: ${payload._v} (esperado: ${SCHEMA_VERSION})`);
    return null;
  }
  if (!Array.isArray(payload.windows)) return null;

  const allowedSet = allowedModuleIds ? new Set(allowedModuleIds) : null;

  /** @type {SerializedWindow[]} */
  const sanitizedWindows = [];

  for (const win of payload.windows) {
    if (!win || typeof win !== "object") continue;
    if (!win.id || !win.moduleId) continue;
    if (allowedSet && !allowedSet.has(win.moduleId)) continue;

    const rawBounds = win.bounds || { x: 80, y: 80, width: 640, height: 480 };
    const bounds = constrainBounds(rawBounds, viewport);

    sanitizedWindows.push({
      id: String(win.id),
      moduleId: String(win.moduleId),
      projectId: win.projectId ? String(win.projectId) : undefined,
      resourceId: win.resourceId ? String(win.resourceId) : undefined,
      presentation: win.presentation || "floating",
      visibility: win.visibility === "minimized" ? "minimized" : "visible",
      bounds,
      isFocused: Boolean(win.isFocused)
    });
  }

  return {
    _v: SCHEMA_VERSION,
    updatedAt: Number(payload.updatedAt) || Date.now(),
    projectId: String(payload.projectId || "default"),
    windows: sanitizedWindows,
    activeWindowId: payload.activeWindowId ? String(payload.activeWindowId) : null
  };
}

/**
 * Aplica um layout validado e remapeia IDs serializados para as novas instâncias.
 * @param {import("./window-store").WindowStore} store
 * @param {LayoutPayload} layout
 * @param {string} [projectSlug]
 * @returns {Map<string, string>}
 */
export function applyLayout(store, layout, projectSlug = layout.projectId) {
  const restoredIds = new Map();
  store.reset();

  layout.windows.forEach((win) => {
    const restored = store.open(win.moduleId, {
      bounds: win.bounds,
      presentation: win.presentation,
      projectId: projectSlug || win.projectId,
      resourceId: win.resourceId
    });
    restoredIds.set(win.id, restored.id);
    if (win.visibility === "minimized") store.minimize(restored.id);
  });

  const activeId = layout.activeWindowId
    ? restoredIds.get(layout.activeWindowId)
    : undefined;
  if (activeId) store.focus(activeId);
  return restoredIds;
}

/**
 * Orquestrador de armazenamento para persistência por projeto
 */
export class LayoutPersistenceManager {
  /**
   * @param {import("./window-store").WindowStore} store
   * @param {Storage | { getItem: (k: string) => string | null, setItem: (k: string, v: string) => void, removeItem: (k: string) => void }} [storage]
   */
  constructor(store, storage = null) {
    this.store = store;
    this.storage = storage;
  }

  /**
   * Salva o layout do projeto no storage
   * @param {string} projectSlug
   * @returns {boolean}
   */
  save(projectSlug) {
    if (!this.storage) return false;
    try {
      const state = this.store.getState();
      const payload = serializeLayout(state, { projectId: projectSlug });
      const key = `${STORAGE_PREFIX}${projectSlug || "default"}`;
      this.storage.setItem(key, JSON.stringify(payload));
      return true;
    } catch (err) {
      console.warn("[LayoutPersistence] Falha ao salvar layout:", err);
      return false;
    }
  }

  /**
   * Restaura o layout salvo para o projeto atual
   * @param {string} projectSlug
   * @param {{ width: number, height: number }} viewport
   * @param {string[]} [allowedModuleIds]
   * @returns {boolean}
   */
  restore(projectSlug, viewport, allowedModuleIds) {
    if (!this.storage) return false;
    try {
      const key = `${STORAGE_PREFIX}${projectSlug || "default"}`;
      const raw = this.storage.getItem(key);
      if (!raw) return false;

      const parsed = JSON.parse(raw);
      const sanitized = validateAndSanitizeLayout(parsed, viewport, allowedModuleIds);
      if (!sanitized) return false;

      applyLayout(this.store, sanitized, projectSlug);
      return true;
    } catch (err) {
      console.warn("[LayoutPersistence] Falha ao restaurar layout:", err);
      return false;
    }
  }

  /**
   * Remove o layout salvo do projeto
   * @param {string} projectSlug
   */
  clear(projectSlug) {
    if (!this.storage) return false;
    try {
      const key = `${STORAGE_PREFIX}${projectSlug || "default"}`;
      this.storage.removeItem(key);
      return true;
    } catch (_) {
      return false;
    }
  }
}
