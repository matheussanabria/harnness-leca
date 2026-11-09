// @ts-check
// Client-side routing and history management for the Catalog page.
// Supported routes:
//   /catalogo                           -> { view: "list", kind: "skill", id: "" }
//   /catalogo/workflows                 -> { view: "list", kind: "workflow", id: "" }
//   /catalogo/skills                    -> { view: "list", kind: "skill", id: "" }
//   /catalogo/agents                    -> { view: "list", kind: "agent", id: "" }
//   /catalogo/workflows/:id             -> { view: "detail", kind: "workflow", id: ":id" }
//   /catalogo/skills/:id                -> { view: "detail", kind: "skill", id: ":id" }
//   /catalogo/agents/:id                -> { view: "detail", kind: "agent", id: ":id" }

const KIND_MAP = {
  workflows: "workflow",
  workflow: "workflow",
  skills: "skill",
  skill: "skill",
  agents: "agent",
  agent: "agent",
};

const PLURAL_MAP = {
  workflow: "workflows",
  skill: "skills",
  agent: "agents",
};

let internalHistoryDepth = 0;

/**
 * Normalizes a kind string to singular "skill", "agent" or "workflow".
 * @param {string} raw
 * @returns {"skill"|"agent"|"workflow"}
 */
export function normalizeKind(raw) {
  const clean = String(raw || "").trim().toLowerCase();
  return KIND_MAP[clean] || "skill";
}

/**
 * Plural name for URL paths.
 * @param {string} kind
 * @returns {string}
 */
export function pluralKind(kind) {
  const norm = normalizeKind(kind);
  return PLURAL_MAP[norm] || "skills";
}

/**
 * Parses pathname and search into a structured route object.
 * @param {string} pathname
 * @param {string} [search]
 * @returns {{ view: "list"|"detail", kind: "skill"|"agent"|"workflow", id: string, legacy: boolean }}
 */
export function parseRoute(pathname, search = "") {
  const cleanPath = String(pathname || "").replace(/\/+$/, "") || "/";
  const params = new URLSearchParams(search);

  // Check legacy query params: ?kind=...&name=...
  const queryKind = params.get("kind");
  const queryName = params.get("name");
  if (queryKind && queryName) {
    return {
      view: "detail",
      kind: normalizeKind(queryKind),
      id: queryName.trim(),
      legacy: true,
    };
  }

  // Parse path segments after /catalogo
  const match = cleanPath.match(/^\/catalogo(?:\/([^\/]+)(?:\/([^\/]+))?)?$/);
  if (!match) {
    return {
      view: "list",
      kind: queryKind ? normalizeKind(queryKind) : "skill",
      id: "",
      legacy: Boolean(queryKind),
    };
  }

  const rawSection = match[1];
  const rawId = match[2];

  if (!rawSection) {
    return {
      view: "list",
      kind: queryKind ? normalizeKind(queryKind) : "skill",
      id: "",
      legacy: Boolean(queryKind),
    };
  }

  const kind = normalizeKind(rawSection);
  if (rawId) {
    let id = "";
    try {
      id = decodeURIComponent(rawId);
    } catch {
      id = rawId;
    }
    return {
      view: "detail",
      kind,
      id,
      legacy: false,
    };
  }

  return {
    view: "list",
    kind,
    id: "",
    legacy: false,
  };
}

/**
 * Constructs a canonical URL for a given route.
 * @param {{ view?: "list"|"detail", kind?: string, id?: string }} route
 * @returns {string}
 */
export function buildUrl(route) {
  const kind = normalizeKind(route.kind || "skill");
  const plural = pluralKind(kind);
  if (route.view === "detail" && route.id) {
    return `/catalogo/${plural}/${encodeURIComponent(route.id)}`;
  }
  return `/catalogo/${plural}`;
}

/**
 * Pushes a new route to browser history.
 * @param {{ view?: "list"|"detail", kind?: string, id?: string }} route
 */
export function pushRoute(route) {
  const url = buildUrl(route);
  if (window.location.pathname + window.location.search === url) return;
  window.history.pushState(route, "", url);
  internalHistoryDepth += 1;
}

/**
 * Replaces current route in browser history.
 * @param {{ view?: "list"|"detail", kind?: string, id?: string }} route
 */
export function replaceRoute(route) {
  const url = buildUrl(route);
  window.history.replaceState(route, "", url);
}

/**
 * Navigates back: uses history.back() if internal navigation occurred,
 * otherwise navigates to the fallback route.
 * @param {{ view?: "list"|"detail", kind?: string, id?: string }} fallbackRoute
 */
export function navigateBack(fallbackRoute) {
  if (internalHistoryDepth > 0) {
    internalHistoryDepth -= 1;
    window.history.back();
  } else {
    pushRoute(fallbackRoute);
  }
}

/**
 * Initializes router popstate listener.
 * @param {(route: ReturnType<typeof parseRoute>) => void} onRouteChange
 */
export function initRouter(onRouteChange) {
  window.addEventListener("popstate", () => {
    if (internalHistoryDepth > 0) internalHistoryDepth -= 1;
    const route = parseRoute(window.location.pathname, window.location.search);
    onRouteChange(route);
  });
}

