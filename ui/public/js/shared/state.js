// @ts-check

/**
 * Estado reativo compartilhado do Harness Leca Frontend.
 */
import { createScreenStateClient } from "./screen-state.js";

export const CHATS_SCREEN = "chats";
export const CHAT_ACTIONS = Object.freeze({
  PROJECT: "troca de projeto",
  OPEN_CHAT: "abertura de chat",
  GROUP: "mudança de grupo",
});

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
  chatViewMode: "table",
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
  currentChatTitle: null,
  /** Chat scope inside the project: "" is the general chat; design views use "design:<view>". */
  chatScope: "",
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

/** @type {Record<string, any>} */
let chatScreen = {};
let hydratedProject = null;
/** @type {any} */
let injectedClient = null;
const projectClients = new Map();

/** @param {string} [slug] */
function currentProject(slug) {
  const value = slug || (state.P && state.P.slug) || hydratedProject || "";
  return typeof value === "string" ? value.trim() : "";
}

/** @param {string} [project] */
function chatClient(project) {
  if (injectedClient) return injectedClient;
  const key = project || "auto";
  if (!projectClients.has(key)) {
    projectClients.set(key, createScreenStateClient(project ? { project } : {}));
  }
  return projectClients.get(key);
}

/**
 * Substitui o cliente por um dublê nos testes; em produção usa o singleton
 * por projeto criado sob demanda.
 * @param {any} client
 */
export function setChatScreenStateClient(client) {
  injectedClient = client || null;
  hydratedProject = null;
  chatScreen = {};
}

/** @param {unknown} value */
function isText(value) {
  return typeof value === "string";
}

/** @param {Record<string, any>} loaded */
function applyChatScreenState(loaded) {
  if (!loaded || typeof loaded !== "object" || Array.isArray(loaded)) return;
  if (loaded.viewMode === "table" || loaded.viewMode === "list") state.chatViewMode = loaded.viewMode;
  if (Number.isInteger(loaded.pageSize) && loaded.pageSize > 0) state.chatPageSize = loaded.pageSize;
  if (Number.isInteger(loaded.page) && loaded.page > 0) state.chatCurrentPage = loaded.page;
  if (isText(loaded.engineFilter)) state.chatEngineFilter = loaded.engineFilter;
  if (isText(loaded.groupFilter)) state.chatGroupFilter = loaded.groupFilter;
  if (isText(loaded.subgroupFilter)) state.chatSubgroupFilter = loaded.subgroupFilter;
  if (isText(loaded.searchQuery)) state.chatSearchQuery = loaded.searchQuery;
  if (isText(loaded.sortField)) state.chatSortField = loaded.sortField;
  if (typeof loaded.sortAsc === "boolean") state.chatSortAsc = loaded.sortAsc;
}

/**
 * Hidrata a tela de conversas uma única vez por projeto e aplica o estado
 * persistido antes da primeira renderização.
 * @param {string} [slug]
 */
export async function hydrateChatState(slug) {
  const project = currentProject(slug);
  if (hydratedProject === project) return { ...chatScreen };
  const loaded = await chatClient(project).loadScreen(CHATS_SCREEN);
  chatScreen = { ...(loaded || {}) };
  applyChatScreenState(chatScreen);
  hydratedProject = project;
  return { ...chatScreen };
}

/**
 * Atualiza o cache, aplica os campos conhecidos e grava no cliente de estado
 * com debounce (a gravação local imediata é responsabilidade do cliente).
 * @param {Record<string, unknown>} partial
 */
export function persistChatScreenState(partial) {
  if (!partial || typeof partial !== "object" || Array.isArray(partial)) {
    return Promise.resolve({});
  }
  chatScreen = { ...chatScreen, ...partial };
  applyChatScreenState(partial);
  const result = chatClient(currentProject()).patchScreen(CHATS_SCREEN, partial);
  if (result && typeof result.catch === "function") result.catch(() => {});
  return result;
}

/** @param {string} acao @param {string} [alvo] */
export function logChatAction(acao, alvo = "") {
  return chatClient(currentProject()).logAction(CHATS_SCREEN, acao, alvo);
}

/** Cópia do estado bruto da tela de conversas (inclui grupos e rascunho). */
export function getChatScreenState() {
  return { ...chatScreen };
}

// O conteúdo da conversa em andamento fica no localStorage: é volumoso demais para o limite de 64 KB do estado de tela.
export function getActiveChatStorageKey(slug, scope = state.chatScope) {
  const base = "harness_active_chat_" + (slug || (state.P ? state.P.slug : "global"));
  return scope ? `${base}::${scope}` : base;
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
      currentChatTitle: state.currentChatTitle,
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
      if (data.currentChatTitle) state.currentChatTitle = data.currentChatTitle;
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

export function getChatDraft() {
  return typeof chatScreen.draft === "string" ? chatScreen.draft : "";
}

export function saveChatDraft(slug, text) {
  const value = text && text.trim() ? text : null;
  persistChatScreenState({ draft: value });
}

export function clearChatDraft() {
  persistChatScreenState({ draft: null });
}
