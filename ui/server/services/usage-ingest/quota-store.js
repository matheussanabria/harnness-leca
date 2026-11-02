// @ts-check
// Global store of the LATEST QuotaSnapshot per provider+window. One small JSON file, written atomically
// (tmp + rename). Bounded: at most providers x windows entries. Holds no secrets, only the allow-listed fields.
const fs = require("fs");
const path = require("path");
const { validateSnapshot, snapshotKey, PROVIDERS, WINDOWS } = require("./quota-model");

const FILE_NAME = "usage-quotas.json";
const MAX_ENTRIES = PROVIDERS.length * WINDOWS.length;

/** @returns {string} global data dir, resolved lazily so HARNESS_ROOT overrides work */
function defaultDir() {
  const { ROOT } = require("../../../../tools/lib/root");
  return path.join(ROOT, "coordination");
}

/** @param {{ dir?: string }} [options] */
function createQuotaStore(options = {}) {
  const file = () => path.join(options.dir || defaultDir(), FILE_NAME);
  /** @type {Map<string, import("./quota-model").QuotaSnapshot> | null} */
  let cache = null;

  function load() {
    if (cache) return cache;
    cache = new Map();
    try {
      const raw = JSON.parse(fs.readFileSync(file(), "utf8"));
      for (const item of Array.isArray(raw && raw.snapshots) ? raw.snapshots : []) {
        const s = validateSnapshot(item);
        if (s) cache.set(snapshotKey(s), s);
      }
    } catch {
      /* missing or corrupt: start empty */
    }
    return cache;
  }

  function persist() {
    const target = file();
    const tmp = `${target}.${process.pid}.tmp`;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify({ version: 1, snapshots: [...load().values()].slice(0, MAX_ENTRIES) }));
    fs.renameSync(tmp, target);
  }

  return {
    /** @returns {boolean} true when stored (valid and not older than the current one) */
    save(/** @type {unknown} */ raw) {
      const s = validateSnapshot(raw);
      if (!s) return false;
      const map = load();
      const prev = map.get(snapshotKey(s));
      if (prev && Date.parse(prev.observedAt) > Date.parse(s.observedAt)) return false;
      if (prev && JSON.stringify(prev) === JSON.stringify(s)) return true;
      map.set(snapshotKey(s), s);
      try { persist(); } catch { /* keep the in-memory value; next save retries */ }
      return true;
    },
    /** @returns {import("./quota-model").QuotaSnapshot[]} */
    list() {
      return [...load().values()];
    },
  };
}

/** @type {ReturnType<typeof createQuotaStore> | null} */
let shared = null;
const getQuotaStore = () => (shared ||= createQuotaStore());
function resetQuotaStore() { shared = null; }

module.exports = { createQuotaStore, getQuotaStore, resetQuotaStore, FILE_NAME };
