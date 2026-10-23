// Regressao do EP-14.08: estado do Atelie de Prototipos (layout dos paineis,
// reabertura do prototipo, tela, no, inspetor e viewport).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const DIR = path.join(__dirname, "..", "ui", "public", "js", "modules");
const STATE_PATH = pathToFileURL(path.join(DIR, "prototype-atelier-state.js")).href;
const ADOPTION_PATH = pathToFileURL(path.join(DIR, "prototype-atelier-adoption.js")).href;
const NEW_FILES = [
  "prototype-atelier-state.js",
  "prototype-atelier-adoption.js",
  "prototype-atelier-inspector-tabs.js",
  "studio-state.js",
  "studio-adoption.js",
];

const load = () => import(STATE_PATH);

test("EP-14.08: normaliza larguras e recolhimento dos paineis do Atelie", async () => {
  const { normalizeWorkspaceLayout } = await load();
  assert.deepEqual(normalizeWorkspaceLayout({
    widths: { catalog: 10, chat: 999, inspector: "x" },
    collapsed: { chat: true, inspector: "sim" },
  }), {
    widths: { catalog: 160, chat: 620, inspector: 290 },
    collapsed: { catalog: false, chat: true, inspector: false },
  });
  assert.equal(normalizeWorkspaceLayout(null), undefined);
});

test("EP-14.08: normaliza o estado do Atelie e descarta valores invalidos", async () => {
  const { normalizeAtelierState } = await load();
  const state = normalizeAtelierState({
    activePrototype: "checkout",
    activeScreen: "pagamento",
    selectedNode: "",
    inspector: false,
    viewport: "390",
    workspaceLayout: { widths: { chat: 400 }, collapsed: { chat: true } },
    extra: 1,
  });
  assert.equal(state.activePrototype, "checkout");
  assert.equal(state.activeScreen, "pagamento");
  assert.equal(state.selectedNode, "");
  assert.equal(state.inspector, false);
  assert.equal(state.viewport, "390");
  assert.deepEqual(state.workspaceLayout.widths, { catalog: 220, chat: 400, inspector: 290 });
  assert.equal("extra" in state, false);
  assert.deepEqual(normalizeAtelierState({ activePrototype: "x".repeat(121), selectedNode: 7 }), {});
});

test("EP-14.08: patch do Atelie leva somente os campos enviados", async () => {
  const { atelierPatch } = await load();
  assert.deepEqual(atelierPatch({ activeScreen: "home", bogus: 1 }), { activeScreen: "home" });
  assert.deepEqual(atelierPatch({ selectedNode: "" }), { selectedNode: "" });
  assert.deepEqual(atelierPatch({ viewport: "x".repeat(20) }), {});
});

test("EP-14.08: grava e registra acoes do Atelie pelo cliente de estado", async () => {
  const { readAtelierState, saveAtelierState, logAtelierAction } = await load();
  /** @type {Array<{ id: string, patch: unknown }>} */ const patches = [];
  /** @type {Array<{ id: string, acao: string, alvo: string }>} */ const actions = [];
  const client = {
    async loadScreen(id) { return id === "prototypes" ? { activePrototype: "p1", viewport: "768" } : {}; },
    async patchScreen(id, patch) { patches.push({ id, patch }); return patch; },
    async logAction(id, acao, alvo) { actions.push({ id, acao, alvo }); return true; },
  };

  assert.deepEqual(await readAtelierState({ client }), { activePrototype: "p1", viewport: "768" });
  assert.deepEqual(await saveAtelierState({ activeScreen: "home", bogus: 1 }, { client }), { activeScreen: "home" });
  assert.deepEqual(patches, [{ id: "prototypes", patch: { activeScreen: "home" } }]);
  assert.equal(await logAtelierAction("excluir prototipo", "p1", { client }), true);
  assert.deepEqual(actions, [{ id: "prototypes", acao: "excluir prototipo", alvo: "p1" }]);
});

test("EP-14.08: acha somente prototipos editaveis no catalogo", async () => {
  const { findAtelierPrototype, shouldRedirectToSavedPrototype } = await load();
  const catalog = [{ id: "doc", kind: "artifact" }, { id: "p1", kind: "atelier" }];
  assert.equal(findAtelierPrototype(catalog, "p1").id, "p1");
  assert.equal(findAtelierPrototype(catalog, "doc"), null);
  assert.equal(shouldRedirectToSavedPrototype({ activePrototype: "p1" }, "p0", catalog), "p1");
  assert.equal(shouldRedirectToSavedPrototype({ activePrototype: "p1" }, "p1", catalog), "");
  assert.equal(shouldRedirectToSavedPrototype({ activePrototype: "doc" }, "p0", catalog), "");
  assert.equal(shouldRedirectToSavedPrototype(null, "p0", catalog), "");
});

test("EP-14.08: escolhe a tela salva so quando ela ainda existe", async () => {
  const { pickAtelierScreen } = await load();
  const screens = [{ id: "home" }, { id: "checkout" }];
  assert.equal(pickAtelierScreen("checkout", screens, "home"), "checkout");
  assert.equal(pickAtelierScreen("sumiu", screens, "checkout"), "checkout");
  assert.equal(pickAtelierScreen("sumiu", screens, "sumiu"), "home");
  assert.equal(pickAtelierScreen(undefined, [], undefined), "home");
});

test("EP-14.08: viewport salvo invalido volta ao padrao do Atelie", async () => {
  const { restoreViewport, ATELIER_DEFAULT_VIEWPORT } = await load();
  assert.equal(restoreViewport("390"), 390);
  assert.equal(restoreViewport(1024), 1024);
  assert.equal(restoreViewport("abc"), ATELIER_DEFAULT_VIEWPORT);
  assert.equal(restoreViewport("10"), ATELIER_DEFAULT_VIEWPORT);
});

test("EP-14.08: reabre o prototipo salvo uma unica vez por carga", async () => {
  const {
    beginAtelierAdoption,
    resetAtelierAdoption,
    restoredAtelierNode,
    restoredAtelierScreen,
    restoredAtelierViewport,
  } = await import(ADOPTION_PATH);
  resetAtelierAdoption();
  const client = {
    async loadScreen() {
      return {
        activePrototype: "p2",
        activeScreen: "checkout",
        selectedNode: "n1",
        viewport: "390",
        inspector: false,
        workspaceLayout: { widths: { chat: 400 }, collapsed: { chat: true } },
      };
    },
  };
  const catalog = [{ id: "p1", kind: "atelier" }, { id: "p2", kind: "atelier" }];
  /** @type {string[]} */ const selected = [];

  const first = await beginAtelierAdoption({ protoId: "p1", catalog, client, onSelect: (id, kind) => selected.push(`${kind}:${id}`) });
  assert.equal(first.redirect, "p2");
  assert.deepEqual(selected, ["atelier:p2"]);
  assert.equal(restoredAtelierScreen([{ id: "home" }, { id: "checkout" }], "home"), "checkout");
  assert.equal(restoredAtelierNode(), "n1");
  assert.equal(restoredAtelierViewport(), 390);

  const second = await beginAtelierAdoption({ protoId: "p2", catalog, client, onSelect: (id, kind) => selected.push(`${kind}:${id}`) });
  assert.equal(second.redirect, "");
  assert.deepEqual(selected, ["atelier:p2"]);
  resetAtelierAdoption();
});

test("EP-14.08: modulos novos respeitam teto de linhas e nao usam emoji", () => {
  for (const name of NEW_FILES) {
    const source = fs.readFileSync(path.join(DIR, name), "utf8");
    assert.ok(source.split("\n").length <= 300, `${name} deve ficar abaixo de 300 linhas`);
    assert.equal(/\p{Extended_Pictographic}/u.test(source), false, `${name} sem emoji`);
  }
  const atelier = fs.readFileSync(path.join(DIR, "prototype-atelier.js"), "utf8");
  assert.ok(atelier.split("\n").length <= 300, "prototype-atelier.js deve ficar abaixo de 300 linhas");
});
