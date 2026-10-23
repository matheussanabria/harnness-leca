// Regressao do EP-14.08: estado da tela Studio (normalizacao, restauracao,
// gravacao, registro de acoes) e limites do modulo.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const REGISTRY = require("../ui/server/services/screen-state/registry");
const MODULE_PATH = pathToFileURL(path.join(__dirname, "..", "ui", "public", "js", "modules", "studio-state.js")).href;
const MODULE_FILE = path.join(__dirname, "..", "ui", "public", "js", "modules", "studio-state.js");
const load = () => import(MODULE_PATH);

test("EP-14.08: normaliza o estado do Studio e descarta campos desconhecidos", async () => {
  const { normalizeStudioState } = await load();
  const state = normalizeStudioState({
    activeView: "design",
    sidebarWidth: 1200,
    sourceOpen: true,
    sourceWidth: 900,
    viewport: "390px",
    route: "/painel",
    dockMaximized: false,
    activePrototype: "fluxo",
    activeScreen: "home",
    extra: "ignorado",
  }, 1440);

  assert.equal(state.activeView, "design");
  assert.equal(state.sidebarWidth, 850, "largura limitada pelo viewport");
  assert.equal(state.sourceOpen, true);
  assert.equal(state.sourceWidth, 720, "largura maxima da coluna de codigo");
  assert.equal(state.viewport, "390px");
  assert.equal(state.route, "/painel");
  assert.equal(state.dockMaximized, false);
  assert.equal("extra" in state, false);
});

test("EP-14.08: tipos invalidos nao entram no estado do Studio", async () => {
  const { normalizeStudioState } = await load();
  assert.deepEqual(normalizeStudioState(null), {});
  assert.deepEqual(normalizeStudioState({ activeView: 1, sidebarWidth: "800", sourceOpen: "sim", viewport: "x".repeat(40) }), {});
  assert.equal(normalizeStudioState({ sourceWidth: 10 }).sourceWidth, 160);
});

test("EP-14.08: patch do Studio leva somente os campos enviados e validos", async () => {
  const { studioPatch } = await load();
  assert.deepEqual(studioPatch({ sourceOpen: true, bogus: 1 }), { sourceOpen: true });
  assert.deepEqual(studioPatch({ activeView: "preview", sidebarWidth: 200 }), { activeView: "preview", sidebarWidth: 300 });
  assert.deepEqual(studioPatch({ activeView: "x".repeat(40) }), {});
});

test("EP-14.08: restaura o Studio aplicando cada campo no callback correspondente", async () => {
  const { restoreStudioState } = await load();
  /** @type {string[]} */ const loaded = [];
  /** @type {Record<string, unknown>} */ const applied = {};
  const client = {
    async loadScreen(id) {
      loaded.push(id);
      return { activeView: "design", sidebarWidth: 520, sourceOpen: true, extra: 1 };
    },
  };

  const state = await restoreStudioState({
    client,
    viewportWidth: 1440,
    apply: {
      activeView: (value) => { applied.activeView = value; },
      sidebarWidth: (value) => { applied.sidebarWidth = value; },
      sourceOpen: (value) => { applied.sourceOpen = value; },
    },
  });

  assert.deepEqual(loaded, ["studio"]);
  assert.deepEqual(applied, { activeView: "design", sidebarWidth: 520, sourceOpen: true });
  assert.equal(state.sidebarWidth, 520);
});

test("EP-14.08: grava e registra acoes do Studio pelo cliente de estado", async () => {
  const { saveStudioState, logStudioAction } = await load();
  /** @type {Array<{ id: string, patch: unknown }>} */ const patches = [];
  /** @type {Array<{ id: string, acao: string, alvo: string }>} */ const actions = [];
  const client = {
    async patchScreen(id, patch) { patches.push({ id, patch }); return patch; },
    async logAction(id, acao, alvo) { actions.push({ id, acao, alvo }); return true; },
  };

  const patch = await saveStudioState({ sourceWidth: 640, viewport: "800", bogus: 1 }, { client });
  assert.deepEqual(patch, { sourceWidth: 640, viewport: "800" });
  assert.deepEqual(patches, [{ id: "studio", patch: { sourceWidth: 640, viewport: "800" } }]);

  assert.equal(await logStudioAction("salvar arquivo", "src/app.ts", { client }), true);
  assert.deepEqual(actions, [{ id: "studio", acao: "salvar arquivo", alvo: "src/app.ts" }]);
});

test("EP-14.08: registry aceita os campos do Studio e do Atelie usados na historia", () => {
  assert.deepEqual(
    REGISTRY.sanitizeState("studio", { sourceOpen: true, sourceWidth: 500, viewport: "390px", bogus: 1 }),
    { sourceOpen: true, sourceWidth: 500, viewport: "390px" },
  );
  assert.deepEqual(
    REGISTRY.sanitizeState("prototypes", { viewport: "1440", selectedNode: "n1", bogus: 1 }),
    { viewport: "1440", selectedNode: "n1" },
  );
  assert.equal(REGISTRY.getScreen("prototypes").campos.viewport.tipo, "string");
});

test("EP-14.08: modulo do Studio respeita teto de linhas e nao usa emoji", async () => {
  const source = fs.readFileSync(MODULE_FILE, "utf8");
  assert.ok(source.split("\n").length <= 300, "studio-state.js deve ficar abaixo de 300 linhas");
  assert.equal(/\p{Extended_Pictographic}/u.test(source), false, "sem emoji no codigo");
});
