// @ts-check
/**
 * Presets canônicos da iluminação funcional do escritório (EP-03.06).
 * Dados puros: sem dependência de Three.js ou do DOM.
 */

/**
 * @typedef {Object} LightingPreset
 * @property {string} id
 * @property {string} label
 * @property {string} icon
 * @property {string} description
 * @property {Record<string, { color: number, intensity: number }>} lights
 * @property {Record<string, string>} css
 */

export const LIGHTING_MODES = Object.freeze([
  "idle",
  "active",
  "attention",
  "alert",
  "offline"
]);

/**
 * Deriva o modo de iluminação dos estados reais dos agentes.
 * Precedência: alert > attention > active > offline > idle.
 * @param {Record<string, { status?: string }>} [states]
 * @returns {string}
 */
export function resolveLightingMode(states = {}) {
  const list = Object.values(states || {});
  if (list.length === 0) return "idle";
  if (list.some((state) => state?.status === "error")) return "alert";
  if (list.some((state) => state?.status === "waiting_approval")) return "attention";
  if (list.some((state) => state?.status === "streaming" || state?.status === "thinking")) {
    return "active";
  }
  if (list.every((state) => state?.status === "offline")) return "offline";
  return "idle";
}

/** @type {Readonly<Record<string, LightingPreset>>} */
export const LIGHTING_PRESETS = Object.freeze({
  idle: {
    id: "idle",
    label: "Em espera",
    icon: "fa-solid fa-moon",
    description: "Cena neutra com o posto de trabalho em foco",
    lights: {
      ambient: { color: 0x1e293b, intensity: 1.2 },
      keyLight: { color: 0x38bdf8, intensity: 1.1 },
      desk: { color: 0xfff5ea, intensity: 2.4 },
      screen: { color: 0x00d2ff, intensity: 1.8 },
      corridor: { color: 0x00d2ff, intensity: 1.2 },
      warTable: { color: 0xfff8ee, intensity: 3.0 },
      warScreen: { color: 0x38bdf8, intensity: 2.4 }
    },
    css: {
      "--office-light-brightness": "0.96",
      "--office-light-contrast": "1.02",
      "--office-light-saturation": "0.95",
      "--office-light-overlay": "rgba(148, 163, 184, 0.10)",
      "--office-light-overlay-size": "70px"
    }
  },
  active: {
    id: "active",
    label: "Executando",
    icon: "fa-solid fa-bolt",
    description: "Execução em curso com luz de trabalho reforçada",
    lights: {
      ambient: { color: 0x1e293b, intensity: 1.5 },
      keyLight: { color: 0x38bdf8, intensity: 1.4 },
      desk: { color: 0xfff5ea, intensity: 3.1 },
      screen: { color: 0x2dd4bf, intensity: 2.4 },
      corridor: { color: 0x2dd4bf, intensity: 1.6 },
      warTable: { color: 0xfff8ee, intensity: 3.6 },
      warScreen: { color: 0x2dd4bf, intensity: 3.2 }
    },
    css: {
      "--office-light-brightness": "1.05",
      "--office-light-contrast": "1.05",
      "--office-light-saturation": "1.05",
      "--office-light-overlay": "rgba(16, 185, 129, 0.12)",
      "--office-light-overlay-size": "80px"
    }
  },
  attention: {
    id: "attention",
    label: "Aprovação",
    icon: "fa-solid fa-hand",
    description: "Aprovação humana pendente sinalizada em âmbar",
    lights: {
      ambient: { color: 0x1e293b, intensity: 1.3 },
      keyLight: { color: 0xf59e0b, intensity: 1.5 },
      desk: { color: 0xfff5ea, intensity: 2.6 },
      screen: { color: 0xf59e0b, intensity: 2.2 },
      corridor: { color: 0xf59e0b, intensity: 1.4 },
      warTable: { color: 0xfff8ee, intensity: 3.2 },
      warScreen: { color: 0xf59e0b, intensity: 3.0 }
    },
    css: {
      "--office-light-brightness": "1.02",
      "--office-light-contrast": "1.06",
      "--office-light-saturation": "1.02",
      "--office-light-overlay": "rgba(245, 158, 11, 0.18)",
      "--office-light-overlay-size": "90px"
    }
  },
  alert: {
    id: "alert",
    label: "Erro",
    icon: "fa-solid fa-triangle-exclamation",
    description: "Falha ativa com realce vermelho na cena",
    lights: {
      ambient: { color: 0x1e293b, intensity: 1.0 },
      keyLight: { color: 0xef4444, intensity: 1.6 },
      desk: { color: 0xffe4e6, intensity: 2.2 },
      screen: { color: 0xef4444, intensity: 2.4 },
      corridor: { color: 0xef4444, intensity: 1.5 },
      warTable: { color: 0xffe4e6, intensity: 2.8 },
      warScreen: { color: 0xef4444, intensity: 3.0 }
    },
    css: {
      "--office-light-brightness": "0.92",
      "--office-light-contrast": "1.12",
      "--office-light-saturation": "0.85",
      "--office-light-overlay": "rgba(239, 68, 68, 0.22)",
      "--office-light-overlay-size": "110px"
    }
  },
  offline: {
    id: "offline",
    label: "Offline",
    icon: "fa-solid fa-power-off",
    description: "Todos os motores desconectados e cena em repouso",
    lights: {
      ambient: { color: 0x0f172a, intensity: 0.7 },
      keyLight: { color: 0x1e293b, intensity: 0.6 },
      desk: { color: 0x94a3b8, intensity: 0.8 },
      screen: { color: 0x1e293b, intensity: 0.5 },
      corridor: { color: 0x1e293b, intensity: 0.5 },
      warTable: { color: 0x94a3b8, intensity: 0.9 },
      warScreen: { color: 0x1e293b, intensity: 0.4 }
    },
    css: {
      "--office-light-brightness": "0.72",
      "--office-light-contrast": "1.05",
      "--office-light-saturation": "0.60",
      "--office-light-overlay": "rgba(15, 23, 42, 0.45)",
      "--office-light-overlay-size": "120px"
    }
  }
});

/**
 * Resolve o preset de um modo, caindo em `idle` quando desconhecido.
 * @param {string} [mode]
 * @returns {LightingPreset}
 */
export function resolveLightingPreset(mode) {
  return LIGHTING_PRESETS[mode] || LIGHTING_PRESETS.idle;
}

/**
 * Converte o preset em variáveis CSS prontas para aplicação.
 * @param {LightingPreset} preset
 * @returns {Record<string, string>}
 */
export function cssVarsForPreset(preset) {
  return { ...resolveLightingPreset(preset?.id).css };
}
