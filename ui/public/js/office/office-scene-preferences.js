// @ts-check
/**
 * DAI HQ — Controlador de preferências de desempenho e acessibilidade da cena (EP-03.09).
 * Liga controles nativos e matchMedia ao modelo puro, sem renderizar a cena.
 */
import {
  QUALITY_LABELS,
  normalizeQuality,
  prefersReducedMotion,
  readScenePreferences,
  resolveScenePreferences,
  writeScenePreferences
} from "./scene-preferences.js";

export class OfficeScenePreferences {
  /**
   * @param {Object} [options]
   * @param {Document | any} [options.doc]
   * @param {Window | any} [options.win]
   * @param {any} [options.storage]
   * @param {(state: any, reason: string) => void} [options.onChange]
   */
  constructor(options = {}) {
    this.doc = options.doc ?? (typeof document !== "undefined" ? document : null);
    this.win = options.win ?? (typeof window !== "undefined" ? window : null);
    this.storage = options.storage === undefined ? this._defaultStorage() : options.storage;
    this.onChange = typeof options.onChange === "function" ? options.onChange : null;

    this.preferences = { quality: "auto", reducedMotion: false };
    this.systemReducedMotion = false;
    this.mediaQuery = null;
    this._listeners = [];
    this._boundMedia = () => this._onMediaChange();
  }

  /** @private */
  _defaultStorage() {
    try {
      return this.win?.localStorage || null;
    } catch (_) {
      return null;
    }
  }

  /** @returns {any} */
  init() {
    this.preferences = readScenePreferences(this.storage);
    this.systemReducedMotion = prefersReducedMotion(this.win);
    this._bindMedia();
    this._bindControls();
    return this.apply("init");
  }

  /** @returns {any} */
  getState() {
    return resolveScenePreferences({
      quality: this.preferences.quality,
      reducedMotion: this.preferences.reducedMotion,
      systemReducedMotion: this.systemReducedMotion,
      deviceMemory: this.win?.navigator?.deviceMemory,
      hardwareConcurrency: this.win?.navigator?.hardwareConcurrency
    });
  }

  /** @param {unknown} quality */
  setQuality(quality) {
    this.preferences.quality = normalizeQuality(quality);
    writeScenePreferences(this.storage, this.preferences);
    const state = this.apply("quality");
    this.announce(`Qualidade de renderização: ${QUALITY_LABELS[state.quality]}.`);
    return state;
  }

  /** @param {boolean} reduced */
  setReducedMotion(reduced) {
    this.preferences.reducedMotion = Boolean(reduced);
    writeScenePreferences(this.storage, this.preferences);
    const state = this.apply("motion");
    const message = state.reducedMotion
      ? state.systemReducedMotion && !this.preferences.reducedMotion
        ? "Movimento reduzido mantido pela preferência do sistema."
        : "Movimento reduzido ativado."
      : "Movimento reduzido desativado.";
    this.announce(message);
    return state;
  }

  /** Alterna a preferência do usuário. */
  toggleReducedMotion() {
    const state = this.getState();
    return this.setReducedMotion(!state.reducedMotion);
  }

  /** @param {string} message */
  announce(message) {
    const live = this.doc?.getElementById?.("officeLiveStatus");
    if (!live) return;
    live.textContent = "";
    live.textContent = String(message || "");
  }

  /**
   * Aplica atributos e sincroniza os controles.
   * @param {string} reason
   * @returns {any}
   */
  apply(reason = "apply") {
    const state = this.getState();
    const root = this.doc?.documentElement;
    root?.setAttribute?.("data-office-quality", state.profile.id);
    root?.setAttribute?.("data-office-motion", state.reducedMotion ? "reduce" : "full");

    const select = this.doc?.getElementById?.("officeQualitySelect");
    if (select) select.value = state.quality;

    const motionButton = this.doc?.getElementById?.("btnMotionToggle");
    if (motionButton) {
      motionButton.setAttribute?.("aria-pressed", state.reducedMotion ? "true" : "false");
      motionButton.classList?.toggle?.("active", state.reducedMotion);
      motionButton.setAttribute?.(
        "aria-label",
        state.reducedMotion ? "Desativar movimento reduzido" : "Ativar movimento reduzido"
      );
      motionButton.setAttribute?.(
        "title",
        state.reducedMotion ? "Desativar movimento reduzido" : "Ativar movimento reduzido"
      );
    }

    try {
      this.onChange?.(state, reason);
    } catch (error) {
      if (typeof console !== "undefined") console.error("[OfficeScenePreferences] onChange falhou:", error);
    }
    return state;
  }

  dispose() {
    for (const [target, type, handler] of this._listeners) {
      target?.removeEventListener?.(type, handler);
    }
    this._listeners = [];
    this.mediaQuery?.removeEventListener?.("change", this._boundMedia);
    this.mediaQuery?.removeListener?.(this._boundMedia);
    this.mediaQuery = null;
  }

  /** @private */
  _bindMedia() {
    try {
      this.mediaQuery = this.win?.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
      this.mediaQuery?.addEventListener?.("change", this._boundMedia);
      if (!this.mediaQuery?.addEventListener) this.mediaQuery?.addListener?.(this._boundMedia);
    } catch (_) {
      this.mediaQuery = null;
    }
  }

  /** @private */
  _onMediaChange() {
    this.systemReducedMotion = Boolean(this.mediaQuery?.matches);
    this.apply("system-motion");
    this.announce(
      this.systemReducedMotion
        ? "O sistema solicitou movimento reduzido."
        : "O sistema liberou animações."
    );
  }

  /** @private */
  _bindControls() {
    const select = this.doc?.getElementById?.("officeQualitySelect");
    if (select) {
      const handler = (event) => this.setQuality(/** @type {any} */ (event.target)?.value);
      select.addEventListener?.("change", handler);
      this._listeners.push([select, "change", handler]);
    }

    const motionButton = this.doc?.getElementById?.("btnMotionToggle");
    if (motionButton) {
      const handler = () => this.toggleReducedMotion();
      motionButton.addEventListener?.("click", handler);
      this._listeners.push([motionButton, "click", handler]);
    }
  }
}
