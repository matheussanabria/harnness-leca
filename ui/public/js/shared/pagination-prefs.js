// @ts-check
// Global page-size preference (screen `lists`).
// Hydrates before the first render, keeps a synchronous cache and saves through patchScreen.
import { DEFAULT_PAGE_SIZE, normalizePageSize, setPageSize, setPageSizeSaver } from "./pagination.js";
import { loadScreen, patchScreen } from "./screen-state.js";

export const LISTS_SCREEN = "lists";

/**
 * Keeps only keys whose integer size is one of the presets.
 * @param {unknown} value
 * @returns {Record<string, number>}
 */
export function cleanPageSizes(value) {
  /** @type {Record<string, number>} */
  const out = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const [key, raw] of Object.entries(value)) {
    if (!key || typeof raw !== "number" || !Number.isInteger(raw)) continue;
    const size = normalizePageSize(raw);
    if (size === raw) out[key] = size;
  }
  return out;
}

/**
 * Builds the page-size manager with injectable dependencies (tests).
 * @param {{ loadScreen?: (id: string) => Promise<Record<string, unknown>>, patchScreen?: (id: string, patch: object) => Promise<unknown> }} [deps]
 */
export function createPageSizePrefs(deps = {}) {
  const read = deps.loadScreen || loadScreen;
  const write = deps.patchScreen || patchScreen;
  /** @type {Record<string, number>} */
  let cache = {};
  let hydrated = false;
  /** @type {Promise<void> | null} */
  let hydrating = null;

  const apply = () => {
    for (const [key, size] of Object.entries(cache)) setPageSize(key, size);
  };

  const hydrate = async () => {
    if (hydrated) return { ...cache };
    if (!hydrating) {
      hydrating = Promise.resolve()
        .then(() => read(LISTS_SCREEN))
        .then((state) => {
          cache = cleanPageSizes(state?.pageSizes);
          apply();
          hydrated = true;
        })
        .catch(() => {})
        .finally(() => { hydrating = null; });
    }
    await hydrating;
    return { ...cache };
  };

  return {
    hydrate,
    /** @param {string} key */
    size(key) {
      return cache[key] ?? DEFAULT_PAGE_SIZE;
    },
    sizes() {
      return { ...cache };
    },
    /**
     * @param {string} key @param {number} size
     * @returns {Promise<number>}
     */
    async saveSize(key, size) {
      await hydrate();
      const normalized = normalizePageSize(size);
      cache = { ...cache, [key]: normalized };
      setPageSize(key, normalized);
      try {
        await write(LISTS_SCREEN, { pageSizes: { ...cache } });
      } catch {}
      return normalized;
    },
  };
}

const prefs = createPageSizePrefs();

/** Loads the saved sizes before the first render. */
export const hydratePageSizes = () => prefs.hydrate();

/** @param {string} key @param {number} size */
export const savePageSize = (key, size) => prefs.saveSize(key, size);

/** @param {string} key */
export const getListPageSize = (key) => prefs.size(key);

setPageSizeSaver(savePageSize);
