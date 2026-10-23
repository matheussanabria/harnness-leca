// @ts-check
// Adoção do estado do Ateliê de Protótipos (EP-14.08): normalização dos campos,
// leitura/gravação pelo cliente de estado das telas e regras de restauração.
import { getScreenStateClient } from "../shared/screen-state.js";
import { normalizeWorkspaceLayout } from "./prototype-workspace-layout.js";

export { normalizeWorkspaceLayout };

export const ATELIER_SCREEN = "prototypes";
export const ATELIER_DEFAULT_VIEWPORT = 1280;

const NAME_LIMIT = 120;
const VIEWPORT_LIMIT = 16;

/** @param {unknown} value @returns {Record<string, any> | null} */
function record(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return /** @type {Record<string, any>} */ (value);
}

/** @param {unknown} value @param {number} limit */
function text(value, limit) {
  return typeof value === "string" && value.length <= limit ? value : undefined;
}

/**
 * Saneia o estado do Ateliê vindo do servidor.
 * @param {unknown} raw
 * @returns {Record<string, unknown>}
 */
export function normalizeAtelierState(raw) {
  const data = record(raw);
  if (!data) return {};
  const state = {};

  const activePrototype = text(data.activePrototype, NAME_LIMIT);
  if (activePrototype) state.activePrototype = activePrototype;

  const activeScreen = text(data.activeScreen, NAME_LIMIT);
  if (activeScreen) state.activeScreen = activeScreen;

  const selectedNode = text(data.selectedNode, NAME_LIMIT);
  if (selectedNode !== undefined) state.selectedNode = selectedNode;

  if (typeof data.inspector === "boolean") state.inspector = data.inspector;

  const layout = normalizeWorkspaceLayout(data.workspaceLayout);
  if (layout) state.workspaceLayout = layout;

  const viewport = text(data.viewport, VIEWPORT_LIMIT);
  if (viewport) state.viewport = viewport;

  return state;
}

/**
 * Devolve somente os campos presentes no patch, já validados.
 * @param {unknown} partial
 * @returns {Record<string, unknown>}
 */
export function atelierPatch(partial) {
  const data = record(partial);
  if (!data) return {};
  const normalized = normalizeAtelierState(data);
  /** @type {Record<string, unknown>} */
  const patch = {};
  for (const key of Object.keys(data)) {
    if (Object.prototype.hasOwnProperty.call(normalized, key)) patch[key] = normalized[key];
  }
  return patch;
}

/**
 * Lê e sanea o estado do Ateliê.
 * @param {{ client?: any }} [options]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function readAtelierState(options = {}) {
  const client = options.client || getScreenStateClient();
  try {
    return normalizeAtelierState(await client.loadScreen(ATELIER_SCREEN));
  } catch {
    return {};
  }
}

/**
 * Grava um patch saneado do Ateliê sem bloquear a interface.
 * @param {unknown} partial
 * @param {{ client?: any }} [options]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function saveAtelierState(partial, options = {}) {
  const patch = atelierPatch(partial);
  if (!Object.keys(patch).length) return patch;
  const client = options.client || getScreenStateClient();
  try {
    await client.patchScreen(ATELIER_SCREEN, patch);
  } catch {}
  return patch;
}

/**
 * Registra uma ação do Ateliê no histórico da tela.
 * @param {string} acao
 * @param {string} [alvo]
 * @param {{ client?: any }} [options]
 * @returns {Promise<boolean>}
 */
export async function logAtelierAction(acao, alvo = "", options = {}) {
  const client = options.client || getScreenStateClient();
  try {
    return await client.logAction(ATELIER_SCREEN, acao, alvo);
  } catch {
    return false;
  }
}

/**
 * Acha um protótipo editável do Ateliê no catálogo.
 * @param {Array<{ id?: string, kind?: string }>} catalog
 * @param {string} id
 */
export function findAtelierPrototype(catalog, id) {
  if (!id || !Array.isArray(catalog)) return null;
  return catalog.find((item) => item && item.kind === "atelier" && item.id === id) || null;
}

/**
 * Indica o protótipo salvo quando ele existe no catálogo e ainda não é o aberto.
 * @param {Record<string, any> | null | undefined} saved
 * @param {string} currentId
 * @param {Array<{ id?: string, kind?: string }>} catalog
 */
export function shouldRedirectToSavedPrototype(saved, currentId, catalog) {
  const id = saved && typeof saved.activePrototype === "string" ? saved.activePrototype : "";
  if (!id || id === currentId) return "";
  return findAtelierPrototype(catalog || [], id) ? id : "";
}

/**
 * Mantém a tela salva quando ela ainda existe; senão usa a tela ativa do
 * protótipo ou a primeira disponível.
 * @param {string | undefined} savedScreen
 * @param {Array<{ id?: string }>} screens
 * @param {string | undefined} fallback
 */
export function pickAtelierScreen(savedScreen, screens, fallback) {
  const list = Array.isArray(screens) ? screens.filter((screen) => screen && screen.id) : [];
  const has = (id) => Boolean(id) && list.some((screen) => screen.id === id);
  if (has(savedScreen)) return /** @type {string} */ (savedScreen);
  if (has(fallback)) return /** @type {string} */ (fallback);
  return list[0]?.id || "home";
}

/**
 * Converte o viewport salvo em largura utilizável; inválido volta ao padrão.
 * @param {string | number | undefined} value
 */
export function restoreViewport(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 240 || parsed > 4000) return ATELIER_DEFAULT_VIEWPORT;
  return parsed;
}
