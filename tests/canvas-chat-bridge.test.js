// @ts-check
// Canvas chat bridge (EP-19.07/19.08): prompt wrapping, <mindmap> extraction and the island events.
import test from "node:test";
import assert from "node:assert/strict";

// The module only needs a window-like event target and a document without the toast element.
const target = new EventTarget();
// @ts-ignore
globalThis.window = target;
// @ts-ignore
globalThis.document = { getElementById: () => null };

const bridge = await import("../ui/public/js/modules/canvas-chat-bridge.js");
const { CANVAS_APPLY_EVENT, CANVAS_STATE_EVENT } = bridge;

const state = (extra = {}) => ({ boardId: "b1", title: "Plano", selectedId: "n1", selectedText: "Backend", outline: "- Plano\n  - Backend", ...extra });
const publish = (detail) => target.dispatchEvent(new CustomEvent(CANVAS_STATE_EVENT, { detail }));

test("without a canvas context the prompt goes through untouched", () => {
  bridge.setCanvasChatContext(null);
  assert.equal(bridge.isCanvasChatActive(), false);
  assert.equal(bridge.wrapCanvasPrompt("oi"), "oi");
});

test("a new session gets the rules, the map and the selected node", () => {
  bridge.setCanvasChatContext({ kind: "mindmap", slug: "demo" });
  publish(state());
  const prompt = bridge.wrapCanvasPrompt("Expanda o backend");
  assert.match(prompt, /<mindmap parent="selected">/);
  assert.match(prompt, /Mapa atual "Plano" \(nó selecionado: "Backend"\):\n- Plano\n {2}- Backend/);
  assert.match(prompt, /Pedido do usuário:\nExpanda o backend$/);
});

test("a resumed session with the same map sends only the request; a changed map sends it again without the rules", () => {
  bridge.setCanvasChatContext({ kind: "mindmap", slug: "demo" });
  publish(state());
  bridge.wrapCanvasPrompt("primeira");
  assert.equal(bridge.wrapCanvasPrompt("segunda", { resumed: true }), "segunda");
  publish(state({ outline: "- Plano\n  - Backend\n  - API" }));
  const changed = bridge.wrapCanvasPrompt("terceira", { resumed: true });
  assert.match(changed, /^O mapa mudou desde a última mensagem\./);
  assert.equal(changed.includes("<mindmap parent"), false, "the rules are not repeated");
  assert.match(changed, /- API/);
});

test("without a published board state the text is not wrapped", () => {
  bridge.setCanvasChatContext({ kind: "mindmap", slug: "demo" });
  publish(null);
  assert.equal(bridge.wrapCanvasPrompt("oi"), "oi");
});

test("extractMindmapBlocks reads mode and parent, defaults to append under the selection, and caps at 3 blocks", () => {
  const text = [
    "Pronto:",
    '<mindmap parent="root">\n- A\n  - B\n</mindmap>',
    '<MINDMAP mode="new">\n- Novo\n</MINDMAP>',
    "<mindmap>\n- Padrão\n</mindmap>",
    '<mindmap parent="root">\n- Quarto\n</mindmap>',
    "<mindmap>\n   \n</mindmap>",
  ].join("\n");
  const blocks = bridge.extractMindmapBlocks(text);
  assert.equal(blocks.length, 3);
  assert.deepEqual(blocks[0], { mode: "append", parent: "root", body: "- A\n  - B" });
  assert.deepEqual(blocks[1], { mode: "new", parent: "selected", body: "- Novo" });
  assert.deepEqual(blocks[2], { mode: "append", parent: "selected", body: "- Padrão" });
});

test("a block with a huge body is capped and an empty block is ignored", () => {
  const big = bridge.extractMindmapBlocks(`<mindmap>\n${"- x\n".repeat(20000)}</mindmap>`);
  assert.equal(big.length, 1);
  assert.ok(big[0].body.length <= 20000);
  assert.deepEqual(bridge.extractMindmapBlocks("<mindmap>\n</mindmap>"), []);
});

test("applyCanvasReply sends the blocks to the island with the board id", () => {
  bridge.setCanvasChatContext({ kind: "mindmap", slug: "demo" });
  publish(state());
  const received = [];
  const listener = (event) => received.push(event.detail);
  target.addEventListener(CANVAS_APPLY_EVENT, listener);
  bridge.applyCanvasReply('Feito.\n<mindmap parent="root">\n- A\n</mindmap>');
  bridge.applyCanvasReply("Só conversa, sem bloco.");
  target.removeEventListener(CANVAS_APPLY_EVENT, listener);
  assert.equal(received.length, 1);
  assert.equal(received[0].boardId, "b1");
  assert.deepEqual(received[0].blocks, [{ mode: "append", parent: "root", body: "- A" }]);
});

test("leaving the canvas mode drops the state: nothing is applied afterwards", () => {
  bridge.setCanvasChatContext({ kind: "mindmap", slug: "demo" });
  publish(state());
  bridge.setCanvasChatContext(null);
  const received = [];
  const listener = (event) => received.push(event.detail);
  target.addEventListener(CANVAS_APPLY_EVENT, listener);
  bridge.applyCanvasReply("<mindmap>\n- A\n</mindmap>");
  target.removeEventListener(CANVAS_APPLY_EVENT, listener);
  assert.deepEqual(received, []);
});
