// @ts-check
// Unit tests for the Design workspace canvas catalog (API client + pure list markup), no DOM library.
import test from "node:test";
import assert from "node:assert/strict";
import { createCanvasApi } from "../ui/public/js/modules/design-canvas-api.js";
import { canvasCatalogHtml } from "../ui/public/js/modules/design-canvas-catalog.js";

/** @param {unknown} data @param {number} [status] */
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

/** @param {(url: string, init?: RequestInit) => Promise<Response>} handler */
function recorder(handler) {
  /** @type {Array<{ url: string, init: RequestInit }>} */
  const calls = [];
  /** @param {string} url @param {RequestInit} [init] */
  const fetcher = async (url, init = {}) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  return { fetcher, calls };
}

const BOARD = {
  id: "b1",
  title: "Meu quadro",
  kind: "board",
  rev: 3,
  updatedAt: "2026-11-04T15:30:00.000Z",
  data: { schema: "excalidraw@1", elements: [{ id: "e1" }], appState: {}, files: {} },
};

test("api: list keeps only the requested kind and sorts newest updatedAt first", async () => {
  const { fetcher, calls } = recorder(() => json({
    boards: [
      { id: "a", title: "A", kind: "mindmap", rev: 1, updatedAt: "2026-11-01T10:00:00.000Z" },
      { id: "b", title: "B", kind: "board", rev: 1, updatedAt: "2026-11-03T10:00:00.000Z" },
      { id: "c", title: "C", kind: "mindmap", rev: 2, updatedAt: "2026-11-04T10:00:00.000Z" },
    ],
  }));
  const api = createCanvasApi("my proj", fetcher);
  const boards = await api.list("mindmap");
  assert.deepEqual(boards.map((board) => board.id), ["c", "a"]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/canvas/boards?project=my%20proj");
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
});

test("api: create posts the mindmap starter document with a fresh root id", async () => {
  const { fetcher, calls } = recorder(() => json({ board: { ...BOARD, kind: "mindmap" } }, 201));
  const api = createCanvasApi("demo", fetcher);
  await api.create("mindmap", "Mapa novo");
  const init = calls[0].init;
  assert.equal(init.method, "POST");
  assert.equal(init.headers["Content-Type"], "application/json");
  const body = JSON.parse(String(init.body));
  assert.equal(body.kind, "mindmap");
  assert.equal(body.title, "Mapa novo");
  assert.equal(body.data.schema, "mindmap@1");
  assert.equal(body.data.nodes.length, 1);
  assert.equal(body.data.nodes[0].text, "Mapa novo");
  assert.deepEqual(body.data.nodes[0].children, []);
  assert.equal(body.data.nodes[0].collapsed, false);
  assert.equal(body.data.nodes[0].id, body.data.rootId);
  assert.match(body.data.rootId, /^[0-9a-f-]{36}$/);
});

test("api: create posts the excalidraw starter document for a board", async () => {
  const { fetcher, calls } = recorder(() => json({ board: BOARD }, 201));
  const api = createCanvasApi("demo", fetcher);
  await api.create("board", "Quadro novo");
  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(body.kind, "board");
  assert.deepEqual(body.data, { schema: "excalidraw@1", elements: [], appState: {}, files: {} });
});

test("api: rename does GET then PUT with the current data and rev, retrying once on 409", async () => {
  let puts = 0;
  /** @type {Array<{ url: string, method: string, body?: string }>} */
  const seen = [];
  const fetcher = async (url, init = {}) => {
    const method = init.method || "GET";
    seen.push({ url, method, body: /** @type {string | undefined} */ (init.body) });
    if (method === "GET") return json({ board: { ...BOARD, rev: puts === 0 ? 3 : 4 } });
    puts += 1;
    if (puts === 1) return json({ error: "Revisao desatualizada.", code: "REVISION_CONFLICT", currentRev: 4 }, 409);
    return json({ board: { ...BOARD, title: "Novo", rev: 5 } });
  };
  const api = createCanvasApi("demo", fetcher);
  const result = await api.rename("b1", "Novo");
  assert.equal(result.title, "Novo");
  assert.deepEqual(seen.map((call) => call.method), ["GET", "PUT", "GET", "PUT"]);
  const firstPut = JSON.parse(String(seen[1].body));
  assert.equal(firstPut.title, "Novo");
  assert.equal(firstPut.rev, 3);
  assert.deepEqual(firstPut.data, BOARD.data);
  const secondPut = JSON.parse(String(seen[3].body));
  assert.equal(secondPut.rev, 4);
  assert.deepEqual(secondPut.data, BOARD.data);
});

test("api: remove sends DELETE with a JSON content type", async () => {
  const { fetcher, calls } = recorder(() => json({ ok: true, id: "b1" }));
  const api = createCanvasApi("demo", fetcher);
  await api.remove("b1");
  assert.equal(calls[0].init.method, "DELETE");
  assert.equal(calls[0].url, "/api/canvas/boards/b1?project=demo");
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
});

test("api: a non-OK answer throws the server error text", async () => {
  const api = createCanvasApi("demo", async () => json({ error: "Board nao encontrado: x", code: "BOARD_NOT_FOUND" }, 404));
  await assert.rejects(api.list("mindmap"), /Board nao encontrado: x/);
});

test("api: a non-OK answer without an error field falls back to the status text", async () => {
  const api = createCanvasApi("demo", async () => new Response("nope", { status: 500 }));
  await assert.rejects(api.list("mindmap"), /Falha na requisição \(500\)/);
});

const ITEMS = [
  { id: "b1", title: "Meu quadro", kind: "board", rev: 3, updatedAt: "2026-11-04T15:30:00.000Z" },
  { id: "b2", title: "Outro", kind: "board", rev: 1, updatedAt: "2026-11-02T08:05:00.000Z" },
];

test("html: escapes a title in the card and its aria-labels", () => {
  const evil = '<img src=x onerror=1>';
  const html = canvasCatalogHtml([{ ...ITEMS[0], title: evil }], { kind: "board" });
  assert.equal(html.includes("<img src=x"), false);
  assert.equal(html.includes("&lt;img src=x onerror=1&gt;"), true);
});

test("html: marks only the selected card active", () => {
  const html = canvasCatalogHtml(ITEMS, { kind: "board", selectedId: "b1" });
  assert.equal(html.includes('class="proto-item-card active" data-canvas-id="b1"'), true);
  assert.equal(html.includes('class="proto-item-card" data-canvas-id="b2"'), true);
});

test("html: rename state renders an input with save and cancel instead of the card", () => {
  const html = canvasCatalogHtml(ITEMS, { kind: "board", renamingId: "b1" });
  assert.match(html, /type="text" class="canvas-rename-input"/);
  assert.match(html, /data-canvas-rename-input="b1"/);
  assert.match(html, /value="Meu quadro"/);
  assert.match(html, /data-canvas-rename-save="b1"/);
  assert.match(html, /data-canvas-rename-cancel="b1"/);
  // Only the renamed item swaps its card for the input; the other card keeps its delete button.
  assert.equal(html.includes('data-canvas-delete="b1"'), false);
  assert.equal(html.includes('data-canvas-delete="b2"'), true);
});

test("html: confirming state renders the delete question with confirm and cancel", () => {
  const html = canvasCatalogHtml(ITEMS, { kind: "board", confirmingId: "b1" });
  assert.match(html, /<strong>Excluir\?<\/strong>/);
  assert.match(html, /data-canvas-confirm="b1"/);
  assert.match(html, /data-canvas-cancel="b1"/);
  assert.equal(html.includes("canvas-rename-input"), false);
});

test("html: empty state text and section title for both kinds", () => {
  const mindmap = canvasCatalogHtml([], { kind: "mindmap" });
  assert.match(mindmap, /Mapas mentais do projeto \(0\)/);
  assert.match(mindmap, /Nenhum mapa mental no projeto\./);
  const board = canvasCatalogHtml([], { kind: "board" });
  assert.match(board, /Quadros do projeto \(0\)/);
  assert.match(board, /Nenhum quadro no projeto\./);
});

test("html: updatedAt is fixed in UTC, independent of the machine timezone", () => {
  // 02:30 UTC would already be the previous day in UTC-3 (America/Sao_Paulo), so this pins UTC formatting.
  const html = canvasCatalogHtml(
    [{ id: "b1", title: "Q", kind: "board", rev: 1, updatedAt: "2026-11-04T02:30:00.000Z" }],
    { kind: "board" },
  );
  assert.match(html, /Atualizado 04\/11\/2026 02:30/);
  const midday = canvasCatalogHtml(ITEMS, { kind: "board" });
  assert.match(midday, /Atualizado 04\/11\/2026 15:30/);
});