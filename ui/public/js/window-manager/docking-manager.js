// @ts-check
/**
 * Gerenciador de Docking, Abas e Divisão de Tela
 * Responsabilidade Única: Calcular geometria de ancoragem, detectar zonas de snap e gerenciar agrupamento de abas.
 */

/**
 * @typedef {"left" | "right" | "top" | "bottom" | "maximize" | "none"} DockZone
 */

/**
 * @typedef {Object} ViewportDimensions
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} DockOptions
 * @property {number} [topOffset]
 * @property {number} [bottomOffset]
 * @property {number} [splitRatio]
 */

export const DOCK_DEFAULTS = {
  topOffset: 56,    // Altura da topbar
  bottomOffset: 44, // Altura da taskbar
  splitRatio: 0.5,  // Divisão 50/50
  edgeThreshold: 24 // Distância em px para snap de borda
};

/**
 * Calcula dimensões e posição da janela para uma zona de ancoragem
 * @param {DockZone} zone
 * @param {ViewportDimensions} viewport
 * @param {DockOptions} [options]
 * @returns {import("../types/window-manager").WindowBounds}
 */
export function computeDockBounds(zone, viewport, options = {}) {
  const top = options.topOffset ?? DOCK_DEFAULTS.topOffset;
  const bottom = options.bottomOffset ?? DOCK_DEFAULTS.bottomOffset;
  const ratio = options.splitRatio ?? DOCK_DEFAULTS.splitRatio;

  const usableHeight = Math.max(120, viewport.height - top - bottom);
  const usableWidth = Math.max(200, viewport.width);

  switch (zone) {
    case "left":
      return {
        x: 0,
        y: top,
        width: Math.round(usableWidth * ratio),
        height: usableHeight
      };

    case "right": {
      const w = Math.round(usableWidth * (1 - ratio));
      return {
        x: usableWidth - w,
        y: top,
        width: w,
        height: usableHeight
      };
    }

    case "top":
      return {
        x: 0,
        y: top,
        width: usableWidth,
        height: Math.round(usableHeight * ratio)
      };

    case "bottom": {
      const h = Math.round(usableHeight * (1 - ratio));
      return {
        x: 0,
        y: top + usableHeight - h,
        width: usableWidth,
        height: h
      };
    }

    case "maximize":
      return {
        x: 0,
        y: top,
        width: usableWidth,
        height: usableHeight
      };

    case "none":
    default:
      return {
        x: Math.round(usableWidth * 0.1),
        y: top + 20,
        width: Math.round(usableWidth * 0.8),
        height: Math.round(usableHeight * 0.8)
      };
  }
}

/**
 * Detecta intenção de snap com base na proximidade do ponteiro com as bordas
 * @param {{ clientX: number, clientY: number }} pointer
 * @param {ViewportDimensions} viewport
 * @param {number} [threshold]
 * @returns {DockZone}
 */
export function detectDockZone(pointer, viewport, threshold = DOCK_DEFAULTS.edgeThreshold) {
  if (!pointer || !viewport) return "none";

  if (pointer.clientX <= threshold) return "left";
  if (pointer.clientX >= viewport.width - threshold) return "right";
  if (pointer.clientY <= threshold) return "maximize";
  if (pointer.clientY >= viewport.height - threshold) return "bottom";

  return "none";
}

/**
 * Gerenciador Lógico de Grupos de Abas (Tab Groups)
 */
export class TabGroupManager {
  constructor() {
    /** @type {Map<string, { id: string, tabs: string[], activeTab: string }>} */
    this.groups = new Map();
  }

  /**
   * Cria um novo grupo de abas
   * @param {string} groupId
   * @param {string[]} initialTabs
   * @param {string} [activeTab]
   */
  createGroup(groupId, initialTabs = [], activeTab = "") {
    const active = activeTab || initialTabs[0] || "";
    const group = {
      id: groupId,
      tabs: [...new Set(initialTabs)],
      activeTab: active
    };
    this.groups.set(groupId, group);
    return group;
  }

  /**
   * Adiciona uma janela a um grupo existente
   * @param {string} groupId
   * @param {string} windowId
   */
  addTab(groupId, windowId) {
    const group = this.groups.get(groupId);
    if (!group) return null;
    if (!group.tabs.includes(windowId)) {
      group.tabs.push(windowId);
    }
    if (!group.activeTab) {
      group.activeTab = windowId;
    }
    return group;
  }

  /**
   * Remove uma janela de um grupo
   * @param {string} groupId
   * @param {string} windowId
   */
  removeTab(groupId, windowId) {
    const group = this.groups.get(groupId);
    if (!group) return null;

    group.tabs = group.tabs.filter((id) => id !== windowId);
    if (group.activeTab === windowId) {
      group.activeTab = group.tabs[0] || "";
    }

    if (group.tabs.length === 0) {
      this.groups.delete(groupId);
      return null;
    }
    return group;
  }

  /**
   * Define qual aba está ativa no grupo
   * @param {string} groupId
   * @param {string} windowId
   */
  setActiveTab(groupId, windowId) {
    const group = this.groups.get(groupId);
    if (!group || !group.tabs.includes(windowId)) return false;
    group.activeTab = windowId;
    return true;
  }

  /**
   * Obtém informações do grupo
   * @param {string} groupId
   */
  getGroup(groupId) {
    return this.groups.get(groupId) || null;
  }

  /**
   * Localiza o grupo ao qual pertence uma janela
   * @param {string} windowId
   */
  findGroupByWindowId(windowId) {
    for (const group of this.groups.values()) {
      if (group.tabs.includes(windowId)) return group;
    }
    return null;
  }

  /**
   * Destroi um grupo de abas
   * @param {string} groupId
   */
  destroyGroup(groupId) {
    return this.groups.delete(groupId);
  }
}

/**
 * Orquestrador de Docking e Snap para o WindowManager
 */
export class DockingManager {
  /**
   * @param {import("./window-store").WindowStore} windowStore
   */
  constructor(windowStore) {
    this.store = windowStore;
    this.tabGroups = new TabGroupManager();
    /** @type {Map<string, { bounds: import("../types/window-manager").WindowBounds, zone: DockZone }>} */
    this.dockStates = new Map();
  }

  /**
   * Acopla uma janela em uma zona específica
   * @param {string} windowId
   * @param {DockZone} zone
   * @param {ViewportDimensions} viewport
   * @param {DockOptions} [options]
   */
  dock(windowId, zone, viewport, options = {}) {
    const win = this.store.get(windowId);
    if (!win) return false;

    // Preserva bounds originais antes do primeiro dock
    if (!this.dockStates.has(windowId)) {
      this.dockStates.set(windowId, {
        bounds: { ...win.bounds },
        zone
      });
    } else {
      const state = this.dockStates.get(windowId);
      if (state) state.zone = zone;
    }

    const nextBounds = computeDockBounds(zone, viewport, options);
    this.store.setBounds(windowId, nextBounds);
    return true;
  }

  /**
   * Desacopla uma janela, restaurando seus limites flutuantes
   * @param {string} windowId
   */
  undock(windowId) {
    const state = this.dockStates.get(windowId);
    if (!state) return false;

    this.store.setBounds(windowId, state.bounds);
    this.dockStates.delete(windowId);
    return true;
  }

  /**
   * Verifica se a janela está dockada
   * @param {string} windowId
   * @returns {DockZone | null}
   */
  getDockZone(windowId) {
    return this.dockStates.get(windowId)?.zone || null;
  }
}
