// @ts-check
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-canvas-http-"));
const PROJECTS = path.join(ROOT, "projects");
const SLUG = "projeto-teste";
process.env.HARNESS_ROOT = ROOT;
process.env.HARNESS_PROJECTS_DIR = PROJECTS;
fs.mkdirSync(path.join(PROJECTS, SLUG), { recursive: true });
fs.mkdirSync(path.join(PROJECTS, "projeto-b"), { recursive: true });

const {
  apiCanvasBoardsList,
  apiCanvasBoardCreate,
  apiCanvasBoardGet,
  apiCanvasBoardUpdate,
  apiCanvasBoardDelete,
} = require("../ui/server/controllers/canvas.controller");
const { canvasRoutes } = require("../ui/server/routes/canvas.routes");

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

function findRoute(method, routePath) {
  return canvasRoutes.find((route) => {
    if (route.method !== method) return false;
    return typeof route.path === "string" ? route.path === routePath : route.path.test(routePath);
  });
}

async function invoke(method, routePath, options = {}) {
  const route = findRoute(method, routePath);
  assert.ok(route, `rota ${method} ${routePath} deve existir`);
  const match = typeof route.path === "string" ? null : routePath.match(route.path);
  const params = match ? match.slice(1) : [];
  const res = fakeRes();
  const url = options.url !== undefined ? options.url : urlFor(options.queryProject !== undefined ? options.queryProject : SLUG);
  await route.handler({ req: options.req, res, params, url });
  return res;
}

function assertNoPath(res) {
  const raw = res.body || "";
  assert.ok(!/(?:[A-Za-z]:\\|\/(?:home|tmp|Users|var|projects)\b)/.test(raw), `erro expoe caminho: ${raw}`);
}

test("canvas-http: five routes are registered in canvasRoutes", () => {
  assert.equal(findRoute("GET", "/api/canvas/boards")?.handler?.name, "apiCanvasBoardsList");
  assert.equal(findRoute("POST", "/api/canvas/boards")?.handler?.name, "apiCanvasBoardCreate");
  assert.equal(findRoute("GET", "/api/canvas/boards/b1")?.handler?.name, "apiCanvasBoardGet");
  assert.equal(findRoute("PUT", "/api/canvas/boards/b1")?.handler?.name, "apiCanvasBoardUpdate");
  assert.equal(findRoute("DELETE", "/api/canvas/boards/b1")?.handler?.name, "apiCanvasBoardDelete");
});

test("canvas-http: POST /api/canvas/boards creates a board with rev 1", async () => {
  const res = await invoke("POST", "/api/canvas/boards", {
    req: fakeReq({ project: SLUG, kind: "board", title: "Quadro A" }),
  });
  assert.equal(res.status, 201);
  const body = json(res);
  assert.equal(body.board.title, "Quadro A");
  assert.equal(body.board.rev, 1);
  assert.ok(body.board.id);
});

test("canvas-http: list, get one, update with current rev, conflict with stale rev", async () => {
  const created = await invoke("POST", "/api/canvas/boards", {
    req: fakeReq({ project: SLUG, kind: "board", title: "Quadro B" }),
  });
  const id = json(created).board.id;

  const list = await invoke("GET", "/api/canvas/boards");
  assert.equal(list.status, 200);
  const boards = json(list).boards;
  assert.ok(Array.isArray(boards));
  assert.ok(boards.some((board) => board.id === id && board.title === "Quadro B"));

  const one = await invoke("GET", `/api/canvas/boards/${id}`);
  assert.equal(one.status, 200);
  assert.equal(json(one).board.id, id);

  const updated = await invoke("PUT", `/api/canvas/boards/${id}`, {
    req: fakeReq({ project: SLUG, kind: "board", rev: 1, title: "Quadro B2" }),
  });
  assert.equal(updated.status, 200);
  assert.equal(json(updated).board.rev, 2);
  assert.equal(json(updated).board.title, "Quadro B2");

  const stale = await invoke("PUT", `/api/canvas/boards/${id}`, {
    req: fakeReq({ project: SLUG, kind: "board", rev: 1, title: "atrasado" }),
  });
  assert.equal(stale.status, 409);
  const staleBody = json(stale);
  assert.equal(staleBody.code, "REVISION_CONFLICT");
  assert.equal(staleBody.currentRev, 2);
  assert.equal(typeof staleBody.error, "string");
  assertNoPath(stale);
});

test("canvas-http: DELETE then GET returns 404 BOARD_NOT_FOUND", async () => {
  const created = await invoke("POST", "/api/canvas/boards", {
    req: fakeReq({ project: SLUG, kind: "board", title: "Quadro C" }),
  });
  const id = json(created).board.id;

  const removed = await invoke("DELETE", `/api/canvas/boards/${id}`);
  assert.equal(removed.status, 200);
  assert.deepEqual(json(removed), { ok: true, id });

  const gone = await invoke("GET", `/api/canvas/boards/${id}`);
  assert.equal(gone.status, 404);
  const goneBody = json(gone);
  assert.equal(goneBody.code, "BOARD_NOT_FOUND");
  assert.equal(typeof goneBody.error, "string");
  assertNoPath(gone);
});

test("canvas-http: invalid JSON body returns 400 INVALID_JSON", async () => {
  const res = await invoke("POST", "/api/canvas/boards", {
    req: fakeReqRaw("{nao-e-json"),
  });
  assert.equal(res.status, 400);
  assert.equal(json(res).code, "INVALID_JSON");
  assert.equal(typeof json(res).error, "string");
  assertNoPath(res);
});

test("canvas-http: body over 5 MB returns 413 BOARD_TOO_LARGE", async () => {
  const big = JSON.stringify({ project: SLUG, title: "x", payload: "p".repeat(5 * 1024 * 1024 + 10) });
  const res = await invoke("POST", "/api/canvas/boards", { req: fakeReqRaw(big) });
  assert.equal(res.status, 413);
  const tooLargeBody = json(res);
  assert.equal(tooLargeBody.code, "BOARD_TOO_LARGE");
  assert.equal(typeof tooLargeBody.error, "string");
  assertNoPath(res);
});

test("canvas-http: missing project returns 400 PROJECT_REQUIRED", async () => {
  const res = await invoke("POST", "/api/canvas/boards", {
    req: fakeReq({ title: "Sem projeto" }),
    queryProject: null,
  });
  assert.equal(res.status, 400);
  const missingBody = json(res);
  assert.equal(missingBody.code, "PROJECT_REQUIRED");
  assert.equal(typeof missingBody.error, "string");
  assertNoPath(res);
});

test("canvas-http: project in the query string wins over the body field", async () => {
  const res = await invoke("POST", "/api/canvas/boards", {
    req: fakeReq({ project: SLUG, kind: "board", title: "Quadro Q" }),
    queryProject: "projeto-b",
  });
  assert.equal(res.status, 201, `status=${res.status} body=${res.body}`);
  const queryList = await invoke("GET", "/api/canvas/boards", { queryProject: "projeto-b" });
  const queryBoards = json(queryList).boards;
  assert.ok(queryBoards.some((board) => board.title === "Quadro Q"));
  const bodyList = await invoke("GET", "/api/canvas/boards");
  assert.ok(!json(bodyList).boards.some((board) => board.title === "Quadro Q"));
});
