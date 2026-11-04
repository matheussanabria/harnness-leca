// Toolbar model (ui/web/src/features/mindmap). Node strips types, so the .ts sources load directly.
const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const dir = path.join(__dirname, "..", "ui", "web", "src", "features", "mindmap");
const load = (name) => import(pathToFileURL(path.join(dir, name)).href);

async function fixture() {
  const [tree, cmd, toolbar, history] = await Promise.all([
    load("tree.ts"),
    load("commands.ts"),
    load("toolbarState.ts"),
    load("history.ts"),
  ]);
  // r -> a(a1), b
  let doc = tree.createDoc("r", "Root");
  doc = cmd.addChild(doc, "r", "a", "A");
  doc = cmd.addChild(doc, "r", "b", "B");
  doc = cmd.addChild(doc, "a", "a1", "A1");
  return { tree, cmd, toolbar, history, doc };
}

test("resetOffsets clears every offset immutably", async () => {
  const { cmd, doc } = await fixture();
  let moved = cmd.moveNode(doc, "r", 10, 5);
  moved = cmd.moveNode(moved, "a", 100, 20);
  moved = cmd.moveNode(moved, "a1", -7, 3);

  const reset = cmd.resetOffsets(moved);
  assert.notEqual(reset, moved);
  for (const node of Object.values(reset.nodes)) {
    assert.equal(node.dx, 0);
    assert.equal(node.dy, 0);
  }
  // The previous document is untouched.
  assert.equal(moved.nodes.r.dx, 10);
  assert.equal(moved.nodes.a.dx, 100);
  assert.equal(moved.nodes.a1.dy, 3);
});

test("resetOffsets is one undoable history entry and a no-op without offsets", async () => {
  const { cmd, history, doc } = await fixture();
  const moved = cmd.moveNode(cmd.moveNode(doc, "r", 10, 5), "a", 30, -4);
  const reset = cmd.resetOffsets(moved);

  const stack = history.push(history.createHistory(moved), reset);
  assert.equal(stack.past.length, 1);
  const undone = history.undo(stack);
  assert.equal(undone.present, moved);
  assert.equal(history.redo(undone).present, reset);

  assert.equal(cmd.resetOffsets(doc), doc);
  assert.equal(cmd.resetOffsets(reset), reset);
});

test("toolbarState disables every structure action without a selection", async () => {
  const { toolbar, history, doc } = await fixture();
  const empty = history.createHistory(doc);
  for (const selectedId of [null, "ghost"]) {
    const state = toolbar.toolbarState(doc, selectedId, empty);
    assert.deepEqual(state, {
      addChild: false,
      addSibling: false,
      outdent: false,
      rename: false,
      toggleCollapse: false,
      remove: false,
      undo: false,
      redo: false,
      resetOffsets: false,
    });
  }
});

test("toolbarState protects the root and only enables collapse for parents", async () => {
  const { tree, toolbar, history, doc } = await fixture();
  const empty = history.createHistory(doc);

  const root = toolbar.toolbarState(doc, "r", empty);
  assert.equal(root.addChild, true);
  assert.equal(root.rename, true);
  assert.equal(root.toggleCollapse, true);
  assert.equal(root.addSibling, false);
  assert.equal(root.outdent, false);
  assert.equal(root.remove, false);

  const loneRoot = toolbar.toolbarState(tree.createDoc("solo"), "solo", empty);
  assert.equal(loneRoot.toggleCollapse, false);
  assert.equal(loneRoot.addChild, true);

  const parent = toolbar.toolbarState(doc, "a", empty);
  assert.equal(parent.toggleCollapse, true);
  assert.equal(parent.addSibling, true);
  assert.equal(parent.outdent, true);
  assert.equal(parent.remove, true);

  const leaf = toolbar.toolbarState(doc, "b", empty);
  assert.equal(leaf.toggleCollapse, false);
  assert.equal(leaf.remove, true);
});

test("toolbarState mirrors undo/redo history and offset presence", async () => {
  const { cmd, toolbar, history, doc } = await fixture();
  const moved = cmd.moveNode(doc, "a", 12, 0);

  const empty = history.createHistory(doc);
  assert.equal(toolbar.toolbarState(doc, "a", empty).resetOffsets, false);
  assert.equal(toolbar.toolbarState(moved, "a", empty).resetOffsets, true);

  const stack = history.push(empty, moved);
  assert.equal(toolbar.toolbarState(moved, "a", stack).undo, true);
  assert.equal(toolbar.toolbarState(moved, "a", stack).redo, false);

  const undone = history.undo(stack);
  assert.equal(toolbar.toolbarState(doc, "a", undone).undo, false);
  assert.equal(toolbar.toolbarState(doc, "a", undone).redo, true);
});
