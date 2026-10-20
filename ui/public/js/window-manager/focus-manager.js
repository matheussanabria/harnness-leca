// @ts-check
/**
 * Focus Manager do Window Manager
 * Gerencia foco de entrada, bloqueio de teclado/câmera e sincronização de camadas zIndex.
 */

/**
 * Verifica se um elemento do DOM está em modo de edição ou dentro de uma superfície de janela.
 * @param {HTMLElement|null} [element]
 * @returns {boolean}
 */
export function isElementEditing(element) {
  if (!element) return false;
  const tag = element.tagName ? element.tagName.toLowerCase() : "";
  if (tag === "input" || tag === "textarea" || tag === "select" || tag === "option") {
    return true;
  }
  if (element.isContentEditable) {
    return true;
  }
  return false;
}

/**
 * Verifica se o alvo pertence a uma janela ou container de UI flutuante.
 * @param {HTMLElement|null} [element]
 * @returns {boolean}
 */
export function isElementInsideWindow(element) {
  if (!element || typeof element.closest !== "function") return false;
  return !!(
    element.closest(".window-frame") ||
    element.closest(".floating-window") ||
    element.closest(".office-drawer.open") ||
    element.closest("[data-window-id]") ||
    element.closest(".dai-topbar") ||
    element.closest(".dai-bottom-bar") ||
    element.closest(".dai-sidebar-right") ||
    element.closest(".dai-floating-left") ||
    element.closest(".monitor-3d-screen")
  );
}

/**
 * Determina se a navegação 3D / 2.5D (WASD, setas, atalhos de interação) deve ser bloqueada.
 * @param {Object} [options]
 * @param {HTMLElement|null} [options.activeElement]
 * @param {boolean} [options.hasActiveWindow]
 * @returns {boolean}
 */
export function isNavigationBlocked(options = {}) {
  const activeEl = options.activeElement ?? (typeof document !== "undefined" ? /** @type {HTMLElement} */ (document.activeElement) : null);
  if (isElementEditing(activeEl)) return true;
  if (isElementInsideWindow(activeEl)) return true;
  if (options.hasActiveWindow) return true;
  return false;
}

/**
 * Processador central de teclado para foco e atalhos de janela (como Escape).
 * @param {KeyboardEvent|{ code: string, key?: string }} event
 * @param {Object} [ctx]
 * @param {import("./window-manager.js").WindowManager} [ctx.windowManager]
 * @param {() => boolean} [ctx.isPointerLocked]
 * @param {() => void} [ctx.exitPointerLock]
 * @param {() => void} [ctx.standUp]
 * @param {boolean} [ctx.isSeated]
 * @returns {{ handled: boolean, action?: string }}
 */
export function handleNavigationKey(event, ctx = {}) {
  const code = event.code;
  const key = (event.key || "").toLowerCase();

  if (code === "Escape" || key === "escape") {
    // 1. Se houver janela ativa aberta no WindowManager, fecha ou desfoca
    if (ctx.windowManager) {
      const activeWindow = ctx.windowManager.getFocusedWindow();
      if (activeWindow && !activeWindow.isMinimized) {
        ctx.windowManager.close(activeWindow.id);
        return { handled: true, action: "close_window" };
      }
    }

    // 2. Se o ponteiro estiver travado (PointerLock), solta
    if (ctx.isPointerLocked && ctx.isPointerLocked()) {
      if (ctx.exitPointerLock) ctx.exitPointerLock();
      return { handled: true, action: "exit_pointer_lock" };
    }

    // 3. Se o avatar estiver sentado, levanta
    if (ctx.isSeated && ctx.standUp) {
      ctx.standUp();
      return { handled: true, action: "stand_up" };
    }
  }

  return { handled: false };
}

export class FocusManager {
  /**
   * @param {Object} [options]
   * @param {import("./window-manager.js").WindowManager} [options.windowManager]
   */
  constructor(options = {}) {
    this.wm = options.windowManager || null;
    this._blockedManual = false;
  }

  /**
   * Força bloqueio manual de navegação
   * @param {boolean} blocked
   */
  setManualBlock(blocked) {
    this._blockedManual = !!blocked;
  }

  /**
   * Verifica se a navegação do escritório está atualmente bloqueada
   * @returns {boolean}
   */
  isBlocked() {
    if (this._blockedManual) return true;
    const focused = this.wm ? this.wm.getFocusedWindow() : null;
    const hasActive = !!(focused && !focused.isMinimized);
    return isNavigationBlocked({ hasActiveWindow: hasActive });
  }

  /**
   * Manipula evento de pointer down para elevar a janela clicada ao topo
   * @param {HTMLElement|null} target
   */
  handlePointerDown(target) {
    if (!target || !this.wm || typeof target.closest !== "function") return;
    const winEl = target.closest("[data-window-id]");
    if (winEl) {
      const winId = winEl.getAttribute("data-window-id");
      if (winId) {
        this.wm.focus(winId);
      }
    }
  }
}

export const focusManager = new FocusManager();
