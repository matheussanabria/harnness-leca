// @ts-check
/**
 * Window Host para o Escritório (EP-01.12).
 * Responsabilidade Única: Gerenciar contêineres DOM individuais para cada janela aberta,
 * permitindo que múltiplas janelas fiquem abertas e visíveis simultaneamente,
 * com suporte a docking e agrupamento por abas.
 */

import { windowManager } from "./window-manager.js";
import { WindowDragResizeController } from "./drag-resize.js";
import { DockingManager } from "./docking-manager.js";

/** @typedef {import("../types/window-manager").WindowInstance} WindowInstance */

/**
 * Cria a estrutura DOM de um contêiner de janela individual
 * @param {WindowInstance} win
 * @returns {HTMLElement}
 */
export function createWindowContainer(win) {
  const container = document.createElement("aside");
  container.className = "office-drawer office-window-container";
  container.id = `officeWindow_${win.id}`;
  container.setAttribute("data-window-id", win.id);
  container.setAttribute("data-module-id", win.moduleId);

  container.innerHTML = `
    <div class="resize-handle" data-direction="both"></div>
    <div class="window-tab-bar" style="display: none;"></div>
    <div class="drawer-header">
      <div class="drawer-header-info">
        <div class="drawer-icon" data-ref="icon"><i class="${win.icon || 'fa-solid fa-window-maximize'}"></i></div>
        <div>
          <h2 class="drawer-title" data-ref="title">${win.title || 'Janela'}</h2>
          <div class="drawer-subtitle" data-ref="subtitle">Estação ativa</div>
        </div>
      </div>
      <div class="drawer-actions">
        <button class="drawer-action-btn" data-action="dock-left" title="Dock à Esquerda" aria-label="Dock à Esquerda"><i class="fa-solid fa-arrow-left"></i></button>
        <button class="drawer-action-btn" data-action="dock-right" title="Dock à Direita" aria-label="Dock à Direita"><i class="fa-solid fa-arrow-right"></i></button>
        <button class="drawer-action-btn" data-action="toggle-float" title="Alternar flutuante" aria-label="Alternar flutuante"><i class="fa-solid fa-up-right-from-square"></i></button>
        <button class="drawer-action-btn" data-action="minimize" title="Minimizar" aria-label="Minimizar"><i class="fa-solid fa-minus"></i></button>
        <button class="drawer-action-btn" data-action="maximize" title="Maximizar" aria-label="Maximizar"><i class="fa-solid fa-expand"></i></button>
        <button class="drawer-action-btn drawer-close" data-action="close" title="Fechar" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
      </div>
    </div>
    <div class="drawer-body" data-ref="body"></div>
  `;

  return container;
}

/**
 * Host multi-janela para o Escritório
 */
export class OfficeWindowHost {
  /**
   * @param {object} params
   * @param {HTMLElement} params.rootElement Contêiner pai onde as janelas são anexadas (ex: document.body)
   * @param {any} [params.wm] Instância do WindowManager
   * @param {(objectId: string, state: any, targetEl?: HTMLElement) => void} [params.renderContent]
   * @param {any} [params.officeState]
   */
  constructor({ rootElement, wm = windowManager, renderContent, officeState }) {
    this.root = rootElement;
    this.wm = wm;
    this.renderContent = renderContent;
    this.officeState = officeState;

    this.dockingManager = new DockingManager(this.wm.store);
    this.dragResize = new WindowDragResizeController({ windowManager: this.wm });

    /** @type {Map<string, { el: HTMLElement, renderedResourceId?: string }>} */
    this.windows = new Map();
    this.unsubscribe = null;
  }

  start() {
    this.unsubscribe = this.wm.subscribe((state) => this.sync(state));
    this.sync(this.wm.getState());
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    for (const [id, entry] of this.windows) {
      entry.el.remove();
    }
    this.windows.clear();
  }

  /**
   * @param {import("../types/window-manager").WindowManagerState} state
   */
  sync(state) {
    const activeIds = new Set();

    for (const win of state.windows) {
      if (win.visibility === "minimized") continue;

      activeIds.add(win.id);
      let entry = this.windows.get(win.id);

      if (!entry) {
        const el = createWindowContainer(win);
        this.root.appendChild(el);
        this.bindEvents(el, win.id);
        entry = { el };
        this.windows.set(win.id, entry);
      }

      this.updateWindowElement(entry.el, win, state.activeWindowId === win.id);

      // Renderiza conteúdo se ainda não tiver sido renderizado para este recurso
      const targetBody = entry.el.querySelector('[data-ref="body"]');
      if (targetBody && this.renderContent && entry.renderedResourceId !== win.resourceId) {
        entry.renderedResourceId = win.resourceId;
        const objectId = win.resourceId || win.moduleId;
        this.renderContent(objectId, this.officeState, /** @type {HTMLElement} */ (targetBody));
      }
    }

    // Remove janelas fechadas ou minimizadas
    for (const [id, entry] of this.windows) {
      if (!activeIds.has(id)) {
        entry.el.remove();
        this.windows.delete(id);
      }
    }
  }

  /**
   * @param {HTMLElement} el
   * @param {string} winId
   */
  bindEvents(el, winId) {
    el.addEventListener("mousedown", () => {
      this.wm.focus(winId);
    });

    const header = el.querySelector(".drawer-header");
    const resizeHandle = el.querySelector(".resize-handle");
    if (header && resizeHandle) {
      this.dragResize.attach(el, /** @type {HTMLElement} */ (header), /** @type {HTMLElement} */ (resizeHandle), () => winId);
    }

    el.querySelector('[data-action="close"]')?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.wm.close(winId);
    });

    el.querySelector('[data-action="minimize"]')?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.wm.minimize(winId);
    });

    el.querySelector('[data-action="maximize"]')?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.wm.toggleMaximize(winId);
    });

    el.querySelector('[data-action="toggle-float"]')?.addEventListener("click", (e) => {
      e.stopPropagation();
      const current = this.wm.getState().windows.find((w) => w.id === winId);
      if (current) {
        const next = current.presentation === "floating" ? "sidebar" : "floating";
        this.wm.setPresentation(winId, next);
      }
    });

    el.querySelector('[data-action="dock-left"]')?.addEventListener("click", (e) => {
      e.stopPropagation();
      const vp = { width: globalThis.innerWidth || 1280, height: globalThis.innerHeight || 720 };
      this.dockingManager.dock(winId, "left", vp);
    });

    el.querySelector('[data-action="dock-right"]')?.addEventListener("click", (e) => {
      e.stopPropagation();
      const vp = { width: globalThis.innerWidth || 1280, height: globalThis.innerHeight || 720 };
      this.dockingManager.dock(winId, "right", vp);
    });
  }

  /**
   * @param {HTMLElement} el
   * @param {WindowInstance} win
   * @param {boolean} isActive
   */
  updateWindowElement(el, win, isActive) {
    el.classList.add("open");
    el.classList.toggle("active-window", isActive);
    el.classList.toggle("floating", win.presentation === "floating");
    el.classList.toggle("maximized", win.presentation === "maximized");
    el.style.zIndex = String(win.zIndex);

    if (win.presentation === "floating" && win.bounds) {
      el.style.setProperty("--win-top", `${win.bounds.y}px`);
      el.style.setProperty("--win-left", `${win.bounds.x}px`);
      el.style.setProperty("--win-width", `${win.bounds.width}px`);
      el.style.setProperty("--win-height", `${win.bounds.height}px`);
    }

    const titleEl = el.querySelector('[data-ref="title"]');
    if (titleEl && win.title) titleEl.textContent = win.title;
  }
}
