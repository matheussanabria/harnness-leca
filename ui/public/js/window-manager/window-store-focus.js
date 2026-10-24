// @ts-check
/**
 * Window Store focus selection.
 * Single responsibility: pick the visible window with the highest zIndex.
 */

/**
 * @param {Map<string, import("../types/window-manager").WindowInstance>} windows
 * @returns {string | null}
 */
export function pickTopVisibleWindowId(windows) {
  let topId = null;
  let maxZ = -1;

  windows.forEach((win) => {
    if (win.visibility === "visible" && win.zIndex > maxZ) {
      maxZ = win.zIndex;
      topId = win.id;
    }
  });

  return topId;
}
