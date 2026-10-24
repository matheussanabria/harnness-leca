// @ts-check
// Hash routes for the screens of the main app (EP-14 follow-up): every screen has its own address.
//   #/chats                              conversations (home)
//   #/studio                             Studio
//   #/scrum  #/layers  #/board  #/audit  #/artifacts  #/routines
//   #/prototypes[/<protoId>[/<screen>]]  Atelier, optionally on a prototype and one of its screens
// The standalone pages keep their own paths (/overview, /office, /deploy, /diario).
// The query string (?p=<project>) is untouched, so a full address looks like /?p=demo#/scrum.

/** Views rendered inside the Design workspace. */
export const VIEW_SCREENS = Object.freeze(["scrum", "layers", "board", "audit", "prototypes", "artifacts", "routines"]);
export const APP_SCREENS = Object.freeze(["chats", "studio", ...VIEW_SCREENS]);

const SEGMENT = /^[\w.-]{1,120}$/;
const MAX_PARAMS = { prototypes: 2 };

/** @typedef {{ screen: string, params: string[] }} Route */

/** @param {string} hash  "#/prototypes/dis-fluxo/home" (or without "#") */
export function parseRoute(hash) {
  const text = String(hash || "").replace(/^#/, "").replace(/^\/+/, "").replace(/\/+$/, "");
  if (!text) return { screen: "chats", params: [] };
  const parts = text.split("/").map((part) => {
    try { return decodeURIComponent(part); } catch { return ""; }
  });
  const [screen, ...rest] = parts;
  if (!APP_SCREENS.includes(screen)) return { screen: "chats", params: [] };
  const limit = MAX_PARAMS[screen] || 0;
  const params = rest.slice(0, limit);
  if (params.some((param) => !SEGMENT.test(param))) return { screen, params: [] };
  return { screen, params };
}

/** @param {string} screen @param {string[]} [params] */
export function buildRoute(screen, params = []) {
  if (!APP_SCREENS.includes(screen)) return "#/chats";
  const limit = MAX_PARAMS[screen] || 0;
  const safe = params.slice(0, limit).filter((param) => SEGMENT.test(param));
  return `#/${[screen, ...safe].map(encodeURIComponent).join("/")}`;
}

/** Old links: ?view=scrum, ?module=design, ?module=studio. Returns null when there is nothing to map. */
export function legacyRoute(search) {
  const query = new URLSearchParams(String(search || ""));
  const view = query.get("view");
  if (view && VIEW_SCREENS.includes(view)) return { screen: view, params: [] };
  const module = query.get("module");
  if (module === "studio") return { screen: "studio", params: [] };
  if (module === "design") return { screen: "scrum", params: [] };
  return null;
}

/**
 * The route a page was opened with: a hash route wins, then an old query link; null means "use the saved state".
 * @param {{ hash?: string, search?: string }} location
 * @returns {Route | null}
 */
export function routeFromLocation(location) {
  if (String(location.hash || "").startsWith("#/")) return parseRoute(location.hash || "");
  return legacyRoute(location.search || "");
}

/** @param {Route} a @param {Route} b */
export function sameRoute(a, b) {
  return a.screen === b.screen && a.params.join("/") === b.params.join("/");
}

/**
 * @param {{ location: Location, history: History, addEventListener: Function }} env  usually `window`
 */
export function createRouter(env) {
  /** @type {Array<(route: Route) => void>} */
  const listeners = [];

  const current = () => parseRoute(env.location.hash);

  /**
   * Moves the address bar to a screen. Returns false (and does nothing) when it is already there, so the
   * hooks that report every screen change can run on boot and on Back/Forward without loops.
   * @param {string} screen @param {string[]} [params] @param {{ push?: boolean }} [options]
   */
  function navigate(screen, params = [], options = {}) {
    const next = buildRoute(screen, params);
    if (next === env.location.hash || (next === "#/chats" && !env.location.hash)) return false;
    const url = `${env.location.pathname}${env.location.search}${next}`;
    try {
      if (options.push) env.history.pushState({}, "", url);
      else env.history.replaceState({}, "", url);
    } catch { return false; }
    return true;
  }

  /** @param {(route: Route) => void} listener */
  function onChange(listener) {
    listeners.push(listener);
    return () => { const i = listeners.indexOf(listener); if (i >= 0) listeners.splice(i, 1); };
  }

  // pushState/replaceState do not fire events: only Back/Forward and a hand-edited hash get here.
  env.addEventListener("hashchange", () => {
    const route = current();
    listeners.forEach((listener) => listener(route));
  });

  return { current, navigate, onChange };
}

/** Lazy singleton for the browser window; tests build their own with createRouter. */
let appRouter = null;
export function getRouter() {
  if (!appRouter && typeof window !== "undefined") appRouter = createRouter(window);
  return appRouter;
}

/** Reports a screen change to the address bar; safe to call anywhere (no-op without a window). */
export function routeTo(screen, params = [], options = {}) {
  return getRouter()?.navigate(screen, params, options) || false;
}
