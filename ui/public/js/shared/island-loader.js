// @ts-check
// Mounts React islands (ADR-011) inside the legacy shell. Islands are built by Vite into /dist; `islands.js` maps
// each island name to its hashed entry and CSS. Without a build the shell keeps working and shows a notice.
// Contract: the island module exports `mount(el, { slug, params, embedded }) => { unmount() }`.
// When mounted with a target element, the island renders into that target instead of the global host.

import { ISLAND_SCREENS } from "./router.js";

/** @typedef {{ file: string, css: string[] }} IslandEntry */
/** @typedef {{ unmount: () => void }} IslandHandle */
/** @typedef {{ name: string, handle: IslandHandle, target: HTMLElement | null }} ActiveIsland */

export { ISLAND_SCREENS };
const HOST_ID = "islandHost";
const BASE = "/dist/";

/**
 * @param {{ importer?: (url: string) => Promise<any>, doc?: Document, now?: () => number }} [deps]
 */
export function createIslandLoader(deps = {}) {
  const importer = deps.importer || ((url) => import(/* @vite-ignore */ url));
  const doc = deps.doc || document;
  const now = deps.now || Date.now;
  /** @type {ActiveIsland | null} */
  let active = null;
  // Bumped by every unmount: a mount whose imports resolve after the route changed sees a newer value and gives up,
  // so a slow import never renders into a hidden host.
  let generation = 0;

  function host() {
    let el = doc.getElementById(HOST_ID);
    if (!el) {
      el = doc.createElement("div");
      el.id = HOST_ID;
      el.className = "island-host";
      doc.body.appendChild(el);
    }
    return el;
  }

  /** @param {string[]} css */
  function ensureCss(css) {
    for (const href of css) {
      const url = BASE + href;
      if (doc.querySelector(`link[data-island-css="${url}"]`)) continue;
      const link = doc.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      link.dataset.islandCss = url;
      doc.head.appendChild(link);
    }
  }

  /** @param {HTMLElement} el @param {string} message */
  function notice(el, message) {
    el.replaceChildren();
    const box = doc.createElement("p");
    box.className = "island-host__notice";
    box.setAttribute("role", "status");
    const icon = doc.createElement("i");
    icon.className = "fa-solid fa-triangle-exclamation";
    icon.setAttribute("aria-hidden", "true");
    box.append(icon, ` ${message}`);
    el.appendChild(box);
  }

  function unmount() {
    generation += 1;
    if (active) {
      try { active.handle.unmount(); } catch { /* a broken island must not block navigation */ }
      // If mounted into a target, clear it; otherwise hide the global host
      if (active.target) {
        active.target.replaceChildren();
      } else {
        const el = doc.getElementById(HOST_ID);
        if (el) { el.replaceChildren(); el.hidden = true; }
      }
      active = null;
    } else {
      // No active island but still ensure the host is cleared/hidden (legacy cleanup)
      const el = doc.getElementById(HOST_ID);
      if (el) { el.replaceChildren(); el.hidden = true; }
    }
  }

  /**
   * Mounts an island. When target is provided, renders into that element instead of the global host.
   * @param {string} name Island name
   * @param {{ slug: string, params: string[] }} props Props passed to the island
   * @param {HTMLElement} [target] Optional target element for embedded rendering
   * @returns {Promise<boolean>} true when the island mounted
   */
  async function mount(name, props, target) {
    unmount();
    const ticket = generation;
    const stale = () => ticket !== generation;
    const isEmbedded = Boolean(target);
    // Use provided target or fall back to the global host
    const el = target || host();
    if (!isEmbedded) el.hidden = false;
    if (!isEmbedded && !ISLAND_SCREENS.includes(name)) { notice(el, `Unknown island: ${name}`); return false; }
    /** @type {Record<string, IslandEntry>} */
    let index;
    try {
      // The index is tiny and changes on every build, so it skips the cache; hashed entries can be cached.
      index = (await importer(`${BASE}islands.js?t=${now()}`)).default;
    } catch {
      if (!stale()) notice(el, "React islands are not built yet. Run npm run build:web and reload.");
      return false;
    }
    if (stale()) return false;
    const entry = index?.[name];
    if (!entry) { notice(el, `Island "${name}" is missing from the build. Run npm run build:web.`); return false; }
    ensureCss(entry.css || []);
    try {
      const mod = await importer(BASE + entry.file);
      if (stale()) return false;
      const islandProps = isEmbedded ? { ...props, embedded: true } : props;
      active = { name, handle: mod.mount(el, islandProps), target: target || null };
      return true;
    } catch (error) {
      if (!stale()) notice(el, `Island "${name}" failed to load: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  return { mount, unmount, activeName: () => active?.name || null };
}

let loader = null;
/** Lazy singleton for the browser; tests build their own with createIslandLoader. */
export function getIslandLoader() {
  if (!loader && typeof document !== "undefined") loader = createIslandLoader();
  return loader;
}
