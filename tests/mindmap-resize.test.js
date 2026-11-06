// Manual node resizing (ui/web/src/features/mindmap): command, serialization and size-aware layout.
const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const dir = path.join(__dirname, "..", "ui", "web", "src", "features", "mindmap");
const load = (name) => import(pathToFileURL(path.join(dir, name)).href);

async function fixture() {
  const [tree, cmd, layout, ser] = await Promise.all([
    load("tree.ts"),
    load("commands.ts"),
    load("layout.ts"),
    load("serialize.ts"),
  ]);
  let doc = tree.createDoc("r", "Root");
  doc = cmd.addChild(doc, "r", "a", "A");
  doc = cmd.addChild(doc, "r", "b", "B");
  doc = cmd.addChild(doc, "a", "a1", "A1");
  return { cmd, layout, ser, doc };
}

test("resizeNode stores a clamped size and is a no-op when unchanged", async () => {
  const { cmd, doc } = await fixture();
  const next = cmd.resizeNode(doc, "a", 320.4, 9999);
  assert.equal(next.nodes.a.w, 320);
  assert.equal(next.nodes.a.h, 400);
  assert.equal(cmd.resizeNode(next, "a", 320, 400), next);
  assert.equal(cmd.resizeNode(doc, "a", Number.NaN, 80), doc);
  assert.equal(doc.nodes.a.w, undefined);
});

test("sizes survive serialization and invalid sizes are rejected", async () => {
  const { cmd, ser, doc } = await fixture();
  const sized = cmd.resizeNode(doc, "a", 300, 120);
  const parsed = ser.fromData(JSON.parse(JSON.stringify(ser.toData(sized))));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.doc.nodes.a.w, 300);
  assert.equal(parsed.doc.nodes.a.h, 120);
  assert.equal(parsed.doc.nodes.b.w, undefined);
  const bad = ser.toData(doc);
  bad.nodes[1] = { ...bad.nodes[1], w: "wide" };
  assert.equal(ser.fromData(bad).ok, false);
});

test("layout keeps default positions and makes room for larger nodes", async () => {
  const { cmd, layout, doc } = await fixture();
  const before = layout.layoutTree(doc);
  const find = (list, id) => list.find((item) => item.id === id);
  assert.equal(find(before, "a").w, layout.NODE_WIDTH);
  const big = cmd.resizeNode(doc, "a", 400, 200);
  const after = layout.layoutTree(big);
  // Wider parent pushes its children column to the right.
  assert.equal(find(after, "a1").x, find(before, "a1").x + 400 - layout.NODE_WIDTH);
  // Taller node never overlaps its sibling.
  const a = find(after, "a");
  const b = find(after, "b");
  const [top, bottom] = a.y < b.y ? [a, b] : [b, a];
  assert.ok(top.y + top.h <= bottom.y);
});
