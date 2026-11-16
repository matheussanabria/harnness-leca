// @ts-check
// Direct links to a document. The Harness router owns the hash (#/layers), so inside the app the link is a
// query parameter: ?doc=<path>&docAnchor=<anchor>. The static package has no router and uses the hash:
// #doc/<path>#<anchor>. Paths are relative to doc/.

/** @type {"app" | "hash"} */
let mode = "app";

/** @param {"app" | "hash"} next */
export function setDocsLinkMode(next) {
  mode = next;
}

export const getDocsLinkMode = () => mode;

/** @param {string} path @param {string} [anchor] */
export function docHref(path, anchor = "") {
  if (mode === "hash") return `#doc/${encodeURI(path)}${anchor ? `#${encodeURIComponent(anchor)}` : ""}`;
  const params = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
  params.set("doc", path);
  if (anchor) params.set("docAnchor", anchor);
  else params.delete("docAnchor");
  const hash = typeof location !== "undefined" ? location.hash : "";
  return `?${params.toString()}${hash}`;
}

/**
 * The document a location points at, in either form.
 * @param {{ search?: string, hash?: string }} loc
 * @returns {{ path: string, anchor: string } | null}
 */
export function parseDocLocation(loc) {
  const hash = String(loc.hash || "");
  if (hash.startsWith("#doc/")) {
    const [rawPath, rawAnchor = ""] = hash.slice(5).split("#");
    try {
      return { path: decodeURI(rawPath), anchor: decodeURIComponent(rawAnchor) };
    } catch {
      return null;
    }
  }
  const params = new URLSearchParams(String(loc.search || ""));
  const path = params.get("doc");
  return path ? { path, anchor: params.get("docAnchor") || "" } : null;
}

/** Records the open document in the address bar without a navigation. @param {string | null} path @param {string} [anchor] */
export function writeDocLocation(path, anchor = "") {
  if (typeof history === "undefined" || typeof location === "undefined") return;
  try {
    if (mode === "hash") {
      if (path) history.replaceState(null, "", docHref(path, anchor));
      return;
    }
    const params = new URLSearchParams(location.search);
    if (path) {
      params.set("doc", path);
      if (anchor) params.set("docAnchor", anchor);
      else params.delete("docAnchor");
    } else {
      params.delete("doc");
      params.delete("docAnchor");
    }
    const query = params.toString();
    history.replaceState(history.state, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
  } catch {
    // file:// and sandboxed frames may refuse replaceState; the reader works without it
  }
}
