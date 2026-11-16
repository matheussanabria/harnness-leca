// @ts-check
// Where the documentation reader gets its data. In the Harness it is the read-only HTTP API
// (/api/project/:slug/docs/*); the static review package (phase 3) swaps in embedded data with setDocsSource.
import { dls } from "../../design-layers-store.js";

/**
 * @typedef {{
 *   refs: () => Promise<any>,
 *   catalog: () => Promise<any>,
 *   tree: () => Promise<any>,
 *   file: (path: string) => Promise<{ path: string, ext: string, text: string } | { error: string, status: number }>,
 *   reset?: () => void,
 * }} DocsSource
 */

/** @type {DocsSource | null} */
let source = null;

/** @param {string} slug @returns {DocsSource} */
export function httpDocsSource(slug) {
  const base = `/api/project/${encodeURIComponent(slug)}/docs`;
  /** @type {Map<string, Promise<any>>} */
  const cache = new Map();
  const json = async (url) => {
    const res = await fetch(url);
    const body = await res.json().catch(() => ({}));
    return res.ok ? body : { error: body.error || `HTTP ${res.status}`, status: res.status };
  };
  const once = (key, url) => {
    if (!cache.has(key)) cache.set(key, json(url).catch(() => ({ error: "falha de conexão", status: 0 })));
    return /** @type {Promise<any>} */ (cache.get(key));
  };
  return {
    refs: () => once("refs", `${base}/refs`),
    catalog: () => once("catalog", `${base}/catalog`),
    tree: () => once("tree", `${base}/tree`),
    file: (path) => once(`file:${path}`, `${base}/file?path=${encodeURIComponent(path)}`),
    reset: () => cache.clear(),
  };
}

/** @param {DocsSource | null} next */
export function setDocsSource(next) {
  source = next;
}

/** @returns {DocsSource | null} */
export function getDocsSource() {
  return source;
}

/** Reference index for the chips and the "Documentação oficial" block; null when the project has no doc/. */
export async function refreshDocsRefs() {
  if (!source) {
    dls.docsRefs = null;
    return;
  }
  try {
    const refs = await source.refs();
    dls.docsRefs = refs && refs.found ? refs : null;
  } catch {
    dls.docsRefs = null;
  }
}

/** Called with the other Layers map loads (design.js). @param {string} slug */
export async function loadDocsRefs(slug) {
  setDocsSource(httpDocsSource(slug));
  await refreshDocsRefs();
}
