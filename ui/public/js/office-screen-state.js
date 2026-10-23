// @ts-check
// Estado da tela do escritório (EP-14.10): HUD, sensibilidade do mouse e modo
// de visualização hidratados do servidor e gravados pelo cliente de telas.
import { viewModeStorageKey } from "./office/view-modes.js";
import { SCENE_STORAGE_KEY } from "./office/scene-preferences.js";

export const MIN_SENSITIVITY = 1;
export const MAX_SENSITIVITY = 10;
export const DEFAULT_SENSITIVITY = 5;

/** @param {unknown} value */
export function normalizeSensitivity(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_SENSITIVITY;
  return Math.min(MAX_SENSITIVITY, Math.max(MIN_SENSITIVITY, parsed));
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** @param {unknown} value */
export function normalizeViewEntry(value) {
  if (!isRecord(value)) return null;
  const mode = typeof value.mode === "string" ? value.mode.trim() : "";
  const cameraMode = typeof value.cameraMode === "string" ? value.cameraMode.trim() : "";
  if (!mode && !cameraMode) return null;
  return { mode, cameraMode };
}

/**
 * Aceita tanto o formato antigo `{ mode, cameraMode }` quanto o mapa por
 * projeto e devolve sempre um mapa por projeto.
 * @param {unknown} raw @param {string} project
 */
export function normalizeViewMap(raw, project = "global") {
  const single = normalizeViewEntry(raw);
  if (single) return { [project]: single };

  const map = {};
  if (!isRecord(raw)) return map;
  for (const [key, value] of Object.entries(raw)) {
    const entry = normalizeViewEntry(value);
    if (entry) map[key] = entry;
  }
  return map;
}

/** @param {unknown} raw @param {string} [project] */
export function normalizeOfficeState(raw, project = "global") {
  const state = isRecord(raw) ? raw : {};
  return {
    hudHidden: state.hudHidden === true,
    mouseSensitivity: normalizeSensitivity(state.mouseSensitivity),
    viewMode: normalizeViewMap(state.viewMode, project),
    windowLayout: isRecord(state.windowLayout) ? state.windowLayout : {},
    windowState: isRecord(state.windowState) ? state.windowState : {},
    workspaces: isRecord(state.workspaces) ? state.workspaces : {},
    scenePreferences: isRecord(state.scenePreferences) ? state.scenePreferences : {},
  };
}

export class OfficeScreenState {
  /**
   * @param {{ client?: any, project?: string, onError?: (error: unknown) => void }} [options]
   */
  constructor(options = {}) {
    this.client = options.client || null;
    this.project = typeof options.project === "string" && options.project ? options.project : "global";
    this.onError = typeof options.onError === "function" ? options.onError : null;
    this.state = normalizeOfficeState({}, this.project);
  }

  async hydrate() {
    if (!this.client?.loadScreen) return this.state;
    try {
      this.state = normalizeOfficeState(await this.client.loadScreen("office"), this.project);
    } catch (error) {
      this.#report(error);
    }
    return this.state;
  }

  get hudHidden() {
    return this.state.hudHidden;
  }

  get mouseSensitivity() {
    return this.state.mouseSensitivity;
  }

  /** @param {string} [project] */
  viewState(project = this.project) {
    return this.state.viewMode[project] || null;
  }

  /**
   * Adaptador síncrono da preferência de cena usado por OfficeScenePreferences.
   */
  sceneStorage() {
    return {
      getItem: (key) => {
        if (key !== SCENE_STORAGE_KEY) return null;
        const value = this.state.scenePreferences;
        return Object.keys(value).length ? JSON.stringify(value) : null;
      },
      setItem: (key, raw) => {
        if (key !== SCENE_STORAGE_KEY) return;
        try {
          const parsed = JSON.parse(raw);
          if (!isRecord(parsed)) return;
          this.state.scenePreferences = parsed;
          void this.#save({ scenePreferences: parsed });
        } catch {}
      },
      removeItem: (key) => {
        if (key !== SCENE_STORAGE_KEY) return;
        this.state.scenePreferences = {};
        void this.#save({ scenePreferences: {} });
      },
    };
  }

  /** @param {unknown} hidden */
  async setHudHidden(hidden) {
    this.state.hudHidden = hidden === true;
    return this.#save({ hudHidden: this.state.hudHidden });
  }

  /** @param {unknown} value */
  async setMouseSensitivity(value) {
    this.state.mouseSensitivity = normalizeSensitivity(value);
    return this.#save({ mouseSensitivity: this.state.mouseSensitivity });
  }

  /**
   * @param {unknown} entry @param {string} [project]
   */
  async setViewState(entry, project = this.project) {
    const normalized = normalizeViewEntry(entry);
    if (!normalized) return false;
    this.state.viewMode[project] = normalized;
    return this.#save({ viewMode: { ...this.state.viewMode } });
  }

  /**
   * Adaptador síncrono usado pelo controlador de modos de visão; as gravações
   * seguem para o servidor pelo cliente de estado da tela.
   * @param {() => string} [getProject]
   */
  viewStorage(getProject = () => this.project) {
    const resolve = () => {
      try {
        const project = getProject();
        return typeof project === "string" && project ? project : this.project;
      } catch {
        return this.project;
      }
    };
    return {
      getItem: (key) => {
        const project = resolve();
        if (key !== viewModeStorageKey(project)) return null;
        const entry = this.viewState(project);
        return entry ? JSON.stringify(entry) : null;
      },
      setItem: (key, raw) => {
        const project = resolve();
        if (key !== viewModeStorageKey(project)) return;
        try {
          void this.setViewState(JSON.parse(raw), project);
        } catch {}
      },
      removeItem: (key) => {
        const project = resolve();
        if (key !== viewModeStorageKey(project)) return;
        delete this.state.viewMode[project];
        void this.#save({ viewMode: { ...this.state.viewMode } });
      },
    };
  }

  /** @param {Record<string, unknown>} patch */
  async #save(patch) {
    if (!this.client?.patchScreen) return false;
    try {
      await this.client.patchScreen("office", patch);
      return true;
    } catch (error) {
      this.#report(error);
      return false;
    }
  }

  /** @param {unknown} error */
  #report(error) {
    if (this.onError) this.onError(error);
  }
}
