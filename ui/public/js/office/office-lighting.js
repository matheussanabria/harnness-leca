// @ts-check
/**
 * Gerenciador observável da iluminação funcional do escritório (EP-03.06).
 * Responsabilidade única: resolver o modo, guardar o preset vigente e
 * notificar os alvos de apresentação (rig 3D e camada DOM 2.5D).
 */
import {
  LIGHTING_MODES,
  cssVarsForPreset,
  resolveLightingMode,
  resolveLightingPreset
} from "./lighting-presets.js";

/**
 * @typedef {Object} LightingTarget
 * @property {(preset: import("./lighting-presets.js").LightingPreset) => void} apply
 * @property {() => void} [reset]
 */

export class OfficeLightingManager {
  /**
   * @param {{ initialMode?: string }} [options]
   */
  constructor(options = {}) {
    /** @type {Set<LightingTarget>} */
    this._targets = new Set();
    /** @type {Set<(snapshot: any) => void>} */
    this._listeners = new Set();
    /** @type {string} */
    this._mode = LIGHTING_MODES.includes(options.initialMode) ? options.initialMode : "idle";
    this._reason = "init";
  }

  /** @returns {string} */
  getMode() {
    return this._mode;
  }

  /** @returns {import("./lighting-presets.js").LightingPreset} */
  getPreset() {
    return resolveLightingPreset(this._mode);
  }

  /** @returns {{ mode: string, presetId: string, label: string, reason: string, css: Record<string, string> }} */
  getSnapshot() {
    const preset = this.getPreset();
    return {
      mode: this._mode,
      presetId: preset.id,
      label: preset.label,
      reason: this._reason,
      css: cssVarsForPreset(preset)
    };
  }

  /**
   * Define o modo vigente. Modos desconhecidos são ignorados.
   * @param {string} mode
   * @param {{ reason?: string }} [options]
   * @returns {boolean} `true` quando houve mudança efetiva
   */
  setMode(mode, options = {}) {
    if (!LIGHTING_MODES.includes(mode)) return false;
    const changed = mode !== this._mode;
    this._mode = mode;
    this._reason = options.reason || "manual";
    this._apply();
    if (changed) this._notify();
    return changed;
  }

  /**
   * Recalcula o modo a partir dos estados reais dos agentes.
   * @param {Record<string, { status?: string }>} [states]
   * @returns {string} modo resultante
   */
  refreshFromAgents(states = {}) {
    const mode = resolveLightingMode(states);
    this.setMode(mode, { reason: "agents" });
    return this._mode;
  }

  /**
   * Registra um alvo de apresentação e aplica o preset vigente.
   * @param {LightingTarget} target
   * @returns {() => void} desinscrição
   */
  attach(target) {
    if (!target || typeof target.apply !== "function") {
      throw new TypeError("Alvo de iluminação precisa implementar apply(preset)");
    }
    this._targets.add(target);
    target.apply(this.getPreset());
    return () => {
      this._targets.delete(target);
    };
  }

  /**
   * @param {(snapshot: any) => void} listener
   * @returns {() => void}
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /** Volta ao modo ocioso e reaplica nos alvos. */
  reset() {
    this._mode = "idle";
    this._reason = "reset";
    this._apply();
    this._notify();
  }

  /** @private */
  _apply() {
    const preset = this.getPreset();
    for (const target of this._targets) {
      try {
        target.apply(preset);
      } catch (error) {
        console.error("[OfficeLighting] Falha ao aplicar preset:", error);
      }
    }
  }

  /** @private */
  _notify() {
    const snapshot = this.getSnapshot();
    for (const listener of this._listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error("[OfficeLighting] Falha ao notificar ouvinte:", error);
      }
    }
  }
}

export const officeLighting = new OfficeLightingManager();
