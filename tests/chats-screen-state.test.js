// Regressao do EP-14.07: adocao do estado das telas em conversas, grupos e projetos.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_JS = path.join(ROOT, "ui", "public", "js");
const moduleUrl = (relative) => pathToFileURL(path.join(PUBLIC_JS, relative)).href;
const stateUrl = moduleUrl("shared/state.js");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class FakeClient {
  constructor(initial = {}) {
    this.saved = clone(initial);
    this.loads = 0;
    this.patches = [];
    this.actions = [];
  }

  async loadScreen(id) {
    assert.equal(id, "chats");
    this.loads += 1;
    return clone(this.saved);
  }

  async patchScreen(id, patch) {
    assert.equal(id, "chats");
    this.patches.push(clone(patch));
    this.saved = { ...this.saved, ...clone(patch) };
    return clone(this.saved);
  }

  async logAction(id, acao, alvo) {
    assert.equal(id, "chats");
    this.actions.push({ acao, alvo });
    return true;
  }
}

function createDocument() {
  const element = () => ({
    style: {},
    classList: { toggle() {}, add() {}, remove() {} },
    textContent: "",
    innerHTML: "",
    value: "",
    disabled: false,
    dataset: {},
    getBoundingClientRect: () => ({ top: 0 }),
    scrollIntoView() {},
    showModal() {},
    close() {},
  });
  return {
    getElementById: () => element(),
    querySelectorAll: () => [],
    querySelector: () => null,
    createElement: () => element(),
  };
}

const memoryStorage = new Map();
globalThis.localStorage = {
  getItem: (k) => (memoryStorage.has(k) ? memoryStorage.get(k) : null),
  setItem: (k, v) => memoryStorage.set(k, String(v)),
  removeItem: (k) => memoryStorage.delete(k),
};
globalThis.document = createDocument();
globalThis.$ = (id) => globalThis.document.getElementById(id);
globalThis.window = globalThis.window || {};
globalThis.window.renderProjectChats = globalThis.window.renderProjectChats || (() => {});

async function setup(initial = {}) {
  const mod = await import(stateUrl);
  const client = new FakeClient(initial);
  mod.setChatScreenStateClient(client);
  mod.state.S = { projects: ["demo"], active: "demo", global: { instructions: "", memory: "" } };
  mod.state.P = { slug: "demo", chats: [] };
  mod.state.chatTurns = [];
  return { mod, client };
}

test("EP-14.07: hidratacao restaura visao, filtros, pagina, rascunho e grupos", async () => {
  const { mod, client } = await setup({
    viewMode: "list",
    pageSize: 30,
    page: 4,
    engineFilter: "gemini",
    groupFilter: "grp_1",
    subgroupFilter: "Estudos",
    searchQuery: "memoria",
    sortField: "title",
    sortAsc: true,
    draft: "rascunho do projeto",
    groups: [{ id: "grp_1", name: "Pesquisa" }],
    assignments: { "a.md": { groupId: "grp_1", subgroup: "Estudos" } },
  });

  await mod.hydrateChatState("demo");

  assert.equal(mod.state.chatViewMode, "list");
  assert.equal(mod.state.chatPageSize, 30);
  assert.equal(mod.state.chatCurrentPage, 4);
  assert.equal(mod.state.chatEngineFilter, "gemini");
  assert.equal(mod.state.chatGroupFilter, "grp_1");
  assert.equal(mod.state.chatSubgroupFilter, "Estudos");
  assert.equal(mod.state.chatSearchQuery, "memoria");
  assert.equal(mod.state.chatSortField, "title");
  assert.equal(mod.state.chatSortAsc, true);
  assert.equal(mod.getChatDraft(), "rascunho do projeto");
  assert.deepEqual(mod.getChatScreenState().groups, [{ id: "grp_1", name: "Pesquisa" }]);

  await mod.hydrateChatState("demo");
  assert.equal(client.loads, 1, "a hidratacao e unica por projeto");
});

test("EP-14.07: visao, tamanho de pagina e filtros sao gravados no estado da tela", async () => {
  const { mod, client } = await setup();

  const actions = await import(moduleUrl("modules/projects-chat-actions.js"));
  actions.setChatViewMode("list");
  actions.changeChatPageSize("50");
  actions.onChatSearchInput("harness");
  actions.onChatSortSelectChange("title_asc");
  actions.setChatEngineFilter("opencode");

  assert.deepEqual(client.patches, [
    { viewMode: "list" },
    { pageSize: 50, page: 1 },
    { searchQuery: "harness", page: 1 },
    { sortField: "title", sortAsc: true, page: 1 },
    { engineFilter: "opencode", page: 1 },
  ]);
  assert.equal(mod.state.chatViewMode, "list");
  assert.equal(mod.state.chatPageSize, 50);
});

test("EP-14.07: trocar o filtro de grupo grava o estado e registra a acao", async () => {
  const { mod, client } = await setup();

  const actions = await import(moduleUrl("modules/projects-chat-actions.js"));
  actions.setChatGroupFilter("grp_2");

  assert.deepEqual(client.patches[0], {
    groupFilter: "grp_2",
    subgroupFilter: "all",
    page: 1,
  });
  assert.deepEqual(client.actions, [{ acao: mod.CHAT_ACTIONS.GROUP, alvo: "grp_2" }]);
});

test("EP-14.07: rascunho vai ao estado da tela e o chat ativo fica no localStorage", async () => {
  const { mod, client } = await setup();

  mod.saveChatDraft("demo", "texto pendente");
  assert.equal(mod.getChatDraft(), "texto pendente");
  assert.deepEqual(client.patches.at(-1), { draft: "texto pendente" });

  mod.clearChatDraft("demo");
  assert.equal(mod.getChatDraft(), "");
  assert.deepEqual(client.patches.at(-1), { draft: null });

  mod.state.chatTurns = [{ role: "user", text: "pergunta" }];
  mod.state.currentChatFile = "a.md";
  mod.saveActiveChatState();
  assert.equal(client.patches.some((patch) => "activeChat" in patch), false, "o conteudo da conversa nao vai ao servidor");
  const saved = JSON.parse(globalThis.localStorage.getItem(mod.getActiveChatStorageKey("demo")));
  assert.equal(saved.slug, "demo");
  assert.equal(saved.currentChatFile, "a.md");

  mod.state.chatTurns = [];
  assert.equal(mod.restoreActiveChatState("demo").chatTurns.length, 1);
  mod.clearActiveChatState("demo");
  assert.equal(mod.restoreActiveChatState("demo"), null);
});

test("EP-14.07: grupos sao lidos e gravados pelo estado da tela, sem localStorage", async () => {
  const { mod, client } = await setup({
    groups: [{ id: "grp_1", name: "Pesquisa" }],
    assignments: { "a.md": { groupId: "grp_1" } },
  });
  await mod.hydrateChatState("demo");

  const groups = await import(moduleUrl("modules/groups-data.js"));
  mod.state.P = { slug: "demo", chats: [] };
  assert.deepEqual(groups.getProjectGroups(), [{ id: "grp_1", name: "Pesquisa" }]);
  assert.deepEqual(groups.getProjectAssignments(), { "a.md": { groupId: "grp_1" } });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true }) });
  try {
    await groups.saveGroupsData([{ id: "grp_2", name: "Nova" }], { "b.md": { groupId: "grp_2" } });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(client.patches.at(-1), {
    groups: [{ id: "grp_2", name: "Nova" }],
    assignments: { "b.md": { groupId: "grp_2" } },
  });
});

test("EP-14.07: abrir conversa registra a acao de abertura de chat", async () => {
  const { mod, client } = await setup();
  mod.state.P = {
    slug: "demo",
    chats: [{ name: "a.md", title: "Conversa A" }],
    context: [],
    scheduled: [],
  };

  const sync = await import(moduleUrl("modules/projects-sync.js"));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ content: "---\ntitle: Conversa A\n---\ncorpo" }),
  });
  try {
    await sync.openFile("chats", "a.md");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(client.actions, [{ acao: mod.CHAT_ACTIONS.OPEN_CHAT, alvo: "a.md" }]);
});

test("EP-14.07: carregar outro projeto hidrata o estado e registra a troca", async () => {
  const { mod, client } = await setup({ groupFilter: "grp_9" });
  mod.state.P = { slug: "anterior", chats: [] };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      slug: "demo", chats: [], context: [], scheduled: [],
      instructions: "", memory: "", extraction: null, review: { pendentes: 0 },
    }),
  });
  try {
    const projects = await import(moduleUrl("modules/projects-load.js"));
    await projects.load("demo");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(client.loads, 1);
  assert.equal(mod.state.chatGroupFilter, "grp_9", "filtro salvo e aplicado na carga do projeto");
  assert.deepEqual(client.actions, [{ acao: mod.CHAT_ACTIONS.PROJECT, alvo: "demo" }]);
});

test("EP-14.07: modulos adotados nao acessam mais o localStorage direto", () => {
  const files = [
    "shared/state.js",
    "modules/groups-assign.js",
    "modules/groups-classify.js",
    "modules/groups-data.js",
    "modules/groups-manage.js",
    "modules/groups-store.js",
    "modules/projects-chat-actions.js",
    "modules/projects-load.js",
    "modules/projects-sync.js",
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(PUBLIC_JS, file), "utf8");
    if (file === "shared/state.js") {
      // Unico uso permitido: o conteudo da conversa em andamento (volumoso demais para o limite de 64 KB).
      const usos = source.match(/localStorage\.\w+\([^)]*\)/g) || [];
      assert.ok(usos.every((uso) => /key/.test(uso)), "state.js so pode usar localStorage com a chave do chat ativo");
      assert.equal(/harness_chat_draft_|harness_chats_|harness_groups_/.test(source.replace(/\/\/.*$/gm, "")), false);
      continue;
    }
    assert.equal(source.includes("localStorage"), false, `${file} ainda usa localStorage`);
  }

  const registry = require("../ui/server/services/screen-state/registry");
  const chats = registry.getScreen("chats");
  assert.equal(chats.campos.page.tipo, "number");
  assert.equal(chats.campos.assignments.tipo, "object");
});
