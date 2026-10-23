// @ts-check
// Espelho no cliente do registro de telas do servidor (EP-14.04) e leitura das
// chaves antigas do localStorage para a primeira carga do estado (EP-14.06).

const TELAS = {
  chats: {
    escopo: "projeto",
    migraDe: [
      "harness_chats_view_mode",
      "harness_chats_page_size",
      "harness_chat_draft_*",
      "harness_groups_*",
      "harness_chat_engine_settings",
    ],
    regras: [
      { padrao: "harness_chats_view_mode", campo: "viewMode", ler: "texto" },
      { padrao: "harness_chats_page_size", campo: "pageSize", ler: "inteiro" },
      { padrao: "harness_chat_draft_*", campo: "draft", ler: "texto" },
      { padrao: "harness_groups_*", campo: "groups", ler: "json" },
      { padrao: "harness_chat_engine_settings", campo: "engineFilter", ler: "motor" },
      { padrao: "harness_chat_engine_settings", campo: "engineSettings", ler: "engineSettings" },
    ],
  },
  studio: {
    escopo: "projeto",
    migraDe: [
      "harness_studio_sidebar_width",
      "harness_studio_sidebar_width_*",
      "harness_studio_source_open",
      "harness_studio_source_width",
      "harness_studio_active_view",
      "harness_studio_active_view_*",
    ],
    regras: [
      { padrao: "harness_studio_sidebar_width", campo: "sidebarWidth", ler: "inteiro", sufixo: true },
      { padrao: "harness_studio_sidebar_width_*", campo: "sidebarWidth", ler: "inteiro" },
      { padrao: "harness_studio_source_open", campo: "sourceOpen", ler: "booleano", sufixo: true },
      { padrao: "harness_studio_source_width", campo: "sourceWidth", ler: "inteiro", sufixo: true },
      { padrao: "harness_studio_active_view", campo: "activeView", ler: "texto", sufixo: true },
      { padrao: "harness_studio_active_view_*", campo: "activeView", ler: "texto" },
    ],
  },
  prototypes: {
    escopo: "projeto",
    migraDe: [
      "harness.atelier.inspector",
      "harness_proto_workspace_layout",
      "harness.canvas.v1*",
    ],
    regras: [
      { padrao: "harness.atelier.inspector", campo: "inspector", ler: "booleano" },
      { padrao: "harness_proto_workspace_layout", campo: "workspaceLayout", ler: "json" },
      { padrao: "harness.canvas.v1*", campo: "canvas", ler: "json" },
    ],
  },
  scrum: { escopo: "projeto", migraDe: [], regras: [] },
  layers: { escopo: "projeto", migraDe: [], regras: [] },
  board: { escopo: "projeto", migraDe: [], regras: [] },
  audit: { escopo: "projeto", migraDe: [], regras: [] },
  artifacts: { escopo: "projeto", migraDe: [], regras: [] },
  routines: { escopo: "projeto", migraDe: [], regras: [] },
  overview: { escopo: "global", migraDe: [], regras: [] },
  office: {
    escopo: "global",
    migraDe: [
      "dai_office_hud_hidden",
      "dai_mouse_sensitivity",
      "dai_office_scene_preferences",
      "dai_office_view_mode:*",
      "dai:wm:layout:*",
      "dai:wm:state:*",
      "dai:wm:workspaces:*",
    ],
    regras: [
      { padrao: "dai_office_hud_hidden", campo: "hudHidden", ler: "booleano" },
      { padrao: "dai_mouse_sensitivity", campo: "mouseSensitivity", ler: "inteiro" },
      { padrao: "dai_office_scene_preferences", campo: "scenePreferences", ler: "json" },
      { padrao: "dai_office_view_mode:*", campo: "viewMode", ler: "json" },
      { padrao: "dai:wm:layout:*", campo: "windowLayout", ler: "json" },
      { padrao: "dai:wm:state:*", campo: "windowState", ler: "json" },
      { padrao: "dai:wm:workspaces:*", campo: "workspaces", ler: "json" },
    ],
  },
  deploy: {
    escopo: "projeto",
    migraDe: ["harness_deploy_config", "harness_deploy_history"],
    regras: [
      { padrao: "harness_deploy_config", campo: "config", ler: "json" },
      { padrao: "harness_deploy_history", campo: "history", ler: "json" },
    ],
  },
  diario: { escopo: "global", migraDe: [], regras: [] },
};

export const SCREEN_SCOPES = Object.freeze(
  Object.fromEntries(Object.entries(TELAS).map(([id, tela]) => [id, tela.escopo]))
);

export const SCREEN_MIGRATIONS = Object.freeze(
  Object.fromEntries(
    Object.entries(TELAS).map(([id, tela]) => [id, Object.freeze([...tela.migraDe])])
  )
);

const REGRAS = Object.freeze(
  Object.fromEntries(
    Object.entries(TELAS).map(([id, tela]) => [id, Object.freeze([...tela.regras])])
  )
);

/** @param {string} id */
export function isKnownScreen(id) {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(TELAS, id);
}

/** @param {string} id */
export function screenScope(id) {
  return isKnownScreen(id) ? TELAS[id].escopo : "";
}

/** @param {string} padrao @param {string} chave */
export function matchesPattern(padrao, chave) {
  const escaped = padrao.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(chave);
}

/** @param {any} storage @returns {string[]} */
export function listStorageKeys(storage) {
  if (!storage) return [];
  if (typeof storage.key === "function" && typeof storage.length === "number") {
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (typeof key === "string") keys.push(key);
    }
    return keys;
  }
  if (typeof storage.keys === "function") return [...storage.keys()];
  return [];
}

/** @param {string} raw @param {string} tipo */
function parseValue(raw, tipo) {
  switch (tipo) {
    case "texto":
      return raw;
    case "inteiro": {
      const value = Number.parseInt(raw, 10);
      return Number.isFinite(value) ? value : undefined;
    }
    case "booleano": {
      const value = raw.trim().toLowerCase();
      if (["1", "true", "on", "yes", "sim", "ligado"].includes(value)) return true;
      if (["0", "false", "off", "no", "nao", "não", "desligado"].includes(value)) return false;
      return undefined;
    }
    case "json": {
      try {
        return JSON.parse(raw);
      } catch {
        return undefined;
      }
    }
    case "motor": {
      try {
        const parsed = JSON.parse(raw);
        const motor = parsed?.currentEngine;
        return typeof motor === "string" && motor.trim() ? motor.trim() : undefined;
      } catch {
        return undefined;
      }
    }
    case "engineSettings": {
      try {
        const parsed = JSON.parse(raw);
        const settings = parsed?.engineSettings;
        return settings && typeof settings === "object" && !Array.isArray(settings) ? settings : undefined;
      } catch {
        return undefined;
      }
    }
    default:
      return undefined;
  }
}

/** @param {string} padrao @param {string} chave @param {string} projeto */
function sufixoDoProjeto(padrao, chave, projeto) {
  if (!padrao.includes("*")) return true;
  if (!projeto) return true;
  const prefixo = padrao.slice(0, padrao.indexOf("*"));
  const sufixo = chave.slice(prefixo.length);
  return (
    sufixo === projeto ||
    sufixo === `_${projeto}` ||
    sufixo === `:${projeto}` ||
    sufixo === `.${projeto}` ||
    sufixo.startsWith(`${projeto}.`) ||
    sufixo.startsWith(`${projeto}:`) ||
    sufixo.startsWith(`.${projeto}.`)
  );
}

/**
 * Lê as chaves antigas de uma tela e devolve o estado parcial reconhecido mais
 * as chaves que podem ser removidas depois que o estado for persistido.
 * @param {string} id
 * @param {{ storage?: any, project?: string }} [options]
 */
export function readLegacyScreenState(id, options = {}) {
  const tela = isKnownScreen(id) ? TELAS[id] : null;
  if (!tela) return { state: {}, keys: [] };

  const storage = options.storage;
  const projeto = typeof options.project === "string" ? options.project.trim() : "";
  if (!storage) return { state: {}, keys: [] };

  const existentes = listStorageKeys(storage);
  /** @type {Record<string, unknown>} */
  const state = {};
  /** @type {string[]} */
  const keys = [];

  for (const regra of tela.regras) {
    const candidatos = [];

    if (regra.sufixo && projeto) {
      candidatos.push(`${regra.padrao}_${projeto}`, `${regra.padrao}:${projeto}`);
    }
    if (regra.padrao.includes("*")) {
      const doProjeto = existentes.filter(
        (chave) => matchesPattern(regra.padrao, chave) && sufixoDoProjeto(regra.padrao, chave, tela.escopo === "projeto" ? projeto : "")
      );
      const exatos = doProjeto.filter((chave) => chave.endsWith(`_${projeto}`) || chave.endsWith(`:${projeto}`));
      candidatos.push(...exatos, ...doProjeto.filter((chave) => !exatos.includes(chave)));
    } else {
      candidatos.push(regra.padrao);
    }

    for (const chave of new Set(candidatos)) {
      let raw = null;
      try {
        raw = storage.getItem(chave);
      } catch {
        raw = null;
      }
      if (raw === null || raw === undefined) continue;
      if (!keys.includes(chave)) keys.push(chave);
      if (Object.prototype.hasOwnProperty.call(state, regra.campo)) continue;
      const valor = parseValue(String(raw), regra.ler);
      if (valor !== undefined) state[regra.campo] = valor;
    }
  }

  return { state, keys };
}

/** @param {string[]} keys @param {any} storage */
export function removeLegacyKeys(keys, storage) {
  if (!storage || !Array.isArray(keys)) return 0;
  let removidas = 0;
  for (const chave of keys) {
    try {
      if (typeof storage.getItem === "function" && storage.getItem(chave) === null) continue;
      storage.removeItem(chave);
      removidas += 1;
    } catch {}
  }
  return removidas;
}
