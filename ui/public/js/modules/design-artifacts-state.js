// @ts-check
// Estado da tela de Artefatos (EP-14.12): filtro, busca e seleção persistidos.
import { getScreenStateClient } from "../shared/screen-state.js";

export const ARTIFACTS_SCREEN = "artifacts";

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value, limit) {
  return typeof value === "string" ? value.slice(0, limit) : "";
}

/** @param {unknown} raw */
export function normalizeArtifactsState(raw) {
  const data = record(raw);
  return {
    kindFilter: text(data.kindFilter, 32) || "all",
    query: text(data.query, 200),
    selectedKey: text(data.selectedKey, 200),
    sortField: text(data.sortField, 32) || "title",
    sortAsc: data.sortAsc === true,
  };
}

/** @param {unknown} partial */
export function artifactsPatch(partial) {
  const data = record(partial);
  const normalized = normalizeArtifactsState(data);
  const patch = {};
  for (const key of ["kindFilter", "query", "selectedKey", "sortField", "sortAsc"]) {
    if (Object.prototype.hasOwnProperty.call(data, key)) patch[key] = normalized[key];
  }
  return patch;
}

/** @param {{ client?: any }} [options] */
export async function readArtifactsState(options = {}) {
  const client = options.client || getScreenStateClient();
  try {
    return normalizeArtifactsState(await client.loadScreen(ARTIFACTS_SCREEN));
  } catch {
    return normalizeArtifactsState({});
  }
}

/** @param {unknown} partial @param {{ client?: any }} [options] */
export async function saveArtifactsState(partial, options = {}) {
  const patch = artifactsPatch(partial);
  const client = options.client || getScreenStateClient();
  try {
    await client.patchScreen(ARTIFACTS_SCREEN, patch);
  } catch {}
  return patch;
}

/** @param {string} acao @param {string} [alvo] @param {{ client?: any }} [options] */
export async function logArtifactsAction(acao, alvo = "", options = {}) {
  try {
    return await (options.client || getScreenStateClient()).logAction(ARTIFACTS_SCREEN, acao, alvo);
  } catch {
    return false;
  }
}
