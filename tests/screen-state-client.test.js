// Regressao do EP-14.06: cliente de estado de tela (hidratacao, debounce,
// migracao das chaves antigas, reserva offline e retentativa).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const REGISTRY = require("../ui/server/services/screen-state/registry");
const CLIENT_PATH = pathToFileURL(path.join(__dirname, "..", "ui", "public", "js", "shared", "screen-state.js")).href;
const MIGRATE_PATH = pathToFileURL(path.join(__dirname, "..", "ui", "public", "js", "shared", "screen-state-migrate.js")).href;
const loadClient = () => import(CLIENT_PATH);
const loadMigrate = () => import(MIGRATE_PATH);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    get length() { return store.size; },
    key(index) { return [...store.keys()][index] ?? null; },
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
  };
}

function jsonResponse(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return payload; } };
}

function createServer(initialState = {}, initialRev = 0) {
  const server = {
    state: { ...initialState }, rev: initialRev, offline: false, calls: [], history: [], failPatch: false,
    async fetch(url, options = {}) {
      const method = options.method || "GET", body = options.body ? JSON.parse(options.body) : null;
      server.calls.push({ url, method, body });
      if (server.offline) throw new Error("servidor desligado");
      if (method === "GET") return jsonResponse({ state: server.state, rev: server.rev });
      if (method === "PATCH") {
        if (server.failPatch) return jsonResponse({ error: "indisponivel" }, 500);
        if (server.conflitoUmaVez) {
          server.conflitoUmaVez = false;
          server.state = { ...server.state, draft: "outra aba" };
          server.rev += 1;
          return jsonResponse({ error: "revisao desatualizada" }, 409);
        }
        server.state = { ...server.state, ...body.state }; server.rev += 1;
        return jsonResponse({ state: server.state, rev: server.rev });
      }
      if (method === "POST" && url.includes("/history")) {
        server.history.push(body);
        return jsonResponse({ ok: true });
      }
      return jsonResponse({ error: "rota desconhecida" }, 404);
    },
  };
  return server;
}

function createEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(name, listener) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(listener);
    },
    dispatch(name) { for (const listener of listeners.get(name) || []) listener(); },
  };
}

function makeClient(ScreenStateClient, server, extra = {}) {
  return new ScreenStateClient({
    fetchImpl: server.fetch, storage: createStorage(), project: "demo",
    eventTarget: createEventTarget(), ...extra,
  });
}

test("EP-14.06: espelho do cliente bate com o registro canonico do servidor", async () => {
  const migrate = await loadMigrate();
  for (const tela of REGISTRY.SCREENS) {
    assert.equal(migrate.screenScope(tela.id), tela.escopo, `escopo de ${tela.id}`);
    assert.deepEqual(migrate.SCREEN_MIGRATIONS[tela.id], tela.migraDe, `migraDe de ${tela.id}`);
  }
  assert.equal(migrate.isKnownScreen("inexistente"), false);
  assert.equal(migrate.screenScope("inexistente"), "");
});

test("EP-14.06: hidrata do servidor antes de devolver e usa cache em memoria", async () => {
  const { ScreenStateClient } = await loadClient();
  const server = createServer({ viewMode: "table", pageSize: 15 }, 7);
  const client = makeClient(ScreenStateClient, server);
  const state = await client.loadScreen("chats");
  assert.deepEqual(state, { viewMode: "table", pageSize: 15 });
  assert.equal(server.calls.length, 1);
  assert.match(server.calls[0].url, /^\/api\/screens\/chats\/state\?project=demo$/);
  state.viewMode = "cards";
  assert.equal((await client.loadScreen("chats")).viewMode, "table", "cache nao e mutado pelo chamador");
  assert.equal(server.calls.length, 1, "segunda carga nao refaz GET");
  client.destroy();
});

test("EP-14.06: migra migraDe na primeira carga e remove as chaves antigas", async () => {
  const { ScreenStateClient } = await loadClient();
  const storage = createStorage({
    harness_chats_view_mode: "cards", harness_chats_page_size: "30",
    harness_chat_draft_demo: "rascunho do projeto", harness_chat_draft_outro: "nao e deste projeto",
    harness_groups_demo: JSON.stringify([{ id: "g1" }]),
    harness_chat_engine_settings: JSON.stringify({ currentEngine: "gemini" }),
  });
  const server = createServer();
  const client = makeClient(ScreenStateClient, server, { storage });
  const state = await client.loadScreen("chats");
  assert.equal(state.viewMode, "cards");
  assert.equal(state.pageSize, 30);
  assert.equal(state.draft, "rascunho do projeto");
  assert.equal(state.engineFilter, "gemini");
  assert.deepEqual(state.groups, [{ id: "g1" }]);
  for (const key of [
    "harness_chats_view_mode", "harness_chats_page_size", "harness_chat_draft_demo",
    "harness_groups_demo", "harness_chat_engine_settings",
  ]) {
    assert.equal(storage.getItem(key), null, `chave ${key} deve ser removida`);
  }
  assert.equal(storage.getItem("harness_chat_draft_outro"), "nao e deste projeto");
  assert.deepEqual(server.state.groups, [{ id: "g1" }], "migracao chega ao servidor na primeira carga");
  client.destroy();
});

test("EP-14.06: servidor desligado usa localStorage como reserva e sobrevive ao F5", async () => {
  const { ScreenStateClient } = await loadClient();
  const storage = createStorage();
  const server = createServer({ viewMode: "table" }, 2);
  server.offline = true;
  const client = makeClient(ScreenStateClient, server, { storage, debounceMs: 5 });
  assert.deepEqual(await client.loadScreen("chats"), {});
  await client.patchScreen("chats", { viewMode: "cards", draft: "offline" });
  client.destroy();
  const second = makeClient(ScreenStateClient, server, { storage, retryDelayMs: 5 });
  const restored = await second.loadScreen("chats");
  assert.equal(restored.viewMode, "cards");
  assert.equal(restored.draft, "offline");
  server.offline = false;
  await sleep(30);
  assert.equal(server.state.viewMode, "cards", "estado da reserva sobe quando o servidor volta");
  assert.equal(server.calls.at(-1).body.rev, 0, "PATCH envia a revisao conhecida");
  second.destroy();
});

test("EP-14.06: patch grava no localStorage na hora e no servidor com debounce de 400 ms", async () => {
  const { ScreenStateClient } = await loadClient();
  const server = createServer();
  const client = makeClient(ScreenStateClient, server);
  const storage = client.options.storage;
  await client.patchScreen("scrum", { sprint: "S-1" });
  await client.patchScreen("scrum", { filter: "minhas" });
  assert.equal(server.calls.filter((call) => call.method === "PATCH").length, 0,
    "nao grava no servidor antes do debounce");
  const fallbackKeys = [...storage.store.keys()].filter((key) => key.startsWith("leca.screen-state.v1"));
  assert.equal(fallbackKeys.length, 1, "reserva local recebe o estado imediatamente");
  assert.match(storage.getItem(fallbackKeys[0]), /"sprint":"S-1"/);
  await sleep(460);
  const patches = server.calls.filter((call) => call.method === "PATCH");
  assert.equal(patches.length, 1, "duas edicoes viram um PATCH");
  assert.deepEqual(patches[0].body.state, { sprint: "S-1", filter: "minhas" });
  client.destroy();
});

test("EP-14.06: pagehide envia o estado pendente com sendBeacon", async () => {
  const { ScreenStateClient } = await loadClient();
  const target = createEventTarget();
  const beacons = [];
  const navigator = { sendBeacon(url, body) { beacons.push({ url, body }); return true; } };
  const client = makeClient(ScreenStateClient, createServer(), { eventTarget: target, navigator, debounceMs: 10000 });
  await client.patchScreen("board", { sprint: "S-2" });
  target.dispatch("pagehide");
  target.dispatch("pagehide");
  assert.equal(beacons.length, 2, "cada pagehide envia o pendente");
  assert.equal(beacons[0].url, "/api/screens/board/state?project=demo");
  const payload = JSON.parse(await beacons[0].body.text());
  assert.deepEqual(payload.state, { sprint: "S-2" });
  assert.equal(payload.project, "demo");
  client.destroy();
});

test("EP-14.06: falha no PATCH mantem a reserva e tenta de novo depois", async () => {
  const { ScreenStateClient } = await loadClient();
  const server = createServer();
  server.failPatch = true;
  const client = makeClient(ScreenStateClient, server, { debounceMs: 5, retryDelayMs: 10 });
  await client.patchScreen("audit", { severity: "alta" });
  await sleep(40);
  assert.ok(server.calls.some((call) => call.method === "PATCH"));
  server.failPatch = false;
  await sleep(40);
  const lastPatch = server.calls.filter((call) => call.method === "PATCH").at(-1);
  assert.equal(lastPatch.body.state.severity, "alta");
  assert.equal(server.state.severity, "alta", "retentativa sincroniza a reserva");
  client.destroy();
});

test("EP-14.06: logAction envia acao, alvo, projeto e ts; falha entra na fila", async () => {
  const { ScreenStateClient } = await loadClient();
  const server = createServer();
  server.failHistory = true;
  const originalFetch = server.fetch.bind(server);
  server.fetch = async (url, options = {}) => {
    if (options.method === "POST" && server.failHistory) {
      server.calls.push({ url, method: "POST", body: JSON.parse(options.body) });
      throw new Error("historico indisponivel");
    }
    return originalFetch(url, options);
  };
  const client = makeClient(ScreenStateClient, server, { retryDelayMs: 10, now: () => 1234 });
  const ok = await client.logAction("layers", "abrir componente", "Button");
  assert.equal(ok, false);
  assert.equal(server.calls[0].url, "/api/screens/layers/history");
  assert.deepEqual(server.calls[0].body, {
    acao: "abrir componente", alvo: "Button", ts: 1234, project: "demo",
  });
  server.failHistory = false;
  await sleep(30);
  const success = server.calls.filter((call) => call.method === "POST").at(-1);
  assert.equal(success.url, "/api/screens/layers/history");
  assert.equal(success.body.acao, "abrir componente");
  client.destroy();
});

test("EP-14.06: conflito 409 recarrega o rev e refaz o merge antes de salvar", async () => {
  const { ScreenStateClient } = await loadClient();
  const server = createServer();
  server.conflitoUmaVez = true;
  const client = makeClient(ScreenStateClient, server, { debounceMs: 5 });
  await client.patchScreen("chats", { viewMode: "cards" });
  await sleep(40);
  const patches = server.calls.filter((call) => call.method === "PATCH");
  assert.equal(patches.length, 2, "primeiro PATCH recebe 409 e o segundo usa o rev novo");
  assert.equal(patches[1].body.rev, 1);
  assert.equal(server.state.draft, "outra aba", "nao perde a alteracao da outra aba");
  assert.equal(server.state.viewMode, "cards", "a alteracao local prevalece no merge");
  client.destroy();
});

test("EP-14.06: tela desconhecida e estado invalido sao rejeitados", async () => {
  const { ScreenStateClient } = await loadClient();
  const client = makeClient(ScreenStateClient, createServer());
  await assert.rejects(() => client.loadScreen("inexistente"), /Tela desconhecida/);
  await assert.rejects(() => client.patchScreen("chats", null), /objeto de estado/);
  await assert.rejects(() => client.logAction("chats", "  "), /nome da ação/);
  client.destroy();
});
