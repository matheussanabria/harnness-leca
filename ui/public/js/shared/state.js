// @ts-check

/**
 * Estado reativo compartilhado do Harness Leca Frontend.
 */

export const state = {
  // Dados do servidor
  S: null,
  P: null,

  // Filtros de conversas
  chatEngineFilter: "all", // 'all' | 'claude' | 'gemini' | 'opencode'
  chatGroupFilter: "all", // 'all' | '__none__' | groupId
  chatSubgroupFilter: "all", // 'all' | string
  chatSearchQuery: "",
  chatSortField: "mtime", // 'mtime' | 'title' | 'agent' | 'group' | 'status' | 'turns'
  chatSortAsc: false, // false = desc, true = asc
  chatViewMode: localStorage.getItem("harness_chats_view_mode") || "table",
  chatCurrentPage: 1,
  chatPageSize: 15,
  lastFilteredChatsCount: 0,

  // Grupos
  selectedGroupColor: "#d97757",
  editingGroupId: null,
  assigningChatName: null,

  // Chat Interativo
  currentEngine: "claude",
  engineModel: {
    claude: "default",
    gemini: "default",
    opencode: "default",
  },
  engineEffort: {
    claude: "medium",
    gemini: "medium",
  },
  chatTurns: [],
  chatAborts: {},
  selectedCompareEngines: new Set(["claude"]),
  compareMode: false,
  currentChatFile: null,
  chatSessionOrigin: null,
  chatSaveTimeout: null,
  enginesInfo: {},
  daiData: null,

  // Studio
  isStudioMode: false,
  studioModeType: "preview",
  studioCurrentRoute: "/",
  isStudioDockMaximized: false,
  studioViewport: "responsive",

  // Review
  reviewSuggestions: [],
  reviewCategories: [],
  reviewFilterCategory: "all",
  reviewSearchQuery: "",
  reviewCurrentPage: 1,
  reviewPageSize: 10,
};

try {
  const savedPageSize = localStorage.getItem("harness_chats_page_size");
  if (savedPageSize) {
    const parsed = parseInt(savedPageSize, 10);
    if (!isNaN(parsed) && parsed > 0) state.chatPageSize = parsed;
  }
} catch {}

export const GROUP_PALETTE = [
  { name: "Laranja Coral", hex: "#d97757" },
  { name: "Azul Gemini", hex: "#5c87f2" },
  { name: "Verde Esmeralda", hex: "#3cb371" },
  { name: "Roxo Real", hex: "#8b5cf6" },
  { name: "Âmbar Dourado", hex: "#e0a040" },
  { name: "Rosa Magenta", hex: "#ec4899" },
  { name: "Ciano Vivo", hex: "#06b6d4" },
  { name: "Grafite Neutro", hex: "#94a3b8" },
];

export function getActiveChatStorageKey(slug) {
  return "harness_active_chat_" + (slug || (state.P ? state.P.slug : "global"));
}

export function saveActiveChatState() {
  if (!state.P || !state.P.slug) return;
  const key = getActiveChatStorageKey(state.P.slug);
  try {
    if (state.chatTurns.length === 0) {
      localStorage.removeItem(key);
      return;
    }
    const data = {
      slug: state.P.slug,
      currentEngine: state.currentEngine,
      compareMode: state.compareMode,
      selectedCompareEngines: Array.from(state.selectedCompareEngines),
      currentChatFile: state.currentChatFile,
      chatSessionOrigin: state.chatSessionOrigin,
      chatTurns: state.chatTurns,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn("Não foi possível persistir rascunho de chat no localStorage:", err);
  }
}

export function restoreActiveChatState(slug) {
  const key = getActiveChatStorageKey(slug);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.chatTurns) && data.chatTurns.length > 0) {
      state.chatTurns = data.chatTurns;
      if (data.currentEngine) state.currentEngine = data.currentEngine;
      if (data.currentChatFile) state.currentChatFile = data.currentChatFile;
      if (data.chatSessionOrigin) state.chatSessionOrigin = data.chatSessionOrigin;
      if (typeof data.compareMode === "boolean") state.compareMode = data.compareMode;
      if (Array.isArray(data.selectedCompareEngines)) {
        state.selectedCompareEngines = new Set(data.selectedCompareEngines);
      }
      return data;
    }
  } catch (err) {
    console.warn("Erro ao restaurar rascunho de chat:", err);
  }
  return null;
}

export function clearActiveChatState(slug) {
  const key = getActiveChatStorageKey(slug);
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function getChatDraft(slug) {
  try {
    return localStorage.getItem("harness_chat_draft_" + (slug || (state.P ? state.P.slug : "global"))) || "";
  } catch {
    return "";
  }
}

export function saveChatDraft(slug, text) {
  try {
    const key = "harness_chat_draft_" + (slug || (state.P ? state.P.slug : "global"));
    if (text && text.trim()) {
      localStorage.setItem(key, text);
    } else {
      localStorage.removeItem(key);
    }
  } catch {}
}

export function clearChatDraft(slug) {
  try {
    localStorage.removeItem("harness_chat_draft_" + (slug || (state.P ? state.P.slug : "global")));
  } catch {}
}

