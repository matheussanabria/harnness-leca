// @ts-check
/**
 * DAI HQ — Modelo puro de preferências de renderização e movimento (EP-03.09).
 * Não conhece DOM, storage ou motores: recebe valores e devolve perfis estáveis.
 */

export const QUALITY_MODES = Object.freeze(["auto", "high", "balanced", "low"]);
export const QUALITY_LABELS = Object.freeze({
  auto: "Automática",
  high: "Alta",
  balanced: "Equilibrada",
  low: "Baixa"
});
export const PERFORMANCE_PROFILES = Object.freeze({
  high: Object.freeze({ id: "high", maxPixelRatio: 2, shadows: true }),
  balanced: Object.freeze({ id: "balanced", maxPixelRatio: 1.5, shadows: true }),
  low: Object.freeze({ id: "low", maxPixelRatio: 1, shadows: false })
});
export const SCENE_STORAGE_KEY = "dai_office_scene_preferences";

/** @param {unknown} value */
export function normalizeQuality(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return QUALITY_MODES.includes(normalized) ? normalized : "auto";
}

/**
 * @param {{ quality?: unknown, deviceMemory?: unknown, hardwareConcurrency?: unknown }} [input]
 * @returns {{ id: string, maxPixelRatio: number, shadows: boolean }}
 */
export function resolvePerformanceProfile(input = {}) {
  const quality = normalizeQuality(input.quality);
  if (quality !== "auto") return PERFORMANCE_PROFILES[quality];

  const memory = Number(input.deviceMemory);
  if (Number.isFinite(memory) && memory > 0 && memory <= 4) return PERFORMANCE_PROFILES.low;

  const cores = Number(input.hardwareConcurrency);
  if (Number.isFinite(cores) && cores > 0 && cores <= 4) return PERFORMANCE_PROFILES.balanced;

  return PERFORMANCE_PROFILES.high;
}

/**
 * @param {unknown} dpr
 * @param {unknown} maxPixelRatio
 * @returns {number}
 */
export function clampPixelRatio(dpr, maxPixelRatio = 2) {
  const ratio = Number(dpr);
  const limit = Number(maxPixelRatio);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 2;
  if (!Number.isFinite(ratio) || ratio <= 0) return 1;
  return Math.min(Math.max(ratio, 0.5), safeLimit);
}

/**
 * @param {{ getItem: Function, setItem: Function } | null | undefined} storage
 * @returns {{ quality: string, reducedMotion: boolean }}
 */
export function readScenePreferences(storage) {
  const fallback = { quality: "auto", reducedMotion: false };
  try {
    const raw = storage?.getItem?.(SCENE_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return fallback;
    return {
      quality: normalizeQuality(parsed.quality),
      reducedMotion: parsed.reducedMotion === true
    };
  } catch (_) {
    return fallback;
  }
}

/**
 * @param {{ setItem: Function } | null | undefined} storage
 * @param {{ quality?: unknown, reducedMotion?: unknown }} preferences
 * @returns {boolean}
 */
export function writeScenePreferences(storage, preferences = {}) {
  try {
    storage?.setItem?.(
      SCENE_STORAGE_KEY,
      JSON.stringify({
        quality: normalizeQuality(preferences.quality),
        reducedMotion: preferences.reducedMotion === true
      })
    );
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * @param {any} win
 * @returns {boolean}
 */
export function prefersReducedMotion(win) {
  try {
    return Boolean(win?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  } catch (_) {
    return false;
  }
}

/**
 * @param {{ quality?: unknown, reducedMotion?: unknown, systemReducedMotion?: unknown, deviceMemory?: unknown, hardwareConcurrency?: unknown }} [input]
 * @returns {{ quality: string, profile: { id: string, maxPixelRatio: number, shadows: boolean }, reducedMotion: boolean, systemReducedMotion: boolean }}
 */
export function resolveScenePreferences(input = {}) {
  const quality = normalizeQuality(input.quality);
  const systemReducedMotion = input.systemReducedMotion === true;
  return {
    quality,
    profile: resolvePerformanceProfile({
      quality,
      deviceMemory: input.deviceMemory,
      hardwareConcurrency: input.hardwareConcurrency
    }),
    reducedMotion: input.reducedMotion === true || systemReducedMotion,
    systemReducedMotion
  };
}
