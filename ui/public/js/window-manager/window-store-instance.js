// @ts-check
/**
 * Window Store instance factory.
 * Single responsibility: build a window instance from a module descriptor and options.
 */

/** @typedef {import("../types/window-manager").WindowInstance} WindowInstance */
/** @typedef {import("../types/window-manager").WindowOpenOptions} WindowOpenOptions */

/**
 * @param {{
 *   moduleId: string,
 *   options: WindowOpenOptions,
 *   descriptor: import("../types/window-manager").ModuleDescriptor | undefined,
 *   isSingleton: boolean,
 *   sequence: number,
 *   zIndex: number
 * }} params
 * @returns {WindowInstance}
 */
export function buildWindowInstance({ moduleId, options, descriptor, isSingleton, sequence, zIndex }) {
  const id = isSingleton ? `win-${moduleId}` : `win-${moduleId}-${sequence}`;
  const bounds = {
    x: options.bounds?.x ?? descriptor?.defaultBounds?.x ?? 80,
    y: options.bounds?.y ?? descriptor?.defaultBounds?.y ?? 80,
    width: options.bounds?.width ?? descriptor?.defaultBounds?.width ?? 640,
    height: options.bounds?.height ?? descriptor?.defaultBounds?.height ?? 480
  };

  return {
    id,
    moduleId,
    projectId: options.projectId,
    resourceId: options.resourceId,
    title: options.title || descriptor?.title || moduleId,
    icon: options.icon || descriptor?.icon || "fa-solid fa-window-maximize",
    presentation: options.presentation || descriptor?.defaultPresentation || "floating",
    visibility: "visible",
    bounds,
    zIndex,
    isFocused: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}
