// EP-21.03: typed client for diagram boards, built on the shared Canvas plumbing (features/canvas/apiBase.ts).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const src = (...parts) => pathToFileURL(path.join(__dirname, "../ui/web/src/features", ...parts)).href;
const load = (...parts) => import(src(...parts));

/** Fetch stub: records calls and answers from a queue of [status, body]. */
function fakeFetch(...answers) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const [status, body] = answers.shift() ?? [200, {}];
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  };
  return { fetchImpl, calls };
}

const DATA = { schema: "mermaid@1", diagramType: "flowchart-v2", source: "flowchart TD\n A-->B" };

test("diagram api: list keeps only diagram boards, scoped to the project", async () => {
  const { createDiagramApi } = await load("diagram", "api.ts");
  const { fetchImpl, calls } = fakeFetch([200, { boards: [
    { id: "1", kind: "diagram", title: "d", rev: 1, updatedAt: "x" },
    { id: "2", kind: "board", title: "b", rev: 1, updatedAt: "x" },
    { id: "3", kind: "mindmap", title: "m", rev: 1, updatedAt: "x" },
  ] }]);
  const list = await createDiagramApi("meu projeto", fetchImpl).list();
  assert.deepEqual(list.map((b) => b.id), ["1"]);
  assert.equal(calls[0].url, "/api/canvas/boards?project=meu%20projeto");
});

test("diagram api: create sends kind diagram, update sends the rev, remove sends JSON content type", async () => {
  const { createDiagramApi } = await load("diagram", "api.ts");
  const { fetchImpl, calls } = fakeFetch(
    [200, { board: { id: "a", kind: "diagram", title: "T", rev: 1, data: DATA } }],
    [200, { board: { id: "a", kind: "diagram", title: "T", rev: 2, data: DATA } }],
    [200, { board: { id: "a", kind: "diagram", title: "T", rev: 2, data: DATA } }],
    [200, { ok: true }],
  );
  const api = createDiagramApi("p", fetchImpl);
  assert.equal((await api.create("T", DATA)).rev, 1);
  assert.deepEqual(JSON.parse(calls[0].init.body), { kind: "diagram", title: "T", data: DATA });
  assert.equal(calls[0].init.method, "POST");

  assert.equal((await api.update("a", { rev: 1, data: DATA })).rev, 2);
  assert.equal(calls[1].url, "/api/canvas/boards/a?project=p");
  assert.equal(calls[1].init.method, "PUT");
  assert.deepEqual(JSON.parse(calls[1].init.body), { rev: 1, data: DATA });

  await api.get("a");
  assert.equal(calls[2].init, undefined);
  await api.remove("a");
  assert.equal(calls[3].init.method, "DELETE");
  assert.equal(calls[3].init.headers["Content-Type"], "application/json");

  const { fetchImpl: bare, calls: bareCalls } = fakeFetch([200, { board: { id: "b", kind: "diagram", rev: 1 } }]);
  await createDiagramApi("p", bare).create("Sem dados");
  assert.deepEqual(JSON.parse(bareCalls[0].init.body), { kind: "diagram", title: "Sem dados" }, "no data key when none is given");
});

test("diagram api: a 409 raises the shared BoardApiError with the current revision", async () => {
  const { createDiagramApi } = await load("diagram", "api.ts");
  const { BoardApiError } = await load("canvas", "apiBase.ts");
  const { fetchImpl } = fakeFetch([409, { error: "revisão desatualizada", code: "REV_CONFLICT", currentRev: 7 }]);
  await assert.rejects(createDiagramApi("p", fetchImpl).update("a", { rev: 3 }), (error) => {
    assert.ok(error instanceof BoardApiError);
    assert.equal(error.isConflict, true);
    assert.equal(error.currentRev, 7);
    assert.equal(error.code, "REV_CONFLICT");
    assert.equal(error.message, "revisão desatualizada");
    return true;
  });
  const broken = async () => new Response("<html>bad gateway</html>", { status: 502 });
  await assert.rejects(createDiagramApi("p", broken).get("a"), (error) => error.status === 502 && error.code === "HTTP_ERROR" && /502/.test(error.message));
});

test("board api keeps its public surface after the extraction (same BoardApiError class, same requests)", async () => {
  const board = await load("board", "api.ts");
  const base = await load("canvas", "apiBase.ts");
  assert.equal(board.BoardApiError, base.BoardApiError, "one error class for board and diagram clients");
  const { fetchImpl, calls } = fakeFetch([200, { boards: [{ id: "1", kind: "board" }, { id: "2", kind: "diagram" }] }], [200, { board: { id: "x" } }]);
  const api = board.createBoardApi("p", fetchImpl);
  assert.deepEqual((await api.list()).map((b) => b.id), ["1"]);
  await api.create("T");
  assert.deepEqual(JSON.parse(calls[1].init.body), { kind: "board", title: "T" });
  assert.equal(api.assetUrl("a b", "f.png"), "/api/canvas/boards/a%20b/assets/f.png?project=p");
});
