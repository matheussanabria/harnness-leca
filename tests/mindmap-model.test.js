// Mind-map model (ui/web/src/features/mindmap). Node 24 strips types, so the .ts sources are imported directly.
const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const dir = path.join(__dirname, "..", "ui", "web", "src", "features", "mindmap");
const load = (name) => import(pathToFileURL(path.join(dir, name)).href);

async function fixture() {
  const [tree, cmd] = await Promise.all([load("tree.ts"), load("commands.ts")]);
  // r -> a(a1, a2), b
  let doc = tree.createDoc("r", "Root");
  doc = cmd.addChild(doc, "r", "a", "A");
  doc = cmd.addChild(doc, "r", "b", "B");
  doc = cmd.addChild(doc, "a", "a1", "A1");
  doc = cmd.addChild(doc, "a", "a2", "A2");
  return { tree, cmd, doc };
}

test("addChild appends, expands the parent and is immutable", async () => {
  const { cmd, doc } = await fixture();
  assert.deepEqual(doc.nodes.r.children, ["a", "b"]);
  const collapsed = cmd.toggleCollapse(doc, "a");
  const next = cmd.addChild(collapsed, "a", "a3");
  assert.equal(next.nodes.a.collapsed, false);
  assert.equal(collapsed.nodes.a.collapsed, true);
  assert.equal(cmd.addChild(doc, "missing", "x"), doc);
  assert.equal(cmd.addChild(doc, "r", "a"), doc);
});

test("addSibling inserts right after the node; the root gets a child", async () => {
  const { cmd, doc } = await fixture();
  const next = cmd.addSibling(doc, "a", "s");
  assert.deepEqual(next.nodes.r.children, ["a", "s", "b"]);
  assert.deepEqual(cmd.addSibling(doc, "r", "z").nodes.r.children, ["a", "b", "z"]);
});

test("outdent moves a node after its parent; root children cannot outdent", async () => {
  const { cmd, doc } = await fixture();
  const next = cmd.outdent(doc, "a1");
  assert.deepEqual(next.nodes.r.children, ["a", "a1", "b"]);
  assert.deepEqual(next.nodes.a.children, ["a2"]);
  assert.equal(cmd.outdent(doc, "a"), doc);
  assert.equal(cmd.outdent(doc, "r"), doc);
});

test("reparent moves a subtree and honours the index", async () => {
  const { cmd, doc } = await fixture();
  const next = cmd.reparent(doc, "a", "b", 0);
  assert.deepEqual(next.nodes.r.children, ["b"]);
  assert.deepEqual(next.nodes.b.children, ["a"]);
  assert.deepEqual(next.nodes.a.children, ["a1", "a2"]);
});

test("reparent cycle guard refuses moving a node under itself or a descendant", async () => {
  const { cmd, doc } = await fixture();
  assert.equal(cmd.reparent(doc, "a", "a1"), doc);
  assert.equal(cmd.reparent(doc, "a", "a"), doc);
  assert.equal(cmd.reparent(doc, "r", "a"), doc);
  assert.equal(cmd.reparent(doc, "a", "nope"), doc);
});

test("deleteSubtree removes descendants and detaches from the parent; root is protected", async () => {
  const { cmd, doc } = await fixture();
  const next = cmd.deleteSubtree(doc, "a");
  assert.deepEqual(Object.keys(next.nodes).sort(), ["b", "r"]);
  assert.deepEqual(next.nodes.r.children, ["b"]);
  assert.equal(cmd.deleteSubtree(doc, "r"), doc);
});

test("rename and toggleCollapse ignore no-ops", async () => {
  const { cmd, doc } = await fixture();
  assert.equal(cmd.rename(doc, "a", "A"), doc);
  assert.equal(cmd.rename(doc, "a", "New").nodes.a.text, "New");
  assert.equal(cmd.toggleCollapse(doc, "b"), doc);
  assert.equal(cmd.toggleCollapse(doc, "a").nodes.a.collapsed, true);
});

test("history undoes, redoes, clears redo on new edits and caps at 200", async () => {
  const h = await load("history.ts");
  let hist = h.createHistory(0);
  hist = h.push(hist, 1);
  hist = h.push(hist, 2);
  assert.equal(h.push(hist, 2), hist);
  hist = h.undo(hist);
  assert.equal(hist.present, 1);
  hist = h.redo(hist);
  assert.equal(hist.present, 2);
  hist = h.undo(h.undo(hist));
  assert.equal(h.undo(hist), hist);
  hist = h.push(hist, 9);
  assert.equal(hist.future.length, 0);
  let big = h.createHistory(0);
  for (let i = 1; i <= 300; i += 1) big = h.push(big, i);
  assert.equal(big.past.length, h.HISTORY_CAP);
  assert.equal(big.past[0], 100);
});

test("serialization round-trips and carries the schema marker", async () => {
  const { doc } = await fixture();
  const s = await load("serialize.ts");
  const data = s.toData(doc);
  assert.equal(data.schema, "mindmap@1");
  const parsed = s.fromData(JSON.parse(JSON.stringify(data)));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.doc, doc);
});

test("fromData rejects unknown or malformed input", async () => {
  const s = await load("serialize.ts");
  const node = (id, children = []) => ({ id, text: id, children, collapsed: false });
  const bad = [
    null,
    [],
    {},
    { schema: "mindmap@2", rootId: "r", nodes: [node("r")] },
    { schema: "mindmap@1", rootId: "x", nodes: [node("r")] },
    { schema: "mindmap@1", rootId: "r", nodes: [] },
    { schema: "mindmap@1", rootId: "r", nodes: [node("r", ["ghost"])] },
    { schema: "mindmap@1", rootId: "r", nodes: [node("r", ["a"]), node("a", ["r"])] },
    { schema: "mindmap@1", rootId: "r", nodes: [node("r", ["a", "a"]), node("a")] },
    { schema: "mindmap@1", rootId: "r", nodes: [node("r"), node("r")] },
    { schema: "mindmap@1", rootId: "r", nodes: [node("r"), node("orphan")] },
    { schema: "mindmap@1", rootId: "r", nodes: [{ id: "r", text: 5, children: [] }] },
  ];
  for (const input of bad) assert.equal(s.fromData(input).ok, false, JSON.stringify(input));
});
