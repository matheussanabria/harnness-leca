// @ts-check
// Estado da tela de Rotinas (EP-14.12): busca, aprovações e rotina selecionada.
import { getScreenStateClient } from "../shared/screen-state.js";

export const ROUTINES_SCREEN = "routines";
export const ROUTINE_APPROVAL_FILTERS = Object.freeze(["all", "pending"]);

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value, limit) {
  return typeof value === "string" ? value.slice(0, limit) : "";
}

/** @param {unknown} raw */
export function normalizeRoutinesState(raw) {
  const data = record(raw);
  return {
    filter: text(data.filter, 120),
    selectedRoutine: text(data.selectedRoutine, 120),
    approvalFilter: ROUTINE_APPROVAL_FILTERS.includes(data.approvalFilter) ? data.approvalFilter : "all",
    tab: text(data.tab, 32) || "overview",
  };
}

/** @param {unknown} partial */
export function routinesPatch(partial) {
  const data = record(partial);
  const normalized = normalizeRoutinesState(data);
  const patch = {};
  for (const key of ["filter", "selectedRoutine", "approvalFilter", "tab"]) {
    if (Object.prototype.hasOwnProperty.call(data, key)) patch[key] = normalized[key];
  }
  return patch;
}

/** @param {{ client?: any }} [options] */
export async function readRoutinesState(options = {}) {
  const client = options.client || getScreenStateClient();
  try {
    return normalizeRoutinesState(await client.loadScreen(ROUTINES_SCREEN));
  } catch {
    return normalizeRoutinesState({});
  }
}

/** @param {unknown} partial @param {{ client?: any }} [options] */
export async function saveRoutinesState(partial, options = {}) {
  const patch = routinesPatch(partial);
  const client = options.client || getScreenStateClient();
  try {
    await client.patchScreen(ROUTINES_SCREEN, patch);
  } catch {}
  return patch;
}

/** @param {string} acao @param {string} [alvo] @param {{ client?: any }} [options] */
export async function logRoutinesAction(acao, alvo = "", options = {}) {
  try {
    return await (options.client || getScreenStateClient()).logAction(ROUTINES_SCREEN, acao, alvo);
  } catch {
    return false;
  }
}
