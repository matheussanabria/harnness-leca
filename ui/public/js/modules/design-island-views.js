// @ts-check
// Design views rendered by React islands (ADR-011, EP-19): the island mounts inside #designViewContainer, so the Design
// header and its tabs stay visible instead of a full-screen overlay.
import { getIslandLoader } from "../shared/island-loader.js";
import { renderCanvasWorkspace } from "./design-canvas-workspace.js";

export const ISLAND_DESIGN_VIEWS = Object.freeze(["canvas-mindmap", "canvas-board"]);

/** @param {string} view */
export function isIslandView(view) {
  return ISLAND_DESIGN_VIEWS.includes(view);
}

/** Releases the React root before any other view rewrites the container. */
export function unmountIslandView() {
  getIslandLoader()?.unmount();
}

/** @param {HTMLElement} container @param {string} view @param {string} slug */
export async function mountIslandView(container, view, slug) {
  return renderCanvasWorkspace(container, view, slug);
}
