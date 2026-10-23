// @ts-check
// Registro canônico das telas com estado próprio (EP-14.04).
// Somente dados e regras puras: sem I/O, sem acesso a projects/ e sem DOM.

const MAX_STATE_BYTES = 64 * 1024;
const TIPOS = Object.freeze(["string", "number", "boolean", "array", "object"]);

const texto = (limite) => ({ tipo: "string", limite });
const inteiro = (limite, minimo = 1) => ({ tipo: "number", limite, minimo });
const booleano = () => ({ tipo: "boolean", limite: 1 });
const lista = (limite) => ({ tipo: "array", limite });
const objeto = (limite) => ({ tipo: "object", limite });

class ScreenStateError extends Error {
  /**
   * @param {string} message
   * @param {"UNKNOWN_SCREEN"|"INVALID_STATE"|"STATE_TOO_LARGE"} code
   */
  constructor(message, code) {
    super(message);
    this.name = "ScreenStateError";
    this.code = code;
  }
}

/**
 * @param {string} id @param {string} titulo @param {"projeto"|"global"} escopo
 * @param {string} rota @param {string} icone
 * @param {Record<string, { tipo: string, limite?: number, minimo?: number }>} campos
 * @param {string[]} [migraDe]
 */
function tela(id, titulo, escopo, rota, icone, campos, migraDe = []) {
  return { id, titulo, escopo, rota, icone, campos, migraDe };
}

const SCREENS = [
  tela("chats", "Conversas", "projeto", "/?p=<slug>", "fa-comments", {
    viewMode: texto(16), pageSize: inteiro(100), page: inteiro(100000), engineFilter: texto(32),
    groupFilter: texto(120), subgroupFilter: texto(120), searchQuery: texto(200),
    sortField: texto(32), sortAsc: booleano(), draft: texto(20000),
    groups: lista(200), assignments: objeto(60000),
  }, [
    "harness_chats_view_mode", "harness_chats_page_size", "harness_chat_draft_*",
    "harness_groups_*", "harness_chat_engine_settings",
  ]),
  tela("studio", "Studio", "projeto", "/?p=<slug>&studio=1", "fa-columns", {
    activeView: texto(32), sidebarWidth: inteiro(720, 160), sourceOpen: booleano(),
    sourceWidth: inteiro(720, 160), viewport: texto(16), route: texto(300),
    dockMaximized: booleano(), activePrototype: texto(120), activeScreen: texto(120),
  }, [
    "harness_studio_sidebar_width", "harness_studio_sidebar_width_*",
    "harness_studio_source_open", "harness_studio_source_width",
    "harness_studio_active_view", "harness_studio_active_view_*",
  ]),
  tela("prototypes", "Ateliê de Protótipos", "projeto", "/?p=<slug>&view=atelier", "fa-object-group", {
    activePrototype: texto(120), activeScreen: texto(120), selectedNode: texto(120),
    inspector: booleano(), workspaceLayout: objeto(8192), canvas: objeto(32768),
    viewport: texto(16),
  }, [
    "harness.atelier.inspector", "harness_proto_workspace_layout", "harness.canvas.v1*",
  ]),
  tela("scrum", "Scrum", "projeto", "/?p=<slug>&view=scrum", "fa-list-check", {
    sprint: texto(120), filter: texto(120), selectedStory: texto(120),
    tab: texto(32), sortField: texto(32), sortAsc: booleano(),
  }),
  tela("layers", "Mapa em Camadas", "projeto", "/?p=<slug>&view=layers", "fa-layer-group", {
    componentFilter: texto(120), selectedLayer: texto(120), tab: texto(32),
    expanded: lista(500), zoom: inteiro(200, 25),
  }),
  tela("board", "Quadro", "projeto", "/?p=<slug>&view=board", "fa-table-columns", {
    sprint: texto(120), filter: texto(120), selectedCard: texto(120),
    groupBy: texto(32), zoom: inteiro(200, 25),
  }),
  tela("audit", "Auditoria", "projeto", "/?p=<slug>&view=audit", "fa-clipboard-check", {
    componentFilter: texto(120), matrixFilter: texto(120),
    selectedComponent: texto(120), tab: texto(32), severity: texto(16),
  }),
  tela("artifacts", "Artefatos", "projeto", "/?p=<slug>&view=artifacts", "fa-box-archive", {
    kindFilter: texto(32), accessFilter: texto(16), query: texto(200),
    selectedKey: texto(200), sortField: texto(32), sortAsc: booleano(),
  }),
  tela("routines", "Rotinas", "projeto", "/?p=<slug>&view=routines", "fa-clock-rotate-left", {
    filter: texto(120), selectedRoutine: texto(120),
    approvalFilter: texto(32), tab: texto(32),
  }),
  tela("overview", "Visão Geral", "global", "/overview", "fa-gauge-high", {
    query: texto(200), sortField: texto(32), sortAsc: booleano(),
    page: inteiro(100000), pageSize: inteiro(100),
  }),
  tela("office", "Escritório Virtual", "global", "/office", "fa-building", {
    hudHidden: booleano(), mouseSensitivity: inteiro(10), scenePreferences: objeto(8192),
    viewMode: objeto(4096), windowLayout: objeto(16384),
    windowState: objeto(16384), workspaces: objeto(32768),
  }, [
    "dai_office_hud_hidden", "dai_mouse_sensitivity", "dai_office_scene_preferences",
    "dai_office_view_mode:*", "dai:wm:layout:*", "dai:wm:state:*", "dai:wm:workspaces:*",
  ]),
  tela("deploy", "Deploy", "projeto", "/?p=<slug>&view=deploy", "fa-rocket", {
    environment: texto(120), pipeline: texto(120), config: objeto(16384),
    history: lista(50), selectedRun: texto(120), tab: texto(32),
  }, [
    "harness_deploy_config", "harness_deploy_history",
  ]),
  tela("diario", "Diário", "global", "/diario", "fa-book", {
    query: texto(200), agentFilter: texto(32), sortField: texto(32),
    sortAsc: booleano(), page: inteiro(100000), pageSize: inteiro(100),
  }),
];

// Chaves de localStorage que não são estado de tela e por isso não migram.
const EXCLUSOES = Object.freeze([
  Object.freeze({ chave: "harness_pin", motivo: "Credencial do acesso remoto; não é estado de tela e não deve ir para o servidor." }),
  Object.freeze({ chave: "harness_active_project", motivo: "Seleção de projeto anterior a qualquer tela; permanece como reserva offline compartilhada." }),
  Object.freeze({ chave: "harness_chat_open", motivo: "Sinal efêmero da mini conversa, apenas removido; não guarda estado a restaurar." }),
  Object.freeze({ chave: "harness_active_chat_*", motivo: "Conteúdo da conversa em andamento; volumoso demais para o limite de 64 KB do estado de tela, permanece no localStorage." }),
  Object.freeze({ chave: "hia_tokens_saved", motivo: "Contador local de telemetria HIA; não é estado de tela." }),
]);

for (const entry of SCREENS) {
  Object.freeze(entry.campos);
  Object.freeze(entry.migraDe);
  Object.freeze(entry);
}
Object.freeze(SCREENS);

const BY_ID = new Map(SCREENS.map((entry) => [entry.id, entry]));

/** @param {string} id */
function getScreen(id) {
  return BY_ID.get(id) || null;
}

/** @param {string} id */
function isScreenId(id) {
  return BY_ID.has(id);
}

function listScreens() {
  return SCREENS.map((entry) => entry.id);
}

/** Catálogo serializável para `GET /api/screens` (EP-14.05). */
function getScreenCatalog() {
  return SCREENS.map((entry) => ({
    id: entry.id,
    titulo: entry.titulo,
    escopo: entry.escopo,
    rota: entry.rota,
    icone: entry.icone,
    campos: entry.campos,
    migraDe: entry.migraDe,
  }));
}

/** @param {string} pattern @param {string} key */
function matchesPattern(pattern, key) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(key);
}

/**
 * Verdadeiro quando a chave antiga do localStorage está em `migraDe` de
 * alguma tela ou na lista justificada de exclusões.
 * @param {string} key
 */
function isStorageKeyCovered(key) {
  if (EXCLUSOES.some((entry) => matchesPattern(entry.chave, key))) return true;
  return SCREENS.some((entry) => entry.migraDe.some((pattern) => matchesPattern(pattern, key)));
}

/** @param {unknown} value */
function stateBytes(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return Infinity;
  }
}

const INVALID = Symbol("invalid");

/** Copia somente JSON puro, descartando protótipos e referências circulares. */
function cloneJson(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return INVALID;
  }
}

/** @param {unknown} value @param {{ tipo: string, limite?: number, minimo?: number }} rule */
function sanitizeField(value, rule) {
  switch (rule.tipo) {
    case "string":
      return typeof value === "string" && value.length <= (rule.limite || 0) ? value : INVALID;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) return INVALID;
      if (rule.minimo !== undefined && value < rule.minimo) return INVALID;
      if (rule.limite !== undefined && value > rule.limite) return INVALID;
      return value;
    case "boolean":
      return typeof value === "boolean" ? value : INVALID;
    case "array":
      return Array.isArray(value) && value.length <= (rule.limite || 0) ? cloneJson(value) : INVALID;
    case "object": {
      if (!value || typeof value !== "object" || Array.isArray(value)) return INVALID;
      return stateBytes(value) <= (rule.limite || 0) ? cloneJson(value) : INVALID;
    }
    default:
      return INVALID;
  }
}

/**
 * Descarta campos fora do esquema, valores com tipo/limite inválidos e
 * rejeita o resultado acima de 64 KB.
 * @param {string} screenId @param {unknown} state
 * @returns {Record<string, unknown>}
 */
function sanitizeState(screenId, state) {
  const entry = getScreen(screenId);
  if (!entry) {
    throw new ScreenStateError(`Tela desconhecida: ${screenId}`, "UNKNOWN_SCREEN");
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new ScreenStateError(`Estado inválido para a tela ${screenId}`, "INVALID_STATE");
  }

  /** @type {Record<string, unknown>} */
  const sanitized = {};
  for (const [name, rule] of Object.entries(entry.campos)) {
    if (!Object.prototype.hasOwnProperty.call(state, name)) continue;
    const value = sanitizeField(/** @type {Record<string, unknown>} */ (state)[name], rule);
    if (value !== INVALID) sanitized[name] = value;
  }

  if (stateBytes(sanitized) > MAX_STATE_BYTES) {
    throw new ScreenStateError(`Estado acima de ${MAX_STATE_BYTES} bytes`, "STATE_TOO_LARGE");
  }
  return sanitized;
}

/** @param {string} screenId @param {unknown} state */
function serializeState(screenId, state) {
  return JSON.stringify(sanitizeState(screenId, state));
}

module.exports = {
  MAX_STATE_BYTES,
  TIPOS,
  SCREENS,
  EXCLUSOES,
  ScreenStateError,
  getScreen,
  isScreenId,
  listScreens,
  getScreenCatalog,
  isStorageKeyCovered,
  matchesPattern,
  sanitizeState,
  serializeState,
  stateBytes,
};
