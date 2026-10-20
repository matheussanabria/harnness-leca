// @ts-check
/**
 * Barra de Tarefas (Taskbar) do Window Manager
 * Responsabilidade Única: Renderizar lista de janelas ativas/minimizadas e despachar ações de foco, restauração e minimização.
 */

/**
 * @typedef {Object} TaskbarItemModel
 * @property {string} id
 * @property {string} title
 * @property {string} icon
 * @property {boolean} isFocused
 * @property {boolean} isMinimized
 * @property {boolean} isVisible
 */

/**
 * Converte uma instância de janela em modelo visual para a taskbar
 * @param {import("../types/window-manager").WindowInstance} win
 * @param {string | null} activeWindowId
 * @returns {TaskbarItemModel}
 */
export function getTaskbarItemModel(win, activeWindowId) {
  const isMinimized = win.visibility === "minimized";
  const isFocused = win.id === activeWindowId && !isMinimized;
  const isVisible = win.visibility === "visible" && !isFocused;

  return {
    id: win.id,
    title: win.title || "Janela",
    icon: win.icon || "fa-solid fa-window-maximize",
    isFocused,
    isMinimized,
    isVisible
  };
}

/**
 * Determina a ação ao clicar no item da barra de tarefas
 * @param {TaskbarItemModel} item
 * @returns {"restore" | "minimize" | "focus"}
 */
export function resolveTaskbarClickAction(item) {
  if (item.isMinimized) return "restore";
  if (item.isFocused) return "minimize";
  return "focus";
}

export class TaskbarComponent {
  /**
   * @param {Object} options
   * @param {HTMLElement | null} options.container
   * @param {import("./window-manager.js").WindowManager} options.windowManager
   */
  constructor({ container, windowManager }) {
    this.container = container;
    this.wm = windowManager;
    this.unsubscribe = null;

    if (this.container) {
      this.init();
    }
  }

  init() {
    if (!this.container) return;

    this.container.addEventListener("click", (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      if (!target) return;

      // Botão de fechar item da taskbar
      const closeBtn = target.closest(".taskbar-item-close");
      if (closeBtn) {
        e.stopPropagation();
        const winId = closeBtn.closest("[data-window-id]")?.getAttribute("data-window-id");
        if (winId) this.wm.close(winId);
        return;
      }

      // Clique no corpo do item da taskbar
      const itemEl = target.closest(".taskbar-item");
      if (itemEl) {
        const winId = itemEl.getAttribute("data-window-id");
        if (!winId) return;

        const state = this.wm.getState();
        const win = state.windows.find(w => w.id === winId);
        if (!win) return;

        const itemModel = getTaskbarItemModel(win, state.activeWindowId);
        const action = resolveTaskbarClickAction(itemModel);

        if (action === "restore") this.wm.restore(winId);
        else if (action === "minimize") this.wm.minimize(winId);
        else if (action === "focus") this.wm.focus(winId);
      }
    });

    this.unsubscribe = this.wm.subscribe((state) => {
      this.render(state);
    });

    this.render(this.wm.getState());
  }

  /**
   * Renderiza os itens da barra de tarefas
   * @param {import("../types/window-manager").WindowManagerState} state
   */
  render(state) {
    if (!this.container) return;

    const windows = state.windows || [];
    if (windows.length === 0) {
      this.container.innerHTML = "";
      this.container.classList.add("is-empty");
      return;
    }

    this.container.classList.remove("is-empty");

    const itemsHtml = windows.map(win => {
      const item = getTaskbarItemModel(win, state.activeWindowId);
      const statusClass = item.isFocused ? "is-focused" : item.isMinimized ? "is-minimized" : "is-visible";
      const titleAttr = item.isMinimized ? `${item.title} (Minimizada - clique para restaurar)` : item.isFocused ? `${item.title} (Ativa - clique para minimizar)` : `${item.title} (Clique para focar)`;

      return `
        <div class="taskbar-item ${statusClass}" data-window-id="${item.id}" title="${titleAttr}">
          <i class="${item.icon}"></i>
          <span class="taskbar-item-title">${item.title}</span>
          <button class="taskbar-item-close" type="button" title="Fechar ${item.title}" aria-label="Fechar">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      `;
    }).join("");

    this.container.innerHTML = itemsHtml;
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.container) {
      this.container.innerHTML = "";
    }
  }
}
