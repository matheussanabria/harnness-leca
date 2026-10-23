// Regressao do EP-14.10: deploy, office, overview e diario no estado de tela.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const JS = path.join(ROOT, "ui", "public", "js");
const importJs = (relative) => import(pathToFileURL(path.join(JS, relative)).href);
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

test("EP-14.10: deploy normaliza o estado e usa a API como fonte do historico", async () => {
  const deploy = await importJs("deploy/deploy-state.js");
  const defaults = deploy.defaultDeployConfig();
  assert.equal(defaults.projects.length, 2, "configuracao inicial preservada");
  assert.equal(deploy.hasDeployProjects(defaults), true);
  assert.equal(deploy.hasDeployProjects({ projects: [] }), false);

  const state = deploy.normalizeDeployState({
    environment: "prod", pipeline: "web", selectedRun: "42", tab: "logs",
    config: { projects: [{ id: "demo" }] }, desconhecido: true,
  });
  assert.deepEqual(state, {
    environment: "prod", pipeline: "web", selectedRun: "42", tab: "logs",
    config: { projects: [{ id: "demo" }] },
  });
  assert.deepEqual(deploy.deployStatePatch({ config: "invalido", tab: "x", extra: 1 }), { tab: "x" });

  const source = ["deploy/deploy-data.js", "deploy/deploy-run.js", "deploy/deploy-utils.js"]
    .map((file) => read(`ui/public/js/${file}`)).join("\n");
  assert.equal(/localStorage|harness_deploy_(config|history)/.test(source), false,
    "a copia local de configuracao e historico deve sumir");
  assert.match(read("ui/public/js/deploy/deploy-data.js"), /\/api\/deploy\/history/);
  assert.match(read("ui/public/js/deploy/deploy-run.js"), /await fetchHistory\(\)/);
  assert.match(read("ui/public/js/deploy/deploy-utils.js"), /patchScreen\("deploy"/);
  for (const file of ["deploy/deploy-state.js", "deploy/deploy-data.js"]) {
    assert.equal(EMOJI_REGEX.test(read(`ui/public/js/${file}`)), false, `${file} sem emoji`);
  }
});

test("EP-14.10: office hidrata HUD, sensibilidade e modo de visao pelo estado da tela", async () => {
  const office = await importJs("office-screen-state.js");
  assert.equal(office.normalizeSensitivity("12"), 10);
  assert.equal(office.normalizeSensitivity(0), 1);
  assert.equal(office.normalizeSensitivity("abc"), 5);
  assert.deepEqual(office.normalizeViewMap({ mode: "2.5d", cameraMode: "orbit" }, "demo"), {
    demo: { mode: "2.5d", cameraMode: "orbit" },
  });

  const patches = [];
  const client = {
    async loadScreen(id) {
      assert.equal(id, "office");
      return {
        hudHidden: true,
        mouseSensitivity: 8,
        viewMode: { demo: { mode: "diorama", cameraMode: "orbit" } },
      };
    },
    async patchScreen(id, patch) { patches.push([id, patch]); },
  };
  const state = new office.OfficeScreenState({ client, project: "demo" });
  await state.hydrate();
  assert.equal(state.hudHidden, true);
  assert.equal(state.mouseSensitivity, 8);
  assert.deepEqual(state.viewState(), { mode: "diorama", cameraMode: "orbit" });

  await state.setHudHidden(false);
  await state.setMouseSensitivity(3);
  await state.setViewState({ mode: "3d", cameraMode: "first_person" });
  assert.deepEqual(patches[0], ["office", { hudHidden: false }]);
  assert.deepEqual(patches[1], ["office", { mouseSensitivity: 3 }]);
  assert.equal(patches[2][1].viewMode.demo.mode, "3d");

  const storage = state.viewStorage(() => "demo");
  storage.setItem("dai_office_view_mode:demo", JSON.stringify({ mode: "2.5d", cameraMode: "orbit" }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(state.viewState().mode, "2.5d");

  const app = read("ui/public/js/office-app.js");
  assert.equal(/dai_office_hud_hidden|dai_mouse_sensitivity/.test(app), false);
  assert.equal(/dai_mouse_sensitivity/.test(read("ui/public/js/office-3d.js")), false);
  assert.equal(/dai_office_hud_hidden/.test(read("ui/public/js/office/office-hud-controller.js")), false);
  assert.match(app, /setHudPersistence/);
  assert.match(app, /viewStorage/);
  assert.equal(EMOJI_REGEX.test(read("ui/public/js/office-screen-state.js")), false);
});

test("EP-14.10: overview hidrata pagina, tamanho e ordenacao do estado da tela", async () => {
  const els = new Map();
  const el = () => ({
    innerHTML: "", textContent: "", className: "", value: "", checked: false,
    disabled: false, scrollTop: 0, scrollHeight: 0,
  });
  const calls = [];
  const patches = [];
  const sandbox = {
    $: (id) => { if (!els.has(id)) els.set(id, el()); return els.get(id); },
    document: {
      getElementById: (id) => sandbox.$(id),
      querySelectorAll: () => [],
      body: { classList: { add() {}, remove() {} } },
    },
    location: { search: "", pathname: "/overview", href: "/overview" },
    history: { replaceState() {} },
    fetch: async (url) => {
      calls.push(url);
      return {
        ok: true,
        async json() {
          return {
            total: 3, page: 2, pageSize: 25, pages: 3, active: "alpha",
            projects: [
              { slug: "alpha", active: true, chats: 2, context: 0, scheduled: 0, lastChat: "2026-02-01", extraction: { total: 2, ok: 0, nova: 2, alterada: 0 }, review: { pendentes: 0 }, memoryBytes: 20 },
              { slug: "beta", active: false, chats: 5, context: 0, scheduled: 0, lastChat: "2026-01-01", extraction: { total: 0, ok: 0, nova: 0, alterada: 0 }, review: { pendentes: 0 }, memoryBytes: 40 },
            ],
          };
        },
      };
    },
    URLSearchParams, TextDecoder, JSON, Number, String, Math, Array, Date, setTimeout, clearTimeout,
    __HARNESS_SCREEN_STATE_LOAD__: async (id) => {
      assert.equal(id, "overview");
      return { page: 2, pageSize: 25, sortField: "chats", sortAsc: true, query: "" };
    },
    __HARNESS_SCREEN_STATE_PATCH__: (id, patch) => patches.push([id, patch]),
    window: undefined,
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(read("ui/public/js/overview.js"), context);

  const until = async (condition, ms = 2000) => {
    const end = Date.now() + ms;
    while (!condition() && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 10));
    return condition();
  };
  assert.ok(await until(() => calls.length > 0), "a pagina deve consultar a API");
  assert.match(calls[0], /page=2&pageSize=25/);
  assert.match(sandbox.$("rows").innerHTML, /alpha[\s\S]*beta/, "ordenacao por conversas ascendente");
  assert.equal(sandbox.$("selSize").value, "25");

  vm.runInContext("goPage(3)", context);
  await until(() => patches.length > 0);
  assert.equal(JSON.stringify(patches[0][1]),
    JSON.stringify({ page: 3, pageSize: 25, sortField: "chats", sortAsc: true, query: "" }));
  assert.equal(EMOJI_REGEX.test(read("ui/public/js/overview.js")), false);
});

test("EP-14.10: diario normaliza filtros, ordena e pagina o estado da tela", async () => {
  const diario = await importJs("diario-state.js");
  const state = diario.normalizeDiarioState({
    project: "demo", query: "deploy", agentFilter: "claude", dateFrom: "2026-10-01",
    dateTo: "2026-10-31", sortField: "sessions", sortAsc: true, page: 2,
    pageSize: 25, allClosed: true,
  });
  assert.deepEqual(state, {
    project: "demo", query: "deploy", agentFilter: "claude", dateFrom: "2026-10-01",
    dateTo: "2026-10-31", sortField: "sessions", sortAsc: true, page: 2,
    pageSize: 25, allClosed: true,
  });
  assert.equal(diario.normalizeDiarioState({ pageSize: 7 }).pageSize, 10);
  assert.equal(diario.normalizeDiarioState({ page: 0 }).page, 1);

  const days = [
    { day: "2026-10-02", sessions: [{ agente: "claude", titulo: "deploy" }, { agente: "gemini", titulo: "outro" }] },
    { day: "2026-10-01", sessions: [{ agente: "claude", titulo: "deploy" }] },
    { day: "2026-09-30", sessions: [{ agente: "claude", titulo: "deploy" }] },
  ];
  const text = (session) => session.titulo;
  const filtered = diario.filterDiarioDays(days, { ...state, pageSize: 10, page: 1 }, text);
  assert.equal(filtered.length, 2, "periodo e agente sao respeitados");
  assert.equal(filtered[0].sessions.length, 1);
  const page = diario.paginateDiarioDays(filtered, { ...state, sortAsc: false, pageSize: 1, page: 1 });
  assert.equal(page.total, 2);
  assert.equal(page.pages, 2);
  assert.equal(page.days.length, 1);
  assert.deepEqual(diario.diarioStatePatch(state), state);
  assert.equal(EMOJI_REGEX.test(read("ui/public/js/diario-state.js")), false);
});

test("EP-14.10: registro cobre os novos campos do diario e o MAPA lista os arquivos", () => {
  const { getScreen, sanitizeState } = require("../ui/server/services/screen-state/registry");
  const fields = getScreen("diario").campos;
  for (const name of ["project", "query", "agentFilter", "dateFrom", "dateTo", "sortField", "sortAsc", "page", "pageSize", "allClosed"]) {
    assert.ok(fields[name], `campo ${name} declarado`);
  }
  assert.deepEqual(sanitizeState("diario", { dateFrom: "2026-10-01", allClosed: true, lixo: 1 }), {
    dateFrom: "2026-10-01", allClosed: true,
  });

  const mapa = read("MAPA.md");
  for (const file of ["deploy/deploy-state.js", "office-screen-state.js", "diario-state.js"]) {
    assert.ok(mapa.includes(file), `${file} precisa estar no MAPA.md`);
  }
});
