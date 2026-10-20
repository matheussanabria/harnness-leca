// @ts-check
/**
 * Controlador de Arraste e Redimensionamento de Janelas Flutuantes
 * Responsabilidade Única: Calcular novos limites confinados em viewport para operações de mover e redimensionar.
 */

/**
 * @typedef {Object} ViewportDimensions
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} BoundsLimits
 * @property {number} minWidth
 * @property {number} minHeight
 * @property {number} [maxWidth]
 * @property {number} [maxHeight]
 */

export const DEFAULT_LIMITS = {
  minWidth: 320,
  minHeight: 240,
  minTop: 40 // Espaço para topbar
};

/**
 * Confina posição e dimensões da janela dentro dos limites do viewport
 * @param {import("../types/window-manager").WindowBounds} bounds
 * @param {ViewportDimensions} viewport
 * @param {BoundsLimits} [limits]
 * @returns {import("../types/window-manager").WindowBounds}
 */
export function constrainBounds(bounds, viewport, limits = DEFAULT_LIMITS) {
  const minW = limits.minWidth ?? DEFAULT_LIMITS.minWidth;
  const minH = limits.minHeight ?? DEFAULT_LIMITS.minHeight;
  const maxW = limits.maxWidth ?? Math.max(minW, viewport.width - 20);
  const maxH = limits.maxHeight ?? Math.max(minH, viewport.height - 60);

  const width = Math.max(minW, Math.min(maxW, bounds.width));
  const height = Math.max(minH, Math.min(maxH, bounds.height));

  const minX = 0;
  const maxX = Math.max(0, viewport.width - width);
  const minY = DEFAULT_LIMITS.minTop;
  const maxY = Math.max(minY, viewport.height - height - 40);

  const x = Math.max(minX, Math.min(maxX, bounds.x));
  const y = Math.max(minY, Math.min(maxY, bounds.y));

  return { x, y, width, height };
}

/**
 * Calcula nova posição após delta de arraste
 * @param {import("../types/window-manager").WindowBounds} initialBounds
 * @param {number} deltaX
 * @param {number} deltaY
 * @param {ViewportDimensions} viewport
 * @returns {import("../types/window-manager").WindowBounds}
 */
export function computeMoveBounds(initialBounds, deltaX, deltaY, viewport) {
  const target = {
    x: initialBounds.x + deltaX,
    y: initialBounds.y + deltaY,
    width: initialBounds.width,
    height: initialBounds.height
  };
  return constrainBounds(target, viewport);
}

/**
 * Calcula novas dimensões após delta de redimensionamento
 * @param {import("../types/window-manager").WindowBounds} initialBounds
 * @param {number} deltaW
 * @param {number} deltaH
 * @param {ViewportDimensions} viewport
 * @param {BoundsLimits} [limits]
 * @returns {import("../types/window-manager").WindowBounds}
 */
export function computeResizeBounds(initialBounds, deltaW, deltaH, viewport, limits = DEFAULT_LIMITS) {
  const target = {
    x: initialBounds.x,
    y: initialBounds.y,
    width: initialBounds.width + deltaW,
    height: initialBounds.height + deltaH
  };
  return constrainBounds(target, viewport, limits);
}

export class WindowDragResizeController {
  /**
   * @param {Object} options
   * @param {import("./window-manager.js").WindowManager} options.windowManager
   */
  constructor({ windowManager }) {
    this.wm = windowManager;
    this.activeDrag = null;
    this.activeResize = null;
  }

  /**
   * Inicializa ouvintes de arraste e redimensionamento em um elemento de janela
   * @param {HTMLElement} windowEl Elemento da janela flutuante
   * @param {HTMLElement} dragHandle Elemento cabeçalho para arraste
   * @param {HTMLElement} [resizeHandle] Alça no canto inferior direito
   * @param {() => string | null} getWindowId Função que retorna o windowId atual
   */
  attach(windowEl, dragHandle, resizeHandle, getWindowId) {
    if (!windowEl || !dragHandle) return;

    // Duplo clique no cabeçalho para alternar maximização
    dragHandle.addEventListener("dblclick", (e) => {
      // Ignora clique em botões dentro do header
      if (typeof e?.target?.closest === "function" && e.target.closest("button, a")) return;
      const winId = getWindowId();
      if (winId) this.wm.toggleMaximize(winId);
    });

    // Início de Arraste (PointerDown)
    dragHandle.addEventListener("pointerdown", (e) => {
      if (typeof e?.target?.closest === "function" && e.target.closest("button, a")) return;
      const winId = getWindowId();
      if (!winId) return;

      const state = this.wm.getState();
      const win = state.windows.find(w => w.id === winId);
      if (!win || win.presentation !== "floating") return;

      this.wm.focus(winId);
      dragHandle.setPointerCapture?.(e.pointerId);

      this.activeDrag = {
        winId,
        startX: e.clientX,
        startY: e.clientY,
        startBounds: { ...win.bounds }
      };
    });

    // Movimento de Arraste (PointerMove)
    dragHandle.addEventListener("pointermove", (e) => {
      if (!this.activeDrag) return;
      const { winId, startX, startY, startBounds } = this.activeDrag;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const nextBounds = computeMoveBounds(startBounds, deltaX, deltaY, viewport);
      this.wm.setBounds(winId, nextBounds);
    });

    const endDrag = (e) => {
      if (!this.activeDrag) return;
      try { dragHandle.releasePointerCapture?.(e.pointerId); } catch (_) {}
      this.activeDrag = null;
    };
    dragHandle.addEventListener("pointerup", endDrag);
    dragHandle.addEventListener("pointercancel", endDrag);

    // Início de Redimensionamento
    if (resizeHandle) {
      resizeHandle.addEventListener("pointerdown", (e) => {
        const winId = getWindowId();
        if (!winId) return;

        const state = this.wm.getState();
        const win = state.windows.find(w => w.id === winId);
        if (!win || win.presentation !== "floating") return;

        this.wm.focus(winId);
        resizeHandle.setPointerCapture?.(e.pointerId);

        this.activeResize = {
          winId,
          startX: e.clientX,
          startY: e.clientY,
          startBounds: { ...win.bounds }
        };
        e.stopPropagation();
      });

      resizeHandle.addEventListener("pointermove", (e) => {
        if (!this.activeResize) return;
        const { winId, startX, startY, startBounds } = this.activeResize;
        const deltaW = e.clientX - startX;
        const deltaH = e.clientY - startY;

        const viewport = { width: window.innerWidth, height: window.innerHeight };
        const nextBounds = computeResizeBounds(startBounds, deltaW, deltaH, viewport);
        this.wm.setBounds(winId, nextBounds);
      });

      const endResize = (e) => {
        if (!this.activeResize) return;
        try { resizeHandle.releasePointerCapture?.(e.pointerId); } catch (_) {}
        this.activeResize = null;
      };
      resizeHandle.addEventListener("pointerup", endResize);
      resizeHandle.addEventListener("pointercancel", endResize);
    }
  }
}
