// @ts-check
// Adoção do estado da tela Studio (EP-14.08): regras puras, leitura, gravação
// e registro de ações pelo cliente único de estado das telas.
import { clampSidebarWidth } from "./studio-layout.js";
import { getScreenStateClient } from "../shared/screen-state.js";

export const STUDIO_SCREEN = "studio";
export const SOURCE_WIDTH_MIN = 160;
export const SOURCE_WIDTH_MAX = 720;

const VIEW_LIMIT = 32;
const VIEWPORT_LIMIT = 16;
const ROUTE_LIMIT = 300;
const NAME_LIMIT = 120;

/** @param {unknown} value @returns {Record<string, unknown> | null} */
function record(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return /** @type {Record<string, unknown>} */ (value);
}

/** @param {unknown} value @param {number} limit */
function text(value, limit) {
  return typeof value === "string" && value.length <= limit ? value : undefined;
}

/** @param {unknown} value */
function boolean(value) {
  return typeof value === "boolean" ? value : undefined;
}

/** @param {unknown} value @param {number} min @param {number} max */
function between(value, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(min, Math.min(max, Math.round(value)));
}

/**
 * Saneia o estado do Studio vindo do servidor ou de um patch local.
 * @param {unknown} raw
 * @param {number} [viewportWidth]
 * @returns {Record<string, unknown>}
 */
export function normalizeStudioState(raw, viewportWidth) {
  const data = record(raw);
  if (!data) return {};
  const state = {};

  const activeView = text(data.activeView, VIEW_LIMIT);
  if (activeView) state.activeView = activeView;

  if (typeof data.sidebarWidth === "number" && Number.isFinite(data.sidebarWidth)) {
    state.sidebarWidth = clampSidebarWidth(data.sidebarWidth, viewportWidth);
  }

  const sourceOpen = boolean(data.sourceOpen);
  if (sourceOpen !== undefined) state.sourceOpen = sourceOpen;

  const sourceWidth = between(data.sourceWidth, SOURCE_WIDTH_MIN, SOURCE_WIDTH_MAX);
  if (sourceWidth !== undefined) state.sourceWidth = sourceWidth;

  const viewport = text(data.viewport, VIEWPORT_LIMIT);
  if (viewport) state.viewport = viewport;

  const route = text(data.route, ROUTE_LIMIT);
  if (route) state.route = route;

  const dockMaximized = boolean(data.dockMaximized);
  if (dockMaximized !== undefined) state.dockMaximized = dockMaximized;

  const activePrototype = text(data.activePrototype, NAME_LIMIT);
  if (activePrototype) state.activePrototype = activePrototype;

  const activeScreen = text(data.activeScreen, NAME_LIMIT);
  if (activeScreen) state.activeScreen = activeScreen;

  return state;
}

/**
 * Devolve somente os campos presentes no patch, já validados e limitados.
 * @param {unknown} partial
 * @param {number} [viewportWidth]
 * @returns {Record<string, unknown>}
 */
export function studioPatch(partial, viewportWidth) {
  const data = record(partial);
  if (!data) return {};
  const normalized = normalizeStudioState(data, viewportWidth);
  /** @type {Record<string, unknown>} */
  const patch = {};
  for (const key of Object.keys(data)) {
    if (Object.prototype.hasOwnProperty.call(normalized, key)) patch[key] = normalized[key];
  }
  return patch;
}

/**
 * Lê e sanea o estado da tela Studio.
 * @param {{ client?: any, viewportWidth?: number }} [options]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function readStudioState(options = {}) {
  const client = options.client || getScreenStateClient();
  try {
    return normalizeStudioState(await client.loadScreen(STUDIO_SCREEN), options.viewportWidth);
  } catch {
    return {};
  }
}

/**
 * Hidrata o Studio e aplica cada campo disponível no callback correspondente.
 * @param {{ client?: any, viewportWidth?: number, apply?: Record<string, (value: any) => void> }} [options]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function restoreStudioState(options = {}) {
  const state = await readStudioState(options);
  const apply = record(options.apply) || {};
  for (const [key, value] of Object.entries(state)) {
    const callback = apply[key];
    if (typeof callback !== "function") continue;
    try {
      await callback(value);
    } catch {}
  }
  return state;
}

/**
 * Grava um patch saneado do Studio sem bloquear a interface.
 * @param {unknown} partial
 * @param {{ client?: any, viewportWidth?: number }} [options]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function saveStudioState(partial, options = {}) {
  const patch = studioPatch(partial, options.viewportWidth);
  if (!Object.keys(patch).length) return patch;
  const client = options.client || getScreenStateClient();
  try {
    await client.patchScreen(STUDIO_SCREEN, patch);
  } catch {}
  return patch;
}

/**
 * Registra uma ação do Studio no histórico da tela.
 * @param {string} acao
 * @param {string} [alvo]
 * @param {{ client?: any }} [options]
 * @returns {Promise<boolean>}
 */
export async function logStudioAction(acao, alvo = "", options = {}) {
  const client = options.client || getScreenStateClient();
  try {
    return await client.logAction(STUDIO_SCREEN, acao, alvo);
  } catch {
    return false;
  }
}
