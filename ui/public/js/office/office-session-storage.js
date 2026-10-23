// @ts-check
// Storage síncrono do escritório apoiado no estado da tela "office" (EP-14.12).
// O Window Manager continua usando a interface de Storage; a gravação vai para
// windowLayout, windowState e workspaces no servidor.
import { STORAGE_PREFIX as LAYOUT_PREFIX } from "../window-manager/layout-persistence.js";
import { WORKSPACE_STATE_STORAGE_PREFIX } from "../window-manager/workspace-persistence.js";
import { WORKSPACE_STORAGE_PREFIX } from "../window-manager/workspace-presets.js";

const entries = new Map();
let client = null;
let timer = null;

function fieldFor(key) {
  if (key.startsWith(LAYOUT_PREFIX)) return "windowLayout";
  if (key.startsWith(WORKSPACE_STATE_STORAGE_PREFIX)) return "windowState";
  if (key.startsWith(WORKSPACE_STORAGE_PREFIX)) return "workspaces";
  return "";
}

function collect(field) {
  /** @type {Record<string, string>} */
  const result = {};
  for (const [key, value] of entries) {
    if (fieldFor(key) === field) result[key] = value;
  }
  return result;
}

function scheduleSave() {
  if (!client?.patchScreen) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const fields = ["windowLayout", "windowState", "workspaces"];
    const patch = {};
    for (const field of fields) patch[field] = collect(field);
    void client.patchScreen("office", patch).catch(() => {});
  }, 250);
}

export const officeSessionStorage = {
  getItem(key) {
    return entries.has(key) ? entries.get(key) : null;
  },
  setItem(key, value) {
    entries.set(String(key), String(value));
    scheduleSave();
  },
  removeItem(key) {
    entries.delete(String(key));
    scheduleSave();
  },
};

/** @param {unknown} saved */
export function hydrateOfficeSession(saved) {
  const data = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  entries.clear();
  for (const field of ["windowLayout", "windowState", "workspaces"]) {
    const group = data[field];
    if (!group || typeof group !== "object" || Array.isArray(group)) continue;
    for (const [key, value] of Object.entries(group)) {
      if (typeof value === "string" && fieldFor(key) === field) entries.set(key, value);
    }
  }
  return entries.size;
}

/** @param {any} nextClient */
export function bindOfficeSessionClient(nextClient) {
  client = nextClient || null;
}

/** Limpa o adaptador e agenda uma gravação vazia (troca de projeto/testes). */
export function clearOfficeSession() {
  entries.clear();
  scheduleSave();
}
