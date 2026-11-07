// @ts-check
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-canvas-kinds-"));
const PROJECTS = path.join(ROOT, "projects");
const SLUG = "projeto-teste";
process.env.HARNESS_ROOT = ROOT;
process.env.HARNESS_PROJECTS_DIR = PROJECTS;
fs.mkdirSync(path.join(PROJECTS, SLUG), { recursive: true });

const store = require("../ui/server/services/canvas/canvas-store");
const { KINDS, MAX_DIAGRAM_SOURCE_BYTES } = require("../ui/server/services/canvas/canvas-kinds");
const { apiCanvasBoardCreate, apiCanvasBoardUpdate } = require("../ui/server/controllers/canvas.controller");

test.after(() => {
  fs.rmSync(ROOT, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

const DIAGRAM = { schema: "mermaid@1", diagramType: "flowchart-v2", source: "flowchart TD\n A --> B" };
const FLOW = {
  schema: "flow@1",
  purpose: "doc",
  graph: { nodes: [{ id: "n1", type: "start", label: "Inicio", params: {} }], edges: [] },
  layout: { positions: { n1: { x: 0, y: 0 } }, viewport: { x: 0, y: 0, zoom: 1 } },
};
const SAMPLES = { diagram: DIAGRAM, flow: FLOW };

const expectError = (fn, code, status) =>
  assert.throws(fn, (error) => {
    assert.equal(error.name, "CanvasError");
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  });

test("the registry lists the four kinds", () => {
  assert.deepEqual([...KINDS], ["board", "mindmap", "diagram", "flow"]);
});

for (const kind of ["diagram", "flow"]) {
  test(`${kind}: create, read, update with rev and delete round-trip`, () => {
    const created = store.createBoard(SLUG, { kind, title: `Novo ${kind}`, data: SAMPLES[kind] });
    assert.equal(created.kind, kind);
    assert.equal(created.rev, 1);
    assert.deepEqual(store.readBoard(SLUG, created.id).data, SAMPLES[kind]);

    const next = { ...SAMPLES[kind], extra: "preservado" };
    const updated = store.updateBoard(SLUG, created.id, { rev: 1, data: next });
    assert.equal(updated.rev, 2);
    assert.deepEqual(store.readBoard(SLUG, created.id).data, next);
    assert.ok(store.listBoards(SLUG).boards.some((board) => board.id === created.id && board.kind === kind));

    store.deleteBoard(SLUG, created.id);
    expectError(() => store.readBoard(SLUG, created.id), "BOARD_NOT_FOUND", 404);
  });

  test(`${kind}: a blank board without data is accepted on create`, () => {
    const created = store.createBoard(SLUG, { kind, title: `Vazio ${kind}` });
    assert.deepEqual(created.data, {});
    assert.deepEqual(store.createBoard(SLUG, { kind, title: `Vazio 2 ${kind}`, data: {} }).data, {});
  });

  test(`${kind}: the other editor's format is refused with INVALID_SCHEMA`, () => {
    const other = SAMPLES[kind === "diagram" ? "flow" : "diagram"];
    expectError(() => store.createBoard(SLUG, { kind, title: "Errado", data: other }), "INVALID_SCHEMA", 400);
    expectError(() => store.createBoard(SLUG, { kind, title: "Errado", data: { schema: "excalidraw@1", elements: [] } }), "INVALID_SCHEMA", 400);
  });

  test(`${kind}: update refuses a wrong shape and blank data, and keeps the stored board`, () => {
    const created = store.createBoard(SLUG, { kind, title: `Estavel ${kind}`, data: SAMPLES[kind] });
    expectError(() => store.updateBoard(SLUG, created.id, { rev: 1, data: {} }), "INVALID_SCHEMA", 400);
    expectError(() => store.updateBoard(SLUG, created.id, { rev: 1, data: { schema: "x@1" } }), "INVALID_SCHEMA", 400);
    const after = store.readBoard(SLUG, created.id);
    assert.equal(after.rev, 1);
    assert.deepEqual(after.data, SAMPLES[kind]);
  });
}

test("diagram: source must be a string within 64 KB and diagramType a short name", () => {
  const make = (patch) => () => store.createBoard(SLUG, { kind: "diagram", title: "Limite", data: { ...DIAGRAM, ...patch } });
  expectError(make({ source: 42 }), "INVALID_SCHEMA", 400);
  expectError(make({ diagramType: "" }), "INVALID_SCHEMA", 400);
  expectError(make({ diagramType: "x".repeat(41) }), "INVALID_SCHEMA", 400);
  expectError(make({ source: "x".repeat(MAX_DIAGRAM_SOURCE_BYTES + 1) }), "INVALID_SCHEMA", 400);
  assert.equal(make({ source: "x".repeat(MAX_DIAGRAM_SOURCE_BYTES) })().kind, "diagram");
});

test("flow: graph.nodes and graph.edges must be arrays and layout an object when present", () => {
  const make = (data) => () => store.createBoard(SLUG, { kind: "flow", title: "Grafo", data });
  expectError(make({ ...FLOW, graph: { nodes: [] } }), "INVALID_SCHEMA", 400);
  expectError(make({ ...FLOW, graph: { nodes: {}, edges: [] } }), "INVALID_SCHEMA", 400);
  expectError(make({ ...FLOW, graph: null }), "INVALID_SCHEMA", 400);
  expectError(make({ ...FLOW, layout: [] }), "INVALID_SCHEMA", 400);
  const { layout, ...withoutLayout } = FLOW;
  assert.equal(make(withoutLayout)().kind, "flow");
});

test("existing kinds keep opaque data and an unknown kind is still INVALID_KIND", () => {
  assert.equal(store.createBoard(SLUG, { kind: "board", title: "Livre", data: { qualquer: 1 } }).kind, "board");
  assert.equal(store.createBoard(SLUG, { kind: "mindmap", title: "Mapa", data: { qualquer: 1 } }).kind, "mindmap");
  expectError(() => store.createBoard(SLUG, { kind: "note", title: "Ruim" }), "INVALID_KIND", 400);
});

function call(handler, body, params = []) {
  const res = {
    headersSent: false,
    writableEnded: false,
    status: 0,
    body: "",
    setHeader() {},
    writeHead(code) { this.status = code; this.headersSent = true; },
    end(text) { this.body = text; this.writableEnded = true; },
  };
  const url = new URL(`http://127.0.0.1/api?project=${SLUG}`);
  return handler({ req: Readable.from([JSON.stringify(body)]), res, params, url }).then(() => res);
}

test("http: wrong schema returns 400 INVALID_SCHEMA with the kind and no path", async () => {
  const res = await call(apiCanvasBoardCreate, { project: SLUG, kind: "flow", title: "Via HTTP", data: DIAGRAM });
  assert.equal(res.status, 400);
  const body = JSON.parse(res.body);
  assert.equal(body.code, "INVALID_SCHEMA");
  assert.ok(!/[A-Za-z]:\\|\/tmp/.test(res.body));
});

test("http: a diagram is created with 201 and updated with the current rev", async () => {
  const created = await call(apiCanvasBoardCreate, { project: SLUG, kind: "diagram", title: "Via HTTP", data: DIAGRAM });
  assert.equal(created.status, 201);
  const board = JSON.parse(created.body).board;
  const updated = await call(apiCanvasBoardUpdate, { rev: board.rev, data: { ...DIAGRAM, source: "flowchart TD\n A --> C" } }, [board.id]);
  assert.equal(updated.status, 200);
  assert.equal(JSON.parse(updated.body).board.rev, 2);
  const refused = await call(apiCanvasBoardUpdate, { rev: 2, data: FLOW }, [board.id]);
  assert.equal(refused.status, 400);
  assert.equal(JSON.parse(refused.body).code, "INVALID_SCHEMA");
});
