// @ts-check
// Estado da seção de skills dentro da tela de Conversas (EP-14.12).
import { getScreenStateClient } from "../shared/screen-state.js";
import { sks } from "./skills-store.js";

const CHATS_SCREEN = "chats";
const SUBTABS = new Set(["md", "refs"]);

/** @param {unknown} raw */
export function normalizeSkillsState(raw) {
  const data = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    subTab: SUBTABS.has(data.skillSubTab) ? data.skillSubTab : "md",
    importFilter: typeof data.skillImportFilter === "string" ? data.skillImportFilter.slice(0, 200) : "",
    importSource: typeof data.skillImportSource === "string" ? data.skillImportSource.slice(0, 32) : "all",
  };
}

/** @param {{ client?: any }} [options] */
export async function hydrateSkillsState(options = {}) {
  const client = options.client || getScreenStateClient();
  try {
    const state = normalizeSkillsState(await client.loadScreen(CHATS_SCREEN));
    sks.currentSkillSubTab = state.subTab;
    sks.currentImportFilterText = state.importFilter.toLowerCase();
    sks.currentImportSourceFilter = state.importSource;
    return state;
  } catch {
    return normalizeSkillsState({});
  }
}

/** @param {{ subTab?: string, importFilter?: string, importSource?: string }} [partial] */
export function persistSkillsState(partial = {}) {
  const patch = {};
  if (typeof partial.subTab === "string") patch.skillSubTab = partial.subTab;
  if (typeof partial.importFilter === "string") patch.skillImportFilter = partial.importFilter;
  if (typeof partial.importSource === "string") patch.skillImportSource = partial.importSource;
  if (!Object.keys(patch).length) return;
  try {
    void getScreenStateClient().patchScreen(CHATS_SCREEN, patch);
  } catch {}
}
