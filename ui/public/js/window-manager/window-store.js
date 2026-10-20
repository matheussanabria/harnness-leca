// @ts-check
/**
 * Store Reativo de Instâncias do Window Manager
 * Responsabilidade Única: Gerenciar estado, ciclo de vida, foco e ordenação de janelas.
 */

/** @typedef {import("../types/window-manager").WindowInstance} WindowInstance */
/** @typedef {import("../types/window-manager").WindowManagerState} WindowManagerState */
/** @typedef {import("../types/window-manager").WindowOpenOptions} WindowOpenOptions */
/** @typedef {import("../types/window-manager").WindowManagerListener} WindowManagerListener */
/** @typedef {import("./window-registry.js")} WindowRegistryModule */

const BASE_Z_INDEX = 1000;

export class WindowStore {
  /**
   * @param {WindowRegistryModule} registryModule
   */
  constructor(registryModule) {
    this.registry = registryModule;
    /** @type {Map<string, WindowInstance>} */
    this.windows = new Map();
    /** @type {string | null} */
    this.activeWindowId = null;
    this.highestZIndex = BASE_Z_INDEX;
    /** @type {Set<WindowManagerListener>} */
    this.listeners = new Set();
  }

  /**
   * Abre ou foca uma janela com base no módulo
   * @param {string} moduleId
   * @param {WindowOpenOptions} [options]
   * @returns {WindowInstance}
   */
  open(moduleId, options = {}) {
    const descriptor = this.registry.getModule(moduleId);
    const title = options.title || descriptor?.title || moduleId;
    const icon = options.icon || descriptor?.icon || "fa-solid fa-window-maximize";
    const presentation = options.presentation || descriptor?.defaultPresentation || "floating";
    const isSingleton = descriptor?.isSingleton ?? true;

    // Se for singleton e já existir, restaura e foca
    if (isSingleton) {
      const existing = Array.from(this.windows.values()).find(w => w.moduleId === moduleId);
      if (existing) {
        if (existing.visibility === "minimized") {
          existing.visibility = "visible";
        }
        this.focus(existing.id);
        return existing;
      }
    }

    const id = isSingleton ? `win-${moduleId}` : `win-${moduleId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const bounds = {
      x: options.bounds?.x ?? descriptor?.defaultBounds?.x ?? 80,
      y: options.bounds?.y ?? descriptor?.defaultBounds?.y ?? 80,
      width: options.bounds?.width ?? descriptor?.defaultBounds?.width ?? 640,
      height: options.bounds?.height ?? descriptor?.defaultBounds?.height ?? 480
    };

    this.highestZIndex += 1;
    const instance = {
      id,
      moduleId,
      projectId: options.projectId,
      resourceId: options.resourceId,
      title,
      icon,
      presentation,
      visibility: "visible",
      bounds,
      zIndex: this.highestZIndex,
      isFocused: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Desfoca outras janelas
    this.windows.forEach(w => { w.isFocused = false; });
    this.windows.set(id, instance);
    this.activeWindowId = id;

    this.notify();
    return instance;
  }

  /**
   * Traz uma janela para o foco e para a camada mais alta
   * @param {string} windowId
   */
  focus(windowId) {
    const win = this.windows.get(windowId);
    if (!win) return;

    if (win.visibility === "minimized") {
      win.visibility = "visible";
    }

    this.highestZIndex += 1;
    win.zIndex = this.highestZIndex;
    win.updatedAt = Date.now();

    this.windows.forEach(w => {
      w.isFocused = w.id === windowId;
    });
    this.activeWindowId = windowId;

    this.notify();
  }

  /**
   * Minimiza uma janela e transfere o foco para a próxima
   * @param {string} windowId
   */
  minimize(windowId) {
    const win = this.windows.get(windowId);
    if (!win) return;

    win.visibility = "minimized";
    win.isFocused = false;
    win.updatedAt = Date.now();

    if (this.activeWindowId === windowId) {
      this.recalculateActiveFocus();
    }

    this.notify();
  }

  /**
   * Restaura uma janela minimizada
   * @param {string} windowId
   */
  restore(windowId) {
    const win = this.windows.get(windowId);
    if (!win) return;

    win.visibility = "visible";
    this.focus(windowId);
  }

  /**
   * Fecha e destrói uma instância de janela
   * @param {string} windowId
   */
  close(windowId) {
    if (!this.windows.has(windowId)) return;

    this.windows.delete(windowId);
    if (this.activeWindowId === windowId) {
      this.recalculateActiveFocus();
    }

    this.notify();
  }

  /**
   * Alterna maximização de uma janela preservando limites anteriores
   * @param {string} windowId
   */
  toggleMaximize(windowId) {
    const win = this.windows.get(windowId);
    if (!win) return;

    if (win.presentation === "maximized") {
      win.presentation = win.previousPresentation || "floating";
      if (win.previousBounds) {
        win.bounds = { ...win.previousBounds };
      }
    } else {
      win.previousPresentation = win.presentation;
      win.previousBounds = { ...win.bounds };
      win.presentation = "maximized";
    }

    this.focus(windowId);
  }

  /**
   * Altera o modo de apresentação (sidebar, floating, docked, maximized)
   * @param {string} windowId
   * @param {import("../types/window-manager").WindowPresentation} presentation
   */
  setPresentation(windowId, presentation) {
    const win = this.windows.get(windowId);
    if (!win) return;

    win.presentation = presentation;
    win.updatedAt = Date.now();
    this.notify();
  }

  /**
   * Atualiza as dimensões e posição da janela
   * @param {string} windowId
   * @param {Partial<import("../types/window-manager").WindowBounds>} bounds
   */
  setBounds(windowId, bounds) {
    const win = this.windows.get(windowId);
    if (!win) return;

    win.bounds = { ...win.bounds, ...bounds };
    win.updatedAt = Date.now();
    this.notify();
  }

  /**
   * Transfere o foco para a janela visível com maior zIndex
   */
  recalculateActiveFocus() {
    let topWin = null;
    let maxZ = -1;

    this.windows.forEach(w => {
      if (w.visibility === "visible" && w.zIndex > maxZ) {
        maxZ = w.zIndex;
        topWin = w;
      }
    });

    if (topWin) {
      // @ts-ignore
      topWin.isFocused = true;
      // @ts-ignore
      this.activeWindowId = topWin.id;
    } else {
      this.activeWindowId = null;
    }
  }

  /**
   * Retorna snapshot imutável do estado atual
   * @returns {WindowManagerState}
   */
  getState() {
    return {
      windows: Array.from(this.windows.values()).map(w => ({ ...w, bounds: { ...w.bounds } })),
      activeWindowId: this.activeWindowId,
      baseZIndex: BASE_Z_INDEX,
      highestZIndex: this.highestZIndex
    };
  }

  /**
   * Retorna uma janela específica pelo ID
   * @param {string} windowId
   * @returns {WindowInstance | null}
   */
  getWindow(windowId) {
    return this.windows.get(windowId) || null;
  }

  /**
   * Alias ergonômico para getWindow
   * @param {string} windowId
   * @returns {WindowInstance | null}
   */
  get(windowId) {
    return this.getWindow(windowId);
  }

  /**
   * Retorna a janela atualmente em foco, se houver
   * @returns {WindowInstance | null}
   */
  getFocusedWindow() {
    return this.activeWindowId ? this.windows.get(this.activeWindowId) || null : null;
  }

  /**
   * Inscreve um ouvinte para alterações no estado
   * @param {WindowManagerListener} listener
   * @returns {() => void} Função para cancelar inscrição
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notifica todos os ouvintes registrados
   */
  notify() {
    const state = this.getState();
    this.listeners.forEach(fn => {
      try { fn(state); } catch (err) { console.error("Erro no ouvinte do WindowStore:", err); }
    });
  }

  /**
   * Reseta todo o estado de janelas (útil para testes e trocas de projeto)
   */
  reset() {
    this.windows.clear();
    this.activeWindowId = null;
    this.highestZIndex = BASE_Z_INDEX;
    this.notify();
  }
}
