const test = require("node:test");
const assert = require("node:assert/strict");

const load = () => import("../ui/public/js/modules/prototype-canvas/canvas-model.js");
const loadStore = () => import("../ui/public/js/modules/prototype-canvas/canvas-store.js");

const SCREENS = [{ id: "home", title: "Início" }, { id: "prescricao", title: "Prescrição" }, { id: "autorizacao", title: "Autorização" }];

test("createDoc cria um quadro por tela, lado a lado e sem sobreposição", async () => {
  const { createDoc, FRAME_GAP } = await load();
  const doc = createDoc(SCREENS, 1280);
  const frames = doc.items.filter((i) => i.kind === "frame");
  assert.equal(frames.length, 3);
  assert.deepEqual(frames.map((f) => f.screen), ["home", "prescricao", "autorizacao"]);
  assert.equal(frames[0].x, 0);
  assert.equal(frames[1].x, 1280 + FRAME_GAP);
  assert.equal(frames[2].x, 2 * (1280 + FRAME_GAP));
});

test("syncScreens adiciona só telas novas e preserva posição editada", async () => {
  const { createDoc, syncScreens } = await load();
  const doc = createDoc(SCREENS.slice(0, 2));
  doc.items[0].x = 999;
  syncScreens(doc, SCREENS);
  assert.equal(doc.items.length, 3);
  assert.equal(doc.items[0].x, 999);
  assert.equal(doc.items[2].screen, "autorizacao");
});

test("zoomAt mantém o ponto sob o cursor fixo", async () => {
  const { zoomAt, screenToWorld } = await load();
  const view = { x: 40, y: 30, zoom: 0.5 };
  const before = screenToWorld(view, 300, 200);
  const next = zoomAt(view, 2, 300, 200);
  const after = screenToWorld(next, 300, 200);
  assert.ok(Math.abs(before.x - after.x) < 1e-9);
  assert.ok(Math.abs(before.y - after.y) < 1e-9);
  assert.equal(next.zoom, 1);
});

test("zoom respeita limites mínimo e máximo", async () => {
  const { zoomAt, MIN_ZOOM, MAX_ZOOM } = await load();
  assert.equal(zoomAt({ x: 0, y: 0, zoom: 1 }, 1e6, 0, 0).zoom, MAX_ZOOM);
  assert.equal(zoomAt({ x: 0, y: 0, zoom: 1 }, 1e-6, 0, 0).zoom, MIN_ZOOM);
});

test("fitView enquadra e centraliza o retângulo na área visível", async () => {
  const { fitView, worldToScreen } = await load();
  const bounds = { x: 100, y: 50, w: 2000, h: 1000 };
  const view = fitView(bounds, { w: 1000, h: 600 }, 50);
  assert.ok(view.zoom <= 1 && view.zoom > 0);
  const tl = worldToScreen(view, bounds.x, bounds.y);
  const br = worldToScreen(view, bounds.x + bounds.w, bounds.y + bounds.h);
  assert.ok(tl.x >= 49.9 && br.x <= 950.1 && tl.y >= 49.9 && br.y <= 550.1);
  assert.ok(Math.abs(tl.x - (1000 - br.x)) < 1e-6);
});

test("hitTest devolve o item de maior z; playOrder segue a ordem das telas", async () => {
  const { hitTest, createDoc, playOrder, newItem, bringToFront } = await load();
  const doc = createDoc(SCREENS);
  const rect = newItem(doc, "rect", { x: 10, y: 10 });
  doc.items.push(rect);
  assert.equal(hitTest(doc.items, 20, 20).id, rect.id);
  assert.equal(hitTest(doc.items, -5, -5), null);
  assert.deepEqual(playOrder(doc).map((f) => f.screen), ["home", "prescricao", "autorizacao"]);
  const first = doc.items.find((i) => i.screen === "home");
  bringToFront(doc, first.id);
  assert.equal(hitTest(doc.items, 20, 20).id, first.id);
});

test("neighborFrame anda entre telas sem sair dos limites", async () => {
  const { createDoc, neighborFrame, playOrder } = await load();
  const doc = createDoc(SCREENS);
  const [a, b, c] = playOrder(doc);
  assert.equal(neighborFrame(doc, a.id, 1).id, b.id);
  assert.equal(neighborFrame(doc, c.id, 1).id, c.id);
  assert.equal(neighborFrame(doc, a.id, -1).id, a.id);
});

test("duplicateItem e removeItem mantêm ids únicos", async () => {
  const { createDoc, duplicateItem, removeItem } = await load();
  const doc = createDoc(SCREENS);
  const copy = duplicateItem(doc, doc.items[0].id);
  assert.equal(new Set(doc.items.map((i) => i.id)).size, doc.items.length);
  assert.equal(copy.x, doc.items[0].x + 32);
  removeItem(doc, copy.id);
  assert.equal(doc.items.length, 3);
});

test("parseDoc rejeita lixo e saneia itens inválidos", async () => {
  const { parseDoc } = await load();
  assert.equal(parseDoc("não é json"), null);
  assert.equal(parseDoc({ v: 2, items: [] }), null);
  const doc = parseDoc({ v: 1, view: { zoom: 999 }, items: [{ kind: "rect", x: 1, y: 2, w: 3, h: 4 }, { kind: "ufo", x: 0, y: 0 }, null] });
  assert.equal(doc.items.length, 1);
  assert.equal(doc.view.zoom, 8);
});

test("store grava e lê o documento por projeto/protótipo", async () => {
  const { loadDoc, saveDoc, storageKey } = await loadStore();
  const { createDoc } = await load();
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const doc = createDoc(SCREENS);
  assert.equal(saveDoc("p1", "dis", doc, storage), true);
  assert.ok(mem.has(storageKey("p1", "dis")));
  assert.equal(loadDoc("p1", "dis", storage).items.length, 3);
  assert.equal(loadDoc("p1", "outro", storage), null);
  assert.equal(saveDoc("p1", "dis", doc, { setItem() { throw new Error("cheio"); } }), false);
});

test("buildCodePreview só renderiza HTML", async () => {
  const { buildCodePreview } = await load();
  assert.equal(buildCodePreview({ lang: "html", code: "<b>oi</b>" }), "<b>oi</b>");
  assert.equal(buildCodePreview({ lang: "css", code: "a{}" }), "");
});

test("telas novas entram em grade de 6 colunas e playOrder segue o array", async () => {
  const { createDoc, gridSlot, playOrder, GRID_COLUMNS } = await load();
  const many = Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, title: `S${i}` }));
  const doc = createDoc(many);
  const frames = playOrder(doc);
  assert.equal(frames.length, 8);
  assert.equal(GRID_COLUMNS, 6);
  assert.ok(frames[6].y > frames[0].y, "sétima tela vai para a segunda linha");
  assert.equal(frames[6].x, frames[0].x);
  assert.deepEqual(frames.map((f) => f.screen), many.map((s) => s.id));
  assert.equal(typeof gridSlot(0, 100, 100).x, "number");
});

test("syncSnippets cria um bloco de código por snippet, à direita do quadro, sem duplicar", async () => {
  const { createDoc, syncSnippets, SNIPPET_SIZE } = await load();
  const screens = [
    { id: "button", title: "Button", snippets: [{ name: "Button · HTML", lang: "html", code: "<button></button>" }, { name: "Button · CSS", lang: "css", code: ".b{}" }] },
    { id: "alert", title: "Alert" },
  ];
  const doc = createDoc(screens);
  syncSnippets(doc, screens);
  syncSnippets(doc, screens);
  const blocks = doc.items.filter((i) => i.kind === "code");
  assert.equal(blocks.length, 2);
  const frame = doc.items.find((i) => i.kind === "frame" && i.screen === "button");
  assert.ok(blocks[0].x > frame.x + frame.w);
  assert.equal(blocks[1].x - blocks[0].x, SNIPPET_SIZE.w + SNIPPET_SIZE.gap);
  assert.equal(blocks[0].y, frame.y);
  assert.equal(doc.layout, "rows");
  const alert = doc.items.find((i) => i.kind === "frame" && i.screen === "alert");
  assert.ok(alert.y > frame.y && alert.x === 0);
});
