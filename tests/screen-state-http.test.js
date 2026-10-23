// @ts-check
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-screen-state-http-"));
const PROJECTS = path.join(ROOT, "projects");
const SLUG = "projeto-teste";
process.env.HARNESS_ROOT = ROOT;
process.env.HARNESS_PROJECTS_DIR = PROJECTS;
fs.mkdirSync(path.join(PROJECTS, SLUG), { recursive: true });

const {
  apiScreensCatalog,
  apiScreenStateGet,
  apiScreenStatePatch,
  apiScreenHistoryGet,
  apiScreenHistoryPost,
} = require("../ui/server/controllers/screen-state.controller");
const { screensRoutes } = require("../ui/server/routes/screens.routes");
const { ROUTES } = require("../ui/server/router");

test.after(() => {
  fs.rmSync(ROOT, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

function fakeRes() {
  return {
    headersSent: false,
    writableEnded: false,
    status: 0,
    body: "",
    setHeader() {},
    writeHead(code) { this.status = code; this.headersSent = true; },
    end(body) { this.body = body; this.writableEnded = true; },
  };
}

function fakeReq(body) {
  return Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
}

function fakeReqRaw(text) {
  return Readable.from([text]);
}

function urlFor(project = SLUG, extra = "") {
  const query = project === null ? "" : `project=${encodeURIComponent(project)}`;
  return new URL(`http://127.0.0.1/api?${query}${extra}`);
}

function json(res) {
  return JSON.parse(res.body);
}

async function patchScreen(id, body, project = SLUG) {
  const res = fakeRes();
  await apiScreenStatePatch({ req: fakeReq(body), res, params: [id], url: urlFor(project) });
  return res;
}

test("screen-state-http: GET /api/screens lista o catalogo das 13 telas", () => {
  const res = fakeRes();
  apiScreensCatalog({ res });
  assert.equal(res.status, 200);
  const body = json(res);
  assert.equal(body.screens.length, 13);
  assert.deepEqual(body.screens.map((screen) => screen.id), [
    "chats", "studio", "prototypes", "scrum", "layers", "board", "audit",
    "artifacts", "routines", "overview", "office", "deploy", "diario",
  ]);
  assert.equal(body.screens.every((screen) => screen.icone.startsWith("fa-")), true);
});

test("screen-state-http: GET e PATCH guardam o estado com merge e rev", async () => {
  const empty = fakeRes();
  apiScreenStateGet({ res: empty, params: ["chats"], url: urlFor() });
  assert.equal(empty.status, 200);
  assert.deepEqual(json(empty), { rev: 0, state: {}, updatedAt: null });

  const first = await patchScreen("chats", { rev: 0, viewMode: "cards" });
  assert.equal(first.status, 200);
  assert.equal(json(first).rev, 1);
  assert.deepEqual(json(first).state, { viewMode: "cards" });

  const second = await patchScreen("chats", { rev: 1, state: { pageSize: 30 } });
  assert.equal(second.status, 200);
  assert.equal(json(second).rev, 2);
  assert.deepEqual(json(second).state, { viewMode: "cards", pageSize: 30 });

  const stale = await patchScreen("chats", { rev: 1, pageSize: 40 });
  assert.equal(stale.status, 409);
  assert.equal(json(stale).code, "REVISION_CONFLICT");
  assert.equal(json(stale).rev, 2);
  assert.equal(json(stale).currentRev, 2);

  const current = fakeRes();
  apiScreenStateGet({ res: current, params: ["chats"], url: urlFor() });
  assert.deepEqual(json(current).state, { viewMode: "cards", pageSize: 30 });
  assert.equal(json(current).rev, 2);
});

test("screen-state-http: erros de estado, tamanho, JSON e validacao", async () => {
  const tooLarge = await patchScreen("deploy", { rev: 0, config: { texto: "x".repeat(70000) } });
  assert.equal(tooLarge.status, 413);
  assert.equal(json(tooLarge).code, "STATE_TOO_LARGE");

  const badJson = fakeRes();
  await apiScreenStatePatch({ req: fakeReqRaw("{nao-e-json"), res: badJson, params: ["deploy"], url: urlFor() });
  assert.equal(badJson.status, 400);
  assert.equal(json(badJson).code, "INVALID_JSON");

  const badShape = await patchScreen("deploy", { state: [] });
  assert.equal(badShape.status, 400);
  assert.equal(json(badShape).code, "INVALID_STATE");

  const unknownScreen = fakeRes();
  apiScreenStateGet({ res: unknownScreen, params: ["nao-existe"], url: urlFor() });
  assert.equal(unknownScreen.status, 404);

  const noProject = fakeRes();
  apiScreenStateGet({ res: noProject, params: ["chats"], url: urlFor(null) });
  assert.equal(noProject.status, 400);

  const unknownProject = fakeRes();
  apiScreenStateGet({ res: unknownProject, params: ["chats"], url: urlFor("nao-existe") });
  assert.equal(unknownProject.status, 404);
});

test("screen-state-http: historico grava acao e le com limite", async () => {
  const first = fakeRes();
  await apiScreenHistoryPost({
    req: fakeReq({ acao: "abrir", alvo: "cartao", ts: "2026-10-22T10:00:00.000Z" }),
    res: first,
    params: ["board"],
    url: urlFor(),
  });
  assert.equal(first.status, 200);
  assert.equal(json(first).total, 1);
  assert.deepEqual(json(first).entry, { acao: "abrir", alvo: "cartao", ts: "2026-10-22T10:00:00.000Z" });

  const second = fakeRes();
  await apiScreenHistoryPost({
    req: fakeReq({ acao: "filtrar", alvo: "sprint", ts: "2026-10-22T10:01:00.000Z" }),
    res: second,
    params: ["board"],
    url: urlFor(),
  });
  assert.equal(second.status, 200);
  assert.equal(json(second).total, 2);

  const list = fakeRes();
  apiScreenHistoryGet({ res: list, params: ["board"], url: urlFor(SLUG, "&limit=1") });
  assert.equal(list.status, 200);
  assert.equal(json(list).total, 2);
  assert.deepEqual(json(list).history, [
    { acao: "filtrar", alvo: "sprint", ts: "2026-10-22T10:01:00.000Z" },
  ]);

  const invalid = fakeRes();
  await apiScreenHistoryPost({
    req: fakeReq({ acao: "", alvo: "x", ts: "1" }),
    res: invalid,
    params: ["board"],
    url: urlFor(),
  });
  assert.equal(invalid.status, 400);
  assert.equal(json(invalid).code, "INVALID_HISTORY");

  const historyFile = path.join(PROJECTS, SLUG, "ui-state", "board.history.jsonl");
  assert.equal(fs.existsSync(historyFile), true);
  assert.equal(fs.readFileSync(historyFile, "utf8").split(/\r?\n/).filter(Boolean).length, 2);
});

test("screen-state-http: rotas registradas, arquivos enxutos, MAPA e gitignore", () => {
  const matches = (route, routePath) => (typeof route.path === "string" ? route.path === routePath : route.path.test(routePath));
  const find = (routes, method, routePath) => routes.find((route) => route.method === method && matches(route, routePath));
  assert.equal(find(screensRoutes, "GET", "/api/screens")?.handler?.name, "apiScreensCatalog");
  assert.equal(find(screensRoutes, "GET", "/api/screens/chats/state")?.handler?.name, "apiScreenStateGet");
  assert.equal(find(screensRoutes, "PATCH", "/api/screens/chats/state")?.handler?.name, "apiScreenStatePatch");
  assert.equal(find(screensRoutes, "GET", "/api/screens/chats/history")?.handler?.name, "apiScreenHistoryGet");
  assert.equal(find(screensRoutes, "POST", "/api/screens/chats/history")?.handler?.name, "apiScreenHistoryPost");
  assert.equal(find(ROUTES, "GET", "/api/screens/chats/state")?.handler?.name, "apiScreenStateGet");

  const routerSource = fs.readFileSync(path.join(__dirname, "..", "ui/server/router.js"), "utf8");
  assert.match(routerSource, /screensRoutes/);

  const files = [
    "ui/server/services/screen-state/store.js",
    "ui/server/controllers/screen-state.controller.js",
    "ui/server/routes/screens.routes.js",
    "tests/screen-state-store.test.js",
    "tests/screen-state-http.test.js",
    "ui/server/router.js",
  ];
  for (const file of files) {
    const text = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.ok(text.split(/\r?\n/).length < 300, `${file} passou de 300 linhas`);
    assert.equal(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text), false, `${file} contém emoji`);
  }

  const gitignore = fs.readFileSync(path.join(__dirname, "..", ".gitignore"), "utf8");
  assert.match(gitignore, /global\/ui-state\//);
  assert.match(gitignore, /projects\/\*\/ui-state\//);

  const mapa = fs.readFileSync(path.join(__dirname, "..", "MAPA.md"), "utf8");
  assert.match(mapa, /screen-state\/store\.js/);
  assert.match(mapa, /screen-state\.controller\.js/);
  assert.match(mapa, /screens\.routes\.js/);
});
