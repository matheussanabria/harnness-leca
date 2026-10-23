// @ts-check
// Estado compartilhado do chat (mutável, importado pelos módulos chat-*).
import { getScreenStateClient } from "../shared/screen-state.js";

export const ENGINES = {
  claude: { icon: '<i class="fa-solid fa-asterisk"></i>', name: "Claude Code", color: "#d97757" },
  gemini: { icon: '<i class="fa-solid fa-bolt"></i>', name: "Gemini", color: "#7ca5f5" },
  opencode: { icon: '<i class="fa-solid fa-code"></i>', name: "OpenCode", color: "#7de2a3" },
  codex: { icon: '<i class="fa-solid fa-terminal"></i>', name: "Codex", color: "#10a37f" },
  ollama: { icon: '<i class="fa-solid fa-microchip"></i>', name: "Ollama Local", color: "#e06c75" },
};

export const cs = {
  currentEngine: "claude",
  compareSelectedEngines: ["claude", "gemini"],
  engineSessions: { claude: null, opencode: null, gemini: null, codex: null, ollama: null },
  engineSettings: {
    claude: { model: null, effort: "medium" },
    opencode: { model: null, effort: "medium" },
    gemini: { model: null, effort: "medium" },
    codex: { model: null, effort: "medium" },
    ollama: { model: null, effort: "medium" },
  },
  enginesMeta: {},
  isMiniChatDismissed: false,
  chatSaveDebounceTimer: null,
  currentChatFile: null,
  currentChatTitle: null,
  activeDaiAgent: "",
  daiData: { available: false, agents: [], workflows: [] },
  continueChatFilter: "all",
  miniChatOrigin: "dialog",
};

let hydrated = false;

/** @param {unknown} saved */
export function applyEngineSettings(saved) {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return;
  const data = /** @type {Record<string, any>} */ (saved);
  if (typeof data.engineFilter === "string" && (data.engineFilter in cs.engineSettings || data.engineFilter === "compare")) {
    cs.currentEngine = data.engineFilter;
  } else if (typeof data.currentEngine === "string" && (data.currentEngine in cs.engineSettings || data.currentEngine === "compare")) {
    cs.currentEngine = data.currentEngine;
  }
  const settings = data.engineSettings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return;
  for (const [engine, value] of Object.entries(settings)) {
    if (!cs.engineSettings[engine] || !value || typeof value !== "object") continue;
    const entry = /** @type {Record<string, any>} */ (value);
    cs.engineSettings[engine] = {
      model: typeof entry.model === "string" ? entry.model : cs.engineSettings[engine].model,
      effort: typeof entry.effort === "string" ? entry.effort : cs.engineSettings[engine].effort,
    };
  }
}

/** Hidrata motor, modelo e esforço a partir do estado da tela de conversas. */
export async function hydrateEngineSettings(options = {}) {
  if (hydrated && !options.client) return;
  const client = options.client || getScreenStateClient();
  try {
    applyEngineSettings(await client.loadScreen("chats"));
    hydrated = true;
  } catch {}
}

/** Persiste motor, modelo e esforço no estado da tela para sobreviver a recargas. */
export function saveEngineSettings(options = {}) {
  try {
    const client = options.client || getScreenStateClient();
    void client.patchScreen("chats", {
      engineFilter: cs.currentEngine,
      engineSettings: cs.engineSettings,
    });
  } catch {}
}
