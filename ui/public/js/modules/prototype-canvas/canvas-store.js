// @ts-check
import { parseDoc } from "./canvas-model.js";

const PREFIX = "harness.canvas.v1";

export function storageKey(slug, protoId) {
  return `${PREFIX}.${slug}.${protoId}`;
}

function defaultStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
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
