// @ts-check
// Estado compartilhado do chat (mutável, importado pelos módulos chat-*).

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

const ENGINE_SETTINGS_KEY = "harness_chat_engine_settings";

function loadEngineSettings() {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(ENGINE_SETTINGS_KEY) || "null");
    if (!saved || typeof saved !== "object") return;
    if (typeof saved.currentEngine === "string") cs.currentEngine = saved.currentEngine;
    for (const [engine, settings] of Object.entries(saved.engineSettings || {})) {
      if (!cs.engineSettings[engine] || !settings || typeof settings !== "object") continue;
      cs.engineSettings[engine] = { ...cs.engineSettings[engine], ...settings };
    }
  } catch {}
}

/** Persiste motor, modelo e esforço para sobreviver a recargas e re-renders do Ateliê. */
export function saveEngineSettings() {
  try {
    globalThis.localStorage?.setItem(
      ENGINE_SETTINGS_KEY,
      JSON.stringify({ currentEngine: cs.currentEngine, engineSettings: cs.engineSettings }),
    );
  } catch {}
}

loadEngineSettings();
