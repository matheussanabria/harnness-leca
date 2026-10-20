// @ts-check
/**
 * Gerenciador de Ciclo de Vida e Recursos de Janelas
 * Responsabilidade Única: Executar hooks de limpeza, descarte e preservação de estado em minimizar/fechar.
 */

export class WindowLifecycleManager {
  constructor() {
    /** @type {Map<string, Set<() => void>>} */
    this.cleanups = new Map();
    /** @type {Map<string, Record<string, any>>} */
    this.savedStates = new Map();
  }

  /**
   * Registra um callback de limpeza executado ao fechar a janela
   * @param {string} windowId
   * @param {() => void} cleanupFn
   * @returns {() => void} Função para desregistrar o callback prematuramente
   */
  onClose(windowId, cleanupFn) {
    if (!windowId || typeof cleanupFn !== "function") {
      return () => {};
    }

    if (!this.cleanups.has(windowId)) {
      this.cleanups.set(windowId, new Set());
    }

    const set = this.cleanups.get(windowId);
    set?.add(cleanupFn);

    return () => {
      set?.delete(cleanupFn);
    };
  }

  /**
   * Executa e descarta todos os callbacks de limpeza associados a uma janela
   * @param {string} windowId
   */
  triggerClose(windowId) {
    const set = this.cleanups.get(windowId);
    if (set) {
      set.forEach(fn => {
        try {
          fn();
        } catch (err) {
          console.error(`Erro ao executar cleanup da janela ${windowId}:`, err);
        }
      });
      this.cleanups.delete(windowId);
    }
    this.savedStates.delete(windowId);
  }

  /**
   * Salva estado transiente da janela (como scroll e valores de input) antes de minimizar
   * @param {string} windowId
   * @param {Record<string, any>} state
   */
  saveState(windowId, state) {
    if (!windowId) return;
    const current = this.savedStates.get(windowId) || {};
    this.savedStates.set(windowId, { ...current, ...state });
  }

  /**
   * Recupera o estado salvo de uma janela minimizada
   * @param {string} windowId
   * @returns {Record<string, any> | null}
   */
  getState(windowId) {
    return this.savedStates.get(windowId) || null;
  }

  /**
   * Reseta todos os registros e cleanups (limpeza total)
   */
  reset() {
    this.cleanups.forEach((set, windowId) => {
      this.triggerClose(windowId);
    });
    this.cleanups.clear();
    this.savedStates.clear();
  }
}

export const windowLifecycle = new WindowLifecycleManager();
