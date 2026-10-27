// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const load = (file) => import(pathToFileURL(path.join(root, file)).href);

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

const TOCADOS = [
  "ui/public/js/modules/design-scrum-state.js",
  "ui/public/js/modules/design-layers-state.js",
  "ui/public/js/modules/design-scrum-view.js",
  "ui/public/js/modules/design-scrum-actions.js",
  "ui/public/js/modules/design-scrum-story-drawer.js",
  "ui/public/js/modules/design-scrum-story-transition.js",
  "ui/public/js/modules/design-layers-workspace.js",
  "ui/public/js/modules/design-audit.js",
  "ui/public/js/modules/design-board.js",
];

function fakeClient(loaded = {}) {
  const calls = { patches: [], actions: [], loads: 0 };
  return {
    calls,
    async loadScreen() { calls.loads += 1; return loaded; },
    async patchScreen(id, state) { calls.patches.push({ id, state }); return state; },
    async logAction(id, acao, alvo) { calls.actions.push({ id, acao, alvo }); return true; },
  };
}

test("registro declara os campos persistidos das telas de design", () => {
  const registry = read("ui/server/services/screen-state/registry.js");
  for (const campo of ["epicFilter", "assigneeFilter", "onlyImpediments", "activeScreen", "focusedField", "filterOnlyFocused", "viewport", "evidenceState"]) {
    assert.match(registry, new RegExp(campo));
  }
});

test("registro mantem as entradas das quatro telas", () => {
  const registry = read("ui/server/services/screen-state/registry.js");
  for (const tela of ['tela("scrum"', 'tela("layers"', 'tela("board"', 'tela("audit"']) {
    assert.match(registry, new RegExp(tela.replace(/[()"]/g, "\\$&")));
  }
});

test("estado do Scrum hidrata, aplica e persiste filtros e selecao", async () => {
  const mod = await load("ui/public/js/modules/design-scrum-state.js");
  const { ds } = await load("ui/public/js/modules/design-scrum-store.js");
  Object.assign(ds, { currentScrumTab: "sprint", currentSearchQuery: "", selectedStoryId: null, currentEpicFilter: "all", currentAssigneeFilter: "all", onlyImpediments: false, selectedSprintFilter: "active" });

  const client = fakeClient({ tab: "backlog", filter: "oauth", onlyImpediments: true, selectedStory: "EP-1", sprint: "sprint-9" });
  const adapter = mod.createScrumStateAdapter(client);
  assert.equal(await adapter.hydrate(), true);
  assert.equal(ds.currentScrumTab, "backlog");
  assert.equal(ds.currentSearchQuery, "oauth");
  assert.equal(ds.onlyImpediments, true);
  assert.equal(ds.selectedStoryId, "EP-1");
  assert.equal(ds.selectedSprintFilter, "sprint-9");

  assert.equal(mod.applyScrumState({ tab: "invalida" }), false);
  const snapshot = mod.scrumStateFromStore();
  assert.deepEqual(Object.keys(snapshot).sort(), ["assigneeFilter", "epicFilter", "filter", "onlyImpediments", "selectedStory", "sprint", "tab"]);

  await adapter.persist({ filter: "pagamento" });
  assert.equal(client.calls.patches.at(-1).id, "scrum");
  assert.equal(client.calls.patches.at(-1).state.filter, "pagamento");
  await adapter.log("mudanca-de-sprint", "sprint-9");
  assert.equal(client.calls.actions[0].acao, "mudanca-de-sprint");
});

test("estado do Mapa em Camadas hidrata tela, camada, foco e viewport", async () => {
  const mod = await load("ui/public/js/modules/design-layers-state.js");
  const { dls } = await load("ui/public/js/modules/design-layers-store.js");
  Object.assign(dls, { activeScreenId: null, activeLayer: "ui", focusedFieldId: null, filterOnlyFocused: false, activeViewport: "desktop" });

  const client = fakeClient({ activeScreen: "checkout", selectedLayer: "api", focusedField: "email", filterOnlyFocused: true, viewport: "mobile" });
  const adapter = mod.createLayersStateAdapter(client);
  assert.equal(await adapter.hydrate(), true);
  assert.equal(dls.activeScreenId, "checkout");
  assert.equal(dls.activeLayer, "api");
  assert.equal(dls.focusedFieldId, "email");
  assert.equal(dls.filterOnlyFocused, true);
  assert.equal(dls.activeViewport, "mobile");

  assert.equal(mod.applyLayersState({ selectedLayer: "inexistente" }), false);
  assert.equal(mod.applyLayersState({ viewport: "tv" }), false);
  const snapshot = mod.layersStateFromStore();
  assert.equal(snapshot.selectedLayer, "api");
  assert.ok(mod.LAYER_IDS.includes("tests"));

  await adapter.persist({ selectedLayer: "data" });
  assert.equal(client.calls.patches.at(-1).state.selectedLayer, "data");
});

test("estado do quadro aplica filtro, agrupamento, selecao e zoom com limite", async () => {
  const mod = await load("ui/public/js/modules/design-board.js");
  mod.applyBoardState({ filter: "botao", selectedCard: "c-1", groupBy: "feature", zoom: 500 });
  const snapshot = mod.boardStateFromStore();
  assert.equal(snapshot.filter, "botao");
  assert.equal(snapshot.selectedCard, "c-1");
  assert.equal(snapshot.groupBy, "feature");
  assert.equal(snapshot.zoom, 200);
  assert.equal(mod.applyBoardState({ groupBy: "regiao" }), false);
  assert.equal(mod.applyBoardState({ zoom: 10 }), true);
  assert.equal(mod.boardStateFromStore().zoom, 25);
});

test("estado da auditoria hidrata filtros, severidade e evidencia", async () => {
  const mod = await load("ui/public/js/modules/design-audit.js");
  const { das } = await load("ui/public/js/modules/design-audit-store.js");
  Object.assign(das, { auditSearchQuery: "", auditFilterMode: "all", auditEvidenceState: "all" });
  mod.applyAuditState({ matrixFilter: "login", severity: "uncovered", evidenceState: "approved", selectedComponent: "c-2" });
  const snapshot = mod.auditStateFromStore();
  assert.equal(snapshot.matrixFilter, "login");
  assert.equal(snapshot.severity, "uncovered");
  assert.equal(snapshot.evidenceState, "approved");
  assert.equal(snapshot.selectedComponent, "c-2");
  assert.equal(mod.applyAuditState({ severity: "zzz" }), false);
  assert.equal(mod.applyAuditState({ evidenceState: "zzz" }), false);
});

test("views e handlers ligam hidratacao, persistencia e registro de acoes", () => {
  assert.match(read("ui/public/js/modules/design-scrum-view.js"), /hydrateScrumState/);
  const actions = read("ui/public/js/modules/design-scrum-actions.js");
  assert.match(actions, /persistScrumState/);
  assert.match(actions, /logScrumAction\("transicao-de-historia"/);
  assert.match(read("ui/public/js/modules/design-scrum-story-drawer.js"), /persistScrumState\(\{ selectedStory/);
  assert.match(read("ui/public/js/modules/design-scrum-story-transition.js"), /logScrumAction\("transicao-de-historia"/);

  const layers = read("ui/public/js/modules/design-layers-workspace.js");
  assert.match(layers, /hydrateLayersState/);
  assert.match(layers, /persistLayersState/);
  assert.match(layers, /window\.toggleFilterOnlyFocused/);

  const audit = read("ui/public/js/modules/design-audit.js");
  assert.match(audit, /renderAuditWorkspace as renderAuditBase/);
  assert.match(audit, /execucao-de-auditoria/);

  const board = read("ui/public/js/modules/design-board.js");
  assert.match(board, /boardToolbar/);
  assert.match(board, /setBoardGroupBy/);
  assert.match(board, /selectDesignCard/);
  assert.match(board, /openBoardComponentPreview/);
  assert.match(board, /openComponentModal\(boardProjectSlug, componentId\)/);
  assert.doesNotMatch(board, /design-card-preview/);
});

test("arquivos de design nao usam emoji e respeitam o limite de linhas", () => {
  for (const file of TOCADOS) {
    const content = read(file);
    assert.doesNotMatch(content, EMOJI, `${file} contem emoji`);
    const lines = content.replace(/\r?\n$/, "").split(/\r?\n/).length;
    assert.ok(lines <= 300, `${file} tem ${lines} linhas`);
  }
});
