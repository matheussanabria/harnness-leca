// @ts-check
/**
 * Alvo DOM da iluminação funcional (EP-03.06).
 * Escreve variáveis CSS e o atributo `data-office-lighting` para que a cena
 * 2.5D e o viewport 3D compartilhem o mesmo preset visual.
 */
import { cssVarsForPreset, resolveLightingPreset } from "./lighting-presets.js";

/**
 * @param {Document | { documentElement?: any } | null} [doc]
 * @returns {{ apply: (preset: any) => void, reset: () => void }}
 */
export function createLightingDomTarget(doc = typeof document !== "undefined" ? document : null) {
  const root = doc && doc.documentElement;
  if (!root || !root.style || typeof root.style.setProperty !== "function") {
    return { apply: () => {}, reset: () => {} };
  }

  /** @type {Set<string>} */
  const appliedVars = new Set();

  return {
    apply(preset) {
      const resolved = resolveLightingPreset(preset?.id);
      root.setAttribute("data-office-lighting", resolved.id);
      root.setAttribute("data-office-lighting-label", resolved.label);
      for (const [name, value] of Object.entries(cssVarsForPreset(resolved))) {
        root.style.setProperty(name, value);
        appliedVars.add(name);
      }
    },
    reset() {
      root.removeAttribute("data-office-lighting");
      root.removeAttribute("data-office-lighting-label");
      for (const name of appliedVars) {
        root.style.removeProperty(name);
      }
      appliedVars.clear();
    }
  };
}
