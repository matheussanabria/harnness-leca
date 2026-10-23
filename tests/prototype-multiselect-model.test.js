const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { pathToFileURL } = require("url");

const load = () => import(pathToFileURL(path.resolve(__dirname, "..", "ui", "public", "js", "modules", "prototype-multiselect-model.js")).href);

const n = (pid, children = []) => ({ pid, children });
const tree = [n("a", [n("a1"), n("a2"), n("a3")]), n("b", [n("b1")]), n("c")];

test("applyClick: clique simples limpa a seleção múltipla e vira âncora", async () => {
  const { applyClick } = await load();
  assert.deepEqual(applyClick({ pids: ["a1", "a2"], anchor: "a2" }, { pid: "b" }, tree), { pids: [], anchor: "b" });
});

test("applyClick: Ctrl alterna e começa a partir do elemento já selecionado", async () => {
  const { applyClick } = await load();
  let s = applyClick({ pids: [], anchor: "a1" }, { pid: "a3", ctrl: true }, tree);
  assert.deepEqual(s.pids, ["a1", "a3"]);
  s = applyClick(s, { pid: "a2", ctrl: true }, tree);
  assert.deepEqual(s.pids, ["a1", "a2", "a3"]);
  s = applyClick(s, { pid: "a1", ctrl: true }, tree);
  assert.deepEqual(s.pids, ["a2", "a3"]);
});

test("applyClick: Shift pega o intervalo em ordem de documento e mantém só os de cima", async () => {
  const { applyClick } = await load();
  assert.deepEqual(applyClick({ pids: [], anchor: "a1" }, { pid: "a3", shift: true }, tree).pids, ["a1", "a2", "a3"]);
  assert.deepEqual(applyClick({ pids: [], anchor: "a2" }, { pid: "c", shift: true }, tree).pids, ["a2", "a3", "b", "c"]);
  assert.deepEqual(applyClick({ pids: [], anchor: "c" }, { pid: "a2", shift: true }, tree).pids, ["a2", "a3", "b", "c"]);
});

test("canGroup: precisa de 2+ irmãos, sem aninhamento", async () => {
  const { canGroup } = await load();
  assert.equal(canGroup(tree, ["a1"]).ok, false);
  assert.equal(canGroup(tree, ["a1", "a3"]).ok, true);
  assert.equal(canGroup(tree, ["a", "c"]).ok, true);
  assert.match(canGroup(tree, ["a1", "b1"]).reason, /mesmo bloco/);
  assert.match(canGroup(tree, ["a", "a1"]).reason, /dentro de outro/);
});

test("groupShortcut e isGroupNode", async () => {
  const { groupShortcut, isGroupNode, selectionLabel, canGroup } = await load();
  assert.equal(groupShortcut({ key: "g", ctrlKey: true }), "group");
  assert.equal(groupShortcut({ key: "G", metaKey: true, shiftKey: true }), "ungroup");
  assert.equal(groupShortcut({ key: "g" }), null);
  assert.equal(isGroupNode({ attrs: { "data-group": "true" } }), true);
  assert.equal(isGroupNode({ attrs: {} }), false);
  assert.equal(selectionLabel(1, { ok: false }), "");
  assert.equal(selectionLabel(3, canGroup(tree, ["a1", "a2", "a3"])), "3 selecionados");
});
