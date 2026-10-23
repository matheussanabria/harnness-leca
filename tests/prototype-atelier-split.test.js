// @ts-check
// Regressão da divisão do prototype-atelier.js: o estado vive em `ctx` e a seleção múltipla e as mensagens do iframe
// moram em módulos próprios. Roda os módulos de verdade, com um DOM mínimo.
import test from "node:test";
import assert from "node:assert/strict";

const listeners = {};
const elements = new Map();
const makeElement = () => ({
  hidden: false, disabled: false, title: "", textContent: "", innerHTML: "", value: "", style: {}, dataset: {}, onclick: null,
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  querySelector: () => null, querySelectorAll: () => [], closest: () => null, setAttribute() {}, removeAttribute() {},
  appendChild() {}, addEventListener() {}, scrollIntoView() {},
});
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = globalThis;
globalThis.addEventListener = (type, fn) => { listeners[type] = fn; };
globalThis.document = {
  body: { classList: { add() {}, remove() {}, contains: () => false, toggle() {} } },
  getElementById: (id) => { if (!elements.has(id)) elements.set(id, makeElement()); return elements.get(id); },
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  removeEventListener() {},
  createElement: makeElement,
};

const { ctx, host } = await import("../ui/public/js/modules/prototype-atelier-ctx.js");
const multi = await import("../ui/public/js/modules/prototype-atelier-multi.js");
const messages = await import("../ui/public/js/modules/prototype-atelier-messages.js");

const posted = [];
Object.assign(host, {
  post: (message) => posted.push(message),
  reload: () => posted.push({ type: "reload" }),
  details: () => posted.push({ type: "details" }),
  move: (pid, target, position) => posted.push({ type: "move", pid, target, position }),
  tree: (tree) => posted.push({ type: "tree", size: tree.length }),
});

const reset = () => {
  posted.length = 0;
  ctx.multi = { pids: [], anchor: "" };
  ctx.node = null;
  ctx.tree = [];
};

test("módulos extraídos exportam a API que o Ateliê usa", () => {
  for (const name of ["selectSingle", "onMultiClick", "setMulti", "paintSelectionBar", "bindSelectionBar", "runBatch", "runGroupAction", "installHistoryKeys"]) {
    assert.equal(typeof multi[name], "function", name);
  }
  assert.equal(typeof messages.setupBridgeListener, "function");
  assert.deepEqual(Object.keys(ctx).sort(), ["components", "data", "list", "multi", "node", "options", "pendingPid", "protoId", "screen", "slug", "tree", "versions", "viewportWidth"]);
});

test("setMulti grava no contexto, avisa o iframe e limpa com lista vazia", () => {
  reset();
  multi.setMulti(["p-1", "p-2"], "p-1");
  assert.deepEqual(ctx.multi, { pids: ["p-1", "p-2"], anchor: "p-1" });
  assert.deepEqual(posted.at(-1), { type: "HARNESS_PROTO_SET_MULTI", pids: ["p-1", "p-2"] });
  multi.setMulti([], "p-1");
  assert.deepEqual(ctx.multi.pids, []);
  assert.deepEqual(posted.at(-1), { type: "HARNESS_PROTO_SET_MULTI", pids: [] });
});

test("clique simples numa camada com seleção múltipla ativa limpa a múltipla e seleciona só a camada", () => {
  reset();
  multi.setMulti(["p-1", "p-2"], "p-1");
  multi.selectSingle("p-9");
  assert.deepEqual(ctx.multi.pids, []);
  assert.deepEqual(posted.at(-1), { type: "HARNESS_PROTO_SELECT_BY_PID", pid: "p-9" });
});

test("barra de seleção mostra a contagem e some com menos de dois itens", () => {
  reset();
  multi.setMulti(["p-1", "p-2", "p-3"], "p-1");
  assert.equal(elements.get("atelierSelectionBar").hidden, false);
  multi.setMulti([], "");
  assert.equal(elements.get("atelierSelectionBar").hidden, true);
});

test("mensagens do iframe: árvore, seleção, atalho Esc e clique com modificador chegam aos módulos certos", () => {
  reset();
  messages.setupBridgeListener();
  const handler = listeners.message;
  assert.equal(typeof handler, "function", "o ouvinte de mensagens foi registrado");
  messages.setupBridgeListener();

  handler({ data: { type: "HARNESS_PROTO_TREE", tree: [{ pid: "p-1" }, { pid: "p-2" }] } });
  assert.equal(ctx.tree.length, 2);
  assert.deepEqual(posted.at(-1), { type: "tree", size: 2 });

  handler({ data: { type: "HARNESS_PROTO_SELECT", pid: "p-1" } });
  assert.equal(ctx.node.pid, "p-1");
  assert.equal(ctx.multi.anchor, "p-1");

  multi.setMulti(["p-1", "p-2"], "p-1");
  handler({ data: { type: "HARNESS_PROTO_SHORTCUT", action: "clear" } });
  assert.deepEqual(ctx.multi.pids, []);

  handler({ data: { type: "HARNESS_PROTO_REORDER", pid: "p-1", targetPid: "p-2", position: "after" } });
  assert.deepEqual(posted.at(-1), { type: "move", pid: "p-1", target: "p-2", position: "after" });
});

test("pedido de seleção pendente é reenviado quando o iframe fica pronto", async () => {
  reset();
  ctx.pendingPid = "p-7";
  listeners.message({ data: { type: "HARNESS_PROTO_READY" } });
  assert.equal(ctx.pendingPid, "");
  assert.ok(posted.some((m) => m.type === "HARNESS_PROTO_REQUEST_TREE"));
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.deepEqual(posted.at(-1), { type: "HARNESS_PROTO_SELECT_BY_PID", pid: "p-7" });
});
