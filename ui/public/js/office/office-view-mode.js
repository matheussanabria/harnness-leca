// @ts-check
/**
 * DAI HQ — Controlador observável dos modos de visualização (EP-03.07).
 * Orquestra o ciclo de vida dos motores 3D/2.5D, preserva a última câmera e
 * projeta o estado em atributos e botões. Não renderiza cena nem conhece Three.js.
 */
import {
  DEFAULT_CAMERA_MODE,
  DEFAULT_VIEW_MODE,
  VIEW_MODE_CATALOG,
  cameraModeForEngine,
  clearViewState,
  normalizeCameraMode,
  readViewState,
  resolveViewMode,
  writeViewState
} from "./view-modes.js";

const BUTTON_BY_CAMERA = {
  third_person: "btnMode3rdPerson",
  first_person: "btnMode1stPerson",
  workstation: "btnModeWorkstation",
  screen_focus: "btnModeWorkstation",
  war_room: "btnModeWarRoom",
  war_room_seated: "btnModeWarRoom",
  orbit: "btnModeOrbit"
};

const BUTTON_IDS = [
  "btnMode3rdPerson",
  "btnMode1stPerson",
  "btnModeWorkstation",
  "btnModeWarRoom",
  "btnModeOrbit",
  "btnMode2D"
];

/**
 * @returns {{ getItem: Function, setItem: Function, removeItem: Function } | null}
 */
export function defaultOfficeStorage() {
  return null;
}

export class OfficeViewModeController {
  /**
   * @param {Object} [options]
   * @param {Record<string, any>} [options.engines]
   * @param {Document | any} [options.doc]
   * @param {any} [options.storage]
   * @param {() => string} [options.getProject]
   * @param {Function} [options.onCameraMode]
   * @param {Function} [options.onViewChanged]
   * @param {Function} [options.onError]
   */
  constructor(options = {}) {
    this.engines = options.engines || {};
    this.doc = options.doc ?? (typeof document !== "undefined" ? document : null);
    this.storage = options.storage === undefined ? defaultOfficeStorage() : options.storage;
    this.getProject = typeof options.getProject === "function" ? options.getProject : () => "global";
    this.onCameraMode = typeof options.onCameraMode === "function" ? options.onCameraMode : null;
    this.onViewChanged = typeof options.onViewChanged === "function" ? options.onViewChanged : null;
    this.onError = typeof options.onError === "function" ? options.onError : null;

    this._mode = DEFAULT_VIEW_MODE;
    this._cameraMode = DEFAULT_CAMERA_MODE;
    this._lastCameraMode = DEFAULT_CAMERA_MODE;
    /** @type {Set<Function>} */
    this._listeners = new Set();
  }

  getMode() {
    return this._mode;
  }

  getCameraMode() {
    return this._cameraMode;
  }

  /** @returns {{ mode: string, cameraMode: string, lastCameraMode: string, label: string, engine: string, icon: string, hint: string, project: string }} */
  getSnapshot() {
    const base = VIEW_MODE_CATALOG[this._mode];
    return {
      mode: this._mode,
      cameraMode: this._cameraMode,
      lastCameraMode: this._lastCameraMode,
      label: base.label,
      engine: base.engine,
      icon: base.icon,
      hint: base.hint,
      project: this.getProject()
    };
  }

  /**
   * @param {(snapshot: any, previous: any) => void} listener
   * @returns {() => void}
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Alterna o modo preservando projeto, janelas e a última câmera 3D.
   * @param {string} mode
   * @param {{ cameraMode?: string, reason?: string, preserveLastCamera?: boolean }} [options]
   * @returns {Promise<any | null>}
   */
  async switchTo(mode, options = {}) {
    const meta = resolveViewMode(mode);
    const requested =
      options.cameraMode == null ? meta.cameraMode || null : normalizeCameraMode(options.cameraMode);
    const target = requested === "orbit" ? "diorama" : meta.id;
    const previous = this.getSnapshot();

    if (previous.mode === "3d" && target !== "3d" && !options.preserveLastCamera) {
      this._lastCameraMode = normalizeCameraMode(this.engines["3d"]?.viewMode || previous.cameraMode);
    }

    const cameraMode =
      target === "diorama"
        ? "orbit"
        : target === "2.5d"
          ? this._lastCameraMode
          : normalizeCameraMode(requested || this._lastCameraMode);

    try {
      await this._activate(target);
    } catch (error) {
      this._report(error, { target, previous });
      return null;
    }

    this._mode = target;
    this._cameraMode = cameraMode;
    if (target === "3d") this._lastCameraMode = cameraMode;

    if (target !== "2.5d") {
      const engineCamera = target === "diorama" ? "orbit" : cameraModeForEngine(cameraMode);
      try {
        this.engines["3d"]?.setViewMode?.(engineCamera);
        this.onCameraMode?.(cameraMode, engineCamera);
      } catch (error) {
        this._report(error, { target, cameraMode });
      }
    }

    this._syncDom();
    const snapshot = this.getSnapshot();
    writeViewState(this.storage, snapshot.project, {
      mode: snapshot.mode,
      cameraMode: target === "3d" ? snapshot.cameraMode : this._lastCameraMode
    });
    this._emit(snapshot, previous, options.reason || "switch");
    return snapshot;
  }

  /**
   * Aplica uma câmera dentro do modo 3D.
   * @param {string} cameraMode
   * @returns {Promise<any | null>}
   */
  async setCameraMode(cameraMode) {
    return this.switchTo("3d", { cameraMode });
  }

  /** Restaura o modo e a câmera salvos para o projeto ativo. */
  async restore() {
    const saved = readViewState(this.storage, this.getProject());
    if (saved?.cameraMode) this._lastCameraMode = normalizeCameraMode(saved.cameraMode);
    return this.switchTo(saved?.mode || DEFAULT_VIEW_MODE, {
      cameraMode: saved?.cameraMode,
      reason: "restore",
      preserveLastCamera: true
    });
  }

  /** Volta ao padrão e limpa a preferência do projeto. */
  async reset() {
    clearViewState(this.storage, this.getProject());
    this._lastCameraMode = DEFAULT_CAMERA_MODE;
    return this.switchTo(DEFAULT_VIEW_MODE, { cameraMode: DEFAULT_CAMERA_MODE, reason: "reset" });
  }

  /** @private */
  async _activate(target) {
    const meta = VIEW_MODE_CATALOG[target];
    const engine = this.engines[meta.engine];
    if (!engine) throw new Error(`Motor de visualização indisponível: ${meta.engine}`);

    if (target === "2.5d") {
      this._safeStop(this.engines["3d"]);
      await engine.start?.();
      return;
    }

    this._safeStop(this.engines["2.5d"]);
    const ready = await engine.init?.();
    if (ready === false) throw new Error("Não foi possível iniciar o motor 3D");
    await engine.start?.();
  }

  /** @private */
  _safeStop(engine) {
    try {
      engine?.stop?.();
    } catch (error) {
      this._report(error, { action: "stop" });
    }
  }

  /** @private */
  _syncDom() {
    const doc = this.doc;
    if (!doc?.documentElement) return;

    doc.documentElement.setAttribute("data-office-view", this._mode);
    doc.documentElement.setAttribute("data-office-camera", this._cameraMode);

    const activeId =
      this._mode === "2.5d"
        ? "btnMode2D"
        : this._mode === "diorama"
          ? "btnModeOrbit"
          : BUTTON_BY_CAMERA[this._cameraMode] || "btnMode3rdPerson";

    for (const id of BUTTON_IDS) {
      const button = doc.getElementById?.(id);
      if (!button) continue;
      const active = id === activeId;
      button.classList?.toggle("active", active);
      button.setAttribute?.("aria-pressed", active ? "true" : "false");
    }
  }

  /** @private */
  _emit(snapshot, previous, reason) {
    try {
      this.onViewChanged?.(snapshot, previous, reason);
    } catch (error) {
      this._report(error, { action: "onViewChanged" });
    }
    for (const listener of this._listeners) {
      try {
        listener(snapshot, previous);
      } catch (error) {
        this._report(error, { action: "listener" });
      }
    }
  }

  /** @private */
  _report(error, context) {
    if (this.onError) {
      this.onError(error, context);
      return;
    }
    if (typeof console !== "undefined") {
      console.error("[OfficeViewMode] Falha ao alternar visualização:", error, context);
    }
  }
}
