// Manual node positioning (ui/web/src/features/mindmap). Node strips types, so the .ts sources load directly.
const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const dir = path.join(__dirname, "..", "ui", "web", "src", "features", "mindmap");
const load = (name) => import(pathToFileURL(path.join(dir, name)).href);

async function fixture() {
  const [tree, cmd, layout] = await Promise.all([load("tree.ts"), load("commands.ts"), load("layout.ts")]);
  // r -> a(a1, a2), b
  let doc = tree.createDoc("r", "Root");
  doc = cmd.addChild(doc, "r", "a", "A");
  doc = cmd.addChild(doc, "r", "b", "B");
  doc = cmd.addChild(doc, "a", "a1", "A1");
  doc = cmd.addChild(doc, "a", "a2", "A2");
  return { cmd, layout, doc };
}

test("moveNode is immutable, ignores non-finite values and clamps the range", async () => {
  const { cmd, doc } = await fixture();
  const { MAX_OFFSET } = await load("types.ts");
  const moved = cmd.moveNode(doc, "a", 30, -12);
  assert.notEqual(moved, doc);
  assert.equal(moved.nodes.a.dx, 30);
  assert.equal(moved.nodes.a.dy, -12);
  assert.equal(doc.nodes.a.dx, 0);
  assert.equal(doc.nodes.a.dy, 0);
  assert.equal(cmd.moveNode(doc, "a", Number.NaN, 0), doc);
  assert.equal(cmd.moveNode(doc, "a", 0, Number.POSITIVE_INFINITY), doc);
  assert.equal(cmd.moveNode(doc, "ghost", 1, 1), doc);
  assert.equal(cmd.moveNode(doc, "a", 0, 0), doc);
  const huge = cmd.moveNode(doc, "a", 1e9, -1e9);
  assert.equal(huge.nodes.a.dx, MAX_OFFSET);
  assert.equal(huge.nodes.a.dy, -MAX_OFFSET);
});

test("a drag is one undoable history entry", async () => {
  const { cmd, doc } = await fixture();
  const history = await load("history.ts");
  let stack = history.createHistory(doc);
  stack = history.push(stack, cmd.moveNode(doc, "a", 40, 8));
  assert.equal(stack.past.length, 1);
  assert.equal(history.undo(stack).present.nodes.a.dx, 0);
  assert.equal(history.redo(history.undo(stack)).present.nodes.a.dx, 40);
});

test("offsets accumulate from ancestors to descendants", async () => {
  const { cmd, layout, doc } = await fixture();
  let moved = cmd.moveNode(doc, "r", 10, 5);
  moved = cmd.moveNode(moved, "a", 100, 20);
  assert.deepEqual(layout.absoluteOffset(moved, "r"), { dx: 10, dy: 5 });
  assert.deepEqual(layout.absoluteOffset(moved, "a"), { dx: 110, dy: 25 });
  assert.deepEqual(layout.absoluteOffset(moved, "a1"), { dx: 110, dy: 25 });
  assert.deepEqual(layout.absoluteOffset(moved, "b"), { dx: 10, dy: 5 });
  const placed = layout.layoutTree(moved).find((item) => item.id === "a1");
  assert.deepEqual(layout.renderedPosition(moved, placed), { x: placed.x + 110, y: placed.y + 25 });
});

test("offsetFromPosition converts a dropped position back into a relative offset", async () => {
  const { cmd, layout, doc } = await fixture();
  const moved = cmd.moveNode(cmd.moveNode(doc, "r", 10, 5), "a", 100, 20);
  const placed = layout.layoutTree(moved).find((item) => item.id === "a");
  // Drop the node where its own offset would be (7, -3) on top of the parent's (10, 5).
  const offset = layout.offsetFromPosition(moved, "a", placed.x + 10 + 7, placed.y + 5 - 3);
  assert.deepEqual(offset, { dx: 7, dy: -3 });
  assert.deepEqual(layout.offsetFromPosition(moved, "ghost", 0, 0), { dx: 0, dy: 0 });
});

test("reparent and outdent reset the moved node's offset", async () => {
  const { cmd, doc } = await fixture();
  const moved = cmd.moveNode(doc, "a1", 50, 50);
  const reparented = cmd.reparent(moved, "a1", "b");
  assert.equal(reparented.nodes.a1.dx, 0);
  assert.equal(reparented.nodes.a1.dy, 0);
  const outdented = cmd.outdent(moved, "a1");
  assert.equal(outdented.nodes.a1.dx, 0);
  assert.equal(outdented.nodes.a1.dy, 0);
  assert.deepEqual(outdented.nodes.r.children, ["a", "a1", "b"]);
});

test("serialization persists offsets, clamps them and rejects non-finite values", async () => {
  const { cmd, doc } = await fixture();
  const s = await load("serialize.ts");
  const moved = cmd.moveNode(doc, "a", 12.5, -40);
  const parsed = s.fromData(JSON.parse(JSON.stringify(s.toData(moved))));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.doc.nodes.a.dx, 12.5);
  assert.equal(parsed.doc.nodes.a.dy, -40);
  const withDx = (dx) => ({ schema: "mindmap@1", rootId: "r", nodes: [{ id: "r", text: "R", children: [], dx }] });
  assert.equal(s.fromData(withDx(Number.NaN)).ok, false);
  assert.equal(s.fromData(withDx(Number.POSITIVE_INFINITY)).ok, false);
  const clamped = s.fromData(withDx(1e9));
  assert.equal(clamped.ok, true);
  assert.equal(clamped.doc.nodes.r.dx, 100000);
});

test("boards without offsets still load with zero offsets", async () => {
  const s = await load("serialize.ts");
  const legacy = {
    schema: "mindmap@1",
    rootId: "r",
    nodes: [
      { id: "r", text: "Root", children: ["a"] },
      { id: "a", text: "A", children: [] },
    ],
  };
  const parsed = s.fromData(legacy);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.doc.nodes.r.dx, 0);
  assert.equal(parsed.doc.nodes.a.dy, 0);
  assert.equal(s.toData(parsed.doc).schema, "mindmap@1");
});
