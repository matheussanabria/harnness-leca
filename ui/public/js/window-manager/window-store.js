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

import { pickTopVisibleWindowId } from "./window-store-focus.js";
import { buildWindowInstance } from "./window-store-instance.js";

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
    this.instanceSeq = 0;
    /** @type {Set<WindowManagerListener>} */
    this.listeners = new Set();
  }

  /**
   * Identificador único e monótono para janelas multi-instância.
   * Data e aleatório colidiam quando duas janelas abriam no mesmo milissegundo.
   * @returns {number}
   */
  nextInstanceSeq() {
    this.instanceSeq += 1;
    return this.instanceSeq;
  }

  /**
   * Abre ou foca uma janela com base no módulo
   * @param {string} moduleId
   * @param {WindowOpenOptions} [options]
   * @returns {WindowInstance}
   */
  open(moduleId, options = {}) {
    const descriptor = this.registry.getModule(moduleId);
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

    this.highestZIndex += 1;
    const instance = buildWindowInstance({
      moduleId,
      options,
      descriptor,
      isSingleton,
      sequence: isSingleton ? 0 : this.nextInstanceSeq(),
      zIndex: this.highestZIndex
    });

    // Desfoca outras janelas
    this.windows.forEach(w => { w.isFocused = false; });
    this.windows.set(instance.id, instance);
    this.activeWindowId = instance.id;

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
    const topId = pickTopVisibleWindowId(this.windows);

    if (topId) {
      this.windows.forEach((win) => {
        if (win.id === topId) win.isFocused = true;
      });
      this.activeWindowId = topId;
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
