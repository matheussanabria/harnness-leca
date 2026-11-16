// @ts-check
// Where the documentation reader gets its data. In the Harness it is the read-only HTTP API
// (/api/project/:slug/docs/*); the static review package (phase 3) swaps in embedded data with setDocsSource.
import { dls } from "../../design-layers-store.js";

/**
 * @typedef {{
 *   refs: () => Promise<any>,
 *   catalog: () => Promise<any>,
 *   tree: () => Promise<any>,
 *   file: (path: string) => Promise<{ path: string, ext: string, text: string } | { error: string, status: number, notInPackage?: boolean }>,
 *   reset?: () => void,
 *   paths?: () => Promise<string[]>,
 *   isIncluded?: (path: string) => boolean,
 * }} DocsSource
 * `paths` lists every document of the project (links resolve against it); `isIncluded` says whether one can be
 * opened here. Both exist only in the static package, where part of doc/ is left out on purpose.
 */

/**
 * Data embedded in the static review package (tools/pacote-revisao/docs-data.js): no network at all.
 * @param {{ refs?: any, catalog?: any, tree?: any, paths?: string[], files?: Record<string, string> } | null} data
 * @returns {DocsSource}
 */
export function embeddedDocsSource(data) {
  const files = data?.files || {};
  const included = new Set(Object.keys(files));
  const ok = (value) => Promise.resolve(value);
  return {
    refs: () => ok(data?.refs || { found: false }),
    catalog: () => ok(data?.catalog || { found: false }),
    tree: () => ok(data?.tree || { found: false }),
    paths: () => ok(data?.paths || [...included]),
    isIncluded: (path) => included.has(path),
    file: (path) => ok(included.has(path)
      ? { path, ext: (path.split(".").pop() || "").toLowerCase(), text: files[path] }
      : { error: "não incluído no pacote", status: 404, notInPackage: true }),
  };
}

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
