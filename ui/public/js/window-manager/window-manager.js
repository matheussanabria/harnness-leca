// @ts-check
/**
 * Fachada do Window Manager
 * Responsabilidade Única: Expor a API unificada de gerenciamento de janelas para módulos do frontend.
 */

import * as registry from "./window-registry.js";
import { WindowStore } from "./window-store.js";
import { windowLifecycle } from "./window-lifecycle.js";
import { WorkspacePresetManager } from "./workspace-presets.js";
import { WorkspaceSession } from "./workspace-session.js";
import { WorkspacePersistenceManager } from "./workspace-persistence.js";
import { projectSelection } from "../shared/project-selection.js";
import { unsavedChanges } from "../shared/unsaved-changes.js";

/** @typedef {import("../types/window-manager").WindowInstance} WindowInstance */
/** @typedef {import("../types/window-manager").WindowManagerState} WindowManagerState */
/** @typedef {import("../types/window-manager").WindowOpenOptions} WindowOpenOptions */
/** @typedef {import("../types/window-manager").ModuleDescriptor} ModuleDescriptor */

export const store = new WindowStore(registry);
export const workspaceSession = new WorkspaceSession(
  new WorkspacePresetManager(store),
  {
    getProjectSlug: () => projectSelection.activeProject,
    getViewport: () => ({
      width: globalThis.innerWidth || 1280,
      height: globalThis.innerHeight || 720
    }),
    assertTransition: (context) => unsavedChanges.assertCanTransition(context)
  }
);
export const workspacePersistence = new WorkspacePersistenceManager(store, {
  getProjectSlug: () => projectSelection.activeProject,
  getViewport: () => ({
    width: globalThis.innerWidth || 1280,
    height: globalThis.innerHeight || 720
  }),
  getAllowedModuleIds: () => registry.listModules().map((module) => module.id)
});

export const windowManager = {
  // --- Módulos & Catálogo ---
  registerModule: registry.registerModule,
  unregisterModule: registry.unregisterModule,
  getModule: registry.getModule,
  listModules: registry.listModules,

  // --- Layouts nomeados ---
  workspaces: {
    list: (projectSlug) => workspaceSession.list(projectSlug),
    save: (name, icon, projectSlug) => workspaceSession.save(name, icon, projectSlug),
    load: (workspaceId, viewport, projectSlug, options) => (
      workspaceSession.load(workspaceId, viewport, projectSlug, options)
    ),
    delete: (workspaceId, projectSlug) => workspaceSession.delete(workspaceId, projectSlug),
    getState: () => workspaceSession.getState(),
    subscribe: (listener) => workspaceSession.subscribe(listener)
  },

  // --- Alterações não salvas ---
  unsaved: {
    mark: (id, change) => unsavedChanges.mark(id, change),
    clear: (id) => unsavedChanges.clear(id),
    list: (context) => unsavedChanges.list(context),
    hasChanges: (context) => unsavedChanges.hasChanges(context),
    subscribe: (listener) => unsavedChanges.subscribe(listener)
  },

  // --- Persistência do contexto ---
  persistence: {
    save: (context, projectSlug) => workspacePersistence.save(context, projectSlug),
    restore: (options, projectSlug) => workspacePersistence.restore(options, projectSlug),
    clear: (projectSlug) => workspacePersistence.clear(projectSlug)
  },

  // --- Ações de Janela ---
  /**
   * Abre uma janela ou foca se já existente
   * @param {string} moduleId
   * @param {WindowOpenOptions} [options]
   * @returns {WindowInstance}
   */
  open(moduleId, options) {
    return store.open(moduleId, options);
  },

  /**
   * Traz janela para o foco e topo
   * @param {string} windowId
   */
  focus(windowId) {
    store.focus(windowId);
  },

  /**
   * Minimiza a janela
   * @param {string} windowId
   */
  minimize(windowId) {
    store.minimize(windowId);
  },

  /**
   * Restaura janela minimizada
   * @param {string} windowId
   */
  restore(windowId) {
    store.restore(windowId);
  },

  /**
   * Fecha a janela e executa callbacks de limpeza de recursos
   * @param {string} windowId
   */
  close(windowId) {
    windowLifecycle.triggerClose(windowId);
    store.close(windowId);
  },

  /**
   * Registra hook de limpeza a ser executado no fechamento da janela
   * @param {string} windowId
   * @param {() => void} cleanupFn
   */
  onClose(windowId, cleanupFn) {
    return windowLifecycle.onClose(windowId, cleanupFn);
  },

  /**
   * Salva estado transiente para restauração pós-minimização
   * @param {string} windowId
   * @param {Record<string, any>} state
   */
  saveState(windowId, state) {
    windowLifecycle.saveState(windowId, state);
  },

  /**
   * Obtém o estado salvo de uma janela
   * @param {string} windowId
   * @returns {Record<string, any> | null}
   */
  getSavedState(windowId) {
    return windowLifecycle.getState(windowId);
  },

  /**
   * Alterna maximização
   * @param {string} windowId
   */
  toggleMaximize(windowId) {
    store.toggleMaximize(windowId);
  },

  /**
   * Define modo de apresentação (sidebar, floating, docked, maximized)
   * @param {string} windowId
   * @param {import("../types/window-manager").WindowPresentation} presentation
   */
  setPresentation(windowId, presentation) {
    store.setPresentation(windowId, presentation);
  },

  /**
   * Atualiza dimensões/posição
   * @param {string} windowId
   * @param {Partial<import("../types/window-manager").WindowBounds>} bounds
   */
  setBounds(windowId, bounds) {
    store.setBounds(windowId, bounds);
  },

  // --- Estado & Eventos ---
  getState() {
    return store.getState();
  },

  /**
   * Retorna a janela focada atual
   * @returns {WindowInstance | null}
   */
  getFocusedWindow() {
    return store.getFocusedWindow();
  },

  subscribe(listener) {
    return store.subscribe(listener);
  },

  reset() {
    windowLifecycle.reset();
    store.reset();
  }
};

export default windowManager;
