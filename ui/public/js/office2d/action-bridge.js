// @ts-check
/**
 * Contexto de ações do motor 2.5D (EP-03.08).
 * Traduz ações canônicas para callbacks próprios do cenário isométrico.
 */

/**
 * @typedef {Object} Office2DActionOptions
 * @property {any} [officeState]
 * @property {any} [windowManager]
 * @property {(seatId: string) => void} [onSeat]
 * @property {(targetScreen: string, preset: string) => void} [onScreenFocus]
 */

/**
 * @param {Office2DActionOptions} [options]
 * @returns {Record<string, any>}
 */
export function createOffice2DActionContext(options = {}) {
  const { officeState, windowManager, onSeat, onScreenFocus } = options;

  return {
    officeState,
    windowManager,
    sitAtWorkstation: () => onSeat?.("workstation_chair"),
    sitAtWarRoom: () => onSeat?.("war_room_user_chair"),
    toggleScreenFocus: (targetScreen = "big_screen", preset = "kanban") => {
      onScreenFocus?.(targetScreen, preset);
    }
  };
}
