// @ts-check
import { parseDoc } from "./canvas-model.js";
import { saveAtelierState } from "../prototype-atelier-state.js";

const PREFIX = "harness.canvas.v1";
const docs = new Map();
let hydrating = false;
let saveTimer = null;

export function storageKey(slug, protoId) {
  return `${PREFIX}.${slug}.${protoId}`;
}

function scheduleSave() {
  if (hydrating) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void saveAtelierState({ canvas: Object.fromEntries(docs) });
  }, 300);
}

/** Storage em memória cuja gravação alimenta o estado persistido do Ateliê. */
export const memoryStorage = {
  getItem(key) {
    return docs.has(key) ? docs.get(key) : null;
  },
  setItem(key, value) {
    docs.set(key, String(value));
    scheduleSave();
  },
  removeItem(key) {
    docs.delete(key);
    scheduleSave();
  },
};

/** @param {unknown} saved */
export function hydrateCanvasDocs(saved) {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return;
  hydrating = true;
  docs.clear();
  for (const [key, value] of Object.entries(saved)) {
    if (typeof key === "string" && key.startsWith(PREFIX) && typeof value === "string") {
      docs.set(key, value);
    }
  }
  hydrating = false;
}

function defaultStorage() {
  return memoryStorage;
}

export function loadDoc(slug, protoId, storage = defaultStorage()) {
  try {
    const raw = storage?.getItem(storageKey(slug, protoId));
    return raw ? parseDoc(raw) : null;
  } catch {
    return null;
  }
}

export function saveDoc(slug, protoId, doc, storage = defaultStorage()) {
  try {
    storage?.setItem(storageKey(slug, protoId), JSON.stringify(doc));
    return true;
  } catch {
    return false;
  }
}

/** Salvamento com debounce; `flush()` grava na hora (ex.: ao sair do modo). */
export function createSaver(slug, protoId, getDoc, delay = 400, storage = defaultStorage()) {
  let timer = null;
  const flush = () => {
    clearTimeout(timer);
    timer = null;
    return saveDoc(slug, protoId, getDoc(), storage);
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(flush, delay);
  };
  return { schedule, flush };
}
