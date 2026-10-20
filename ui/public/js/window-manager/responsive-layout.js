// @ts-check
/**
 * Gerenciador de Layouts Responsivos e Breakpoints do Window Manager
 * Responsabilidade Única: Detectar breakpoints de tela, resolver apresentações adaptativas e calcular limites de janela para mobile/tablet/desktop.
 */

import { constrainBounds } from "./drag-resize.js";

/**
 * @typedef {"mobile" | "tablet" | "desktop"} Breakpoint
 */

export const BREAKPOINT_THRESHOLDS = {
  mobileMax: 767,
  tabletMax: 1023
};

export const RESPONSIVE_DEFAULTS = {
  topOffset: 56,
  bottomOffset: 44,
  debounceMs: 100
};

/**
 * Identifica o breakpoint com base na largura atual do viewport
 * @param {number} width
 * @returns {Breakpoint}
 */
export function getBreakpoint(width) {
  if (width <= BREAKPOINT_THRESHOLDS.mobileMax) return "mobile";
  if (width <= BREAKPOINT_THRESHOLDS.tabletMax) return "tablet";
  return "desktop";
}

/**
 * Resolve o modo de apresentação considerando o breakpoint ativo
 * @param {import("../types/window-manager").WindowPresentation} preferredPresentation
 * @param {Breakpoint} breakpoint
 * @returns {import("../types/window-manager").WindowPresentation}
 */
export function resolvePresentationForBreakpoint(preferredPresentation, breakpoint) {
  if (breakpoint === "mobile") {
    return "fullscreen";
  }
  return preferredPresentation;
}

/**
 * Calcula dimensões adaptativas para uma janela considerando o breakpoint atual
 * @param {import("../types/window-manager").WindowBounds} bounds
 * @param {Breakpoint} breakpoint
 * @param {{ width: number, height: number }} viewport
 * @param {{ topOffset?: number, bottomOffset?: number }} [options]
 * @returns {import("../types/window-manager").WindowBounds}
 */
export function computeResponsiveBounds(bounds, breakpoint, viewport, options = {}) {
  const top = options.topOffset ?? RESPONSIVE_DEFAULTS.topOffset;
  const bottom = options.bottomOffset ?? RESPONSIVE_DEFAULTS.bottomOffset;
  const usableHeight = Math.max(160, viewport.height - top - bottom);

  if (breakpoint === "mobile") {
    return {
      x: 0,
      y: top,
      width: viewport.width,
      height: usableHeight
    };
  }

  if (breakpoint === "tablet") {
    const width = Math.min(bounds.width || 600, viewport.width - 24);
    const height = Math.min(bounds.height || 450, usableHeight);
    const x = Math.max(12, Math.round((viewport.width - width) / 2));
    const y = Math.max(top, Math.min(viewport.height - height - bottom, bounds.y || top));
    return { x, y, width, height };
  }

  // Desktop
  return constrainBounds(bounds, viewport);
}

/**
 * Controlador Reativo de Viewport e Adaptação de Janelas
 */
export class ResponsiveLayoutManager {
  /**
   * @param {import("./window-store").WindowStore} store
   * @param {Window | { innerWidth: number, innerHeight: number, addEventListener: Function, removeEventListener: Function }} [win]
   */
  constructor(store, win = typeof window !== "undefined" ? window : undefined) {
    this.store = store;
    this.win = win;
    /** @type {Map<string, import("../types/window-manager").WindowBounds>} */
    this.desktopBoundsCache = new Map();
    /** @type {Breakpoint} */
    this.currentBreakpoint = this.win ? getBreakpoint(this.win.innerWidth) : "desktop";
    /** @type {any} */
    this.debounceTimer = null;
    /** @type {(() => void) | null} */
    this.resizeHandler = null;
  }

  /**
   * Retorna o breakpoint atual
   * @returns {Breakpoint}
   */
  getCurrentBreakpoint() {
    return this.currentBreakpoint;
  }

  /**
   * Sincroniza todas as janelas abertas com o viewport atual
   * @param {{ width: number, height: number }} viewport
   */
  syncWindows(viewport) {
    const nextBreakpoint = getBreakpoint(viewport.width);
    const wasMobile = this.currentBreakpoint === "mobile";
    const isMobile = nextBreakpoint === "mobile";

    this.currentBreakpoint = nextBreakpoint;
    const state = this.store.getState();

    state.windows.forEach((win) => {
      if (isMobile) {
        if (!wasMobile && !this.desktopBoundsCache.has(win.id)) {
          this.desktopBoundsCache.set(win.id, { ...win.bounds });
        }
        const mobileBounds = computeResponsiveBounds(win.bounds, "mobile", viewport);
        this.store.setBounds(win.id, mobileBounds);
      } else if (wasMobile) {
        // Restaurando do mobile para tablet/desktop
        const cached = this.desktopBoundsCache.get(win.id);
        const targetBounds = cached || win.bounds;
        const restoredBounds = computeResponsiveBounds(targetBounds, nextBreakpoint, viewport);
        this.store.setBounds(win.id, restoredBounds);
        this.desktopBoundsCache.delete(win.id);
      } else {
        // Redimensionamento dentro do tablet ou desktop
        const adaptedBounds = computeResponsiveBounds(win.bounds, nextBreakpoint, viewport);
        this.store.setBounds(win.id, adaptedBounds);
      }
    });
  }

  /**
   * Conecta o ouvinte de resize global
   */
  attach() {
    if (!this.win || this.resizeHandler) return;

    this.resizeHandler = () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        if (!this.win) return;
        this.syncWindows({ width: this.win.innerWidth, height: this.win.innerHeight });
      }, RESPONSIVE_DEFAULTS.debounceMs);
    };

    this.win.addEventListener("resize", this.resizeHandler);
  }

  /**
   * Desconecta o ouvinte de resize global
   */
  detach() {
    if (!this.win || !this.resizeHandler) return;
    this.win.removeEventListener("resize", this.resizeHandler);
    this.resizeHandler = null;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}
