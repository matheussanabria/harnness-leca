// Chat bridge (ui/web/src/features/mindmap/chatBridge.ts). Node strips types, so the .ts source imports directly.
const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const dir = path.join(__dirname, "..", "ui", "web", "src", "features", "mindmap");
const load = (name) => import(pathToFileURL(path.join(dir, name)).href);
const node = (id, text, children = []) => ({ id, text, children, collapsed: false });
const seq = (prefix = "n") => {
  let i = 0;
  return () => `${prefix}${(i += 1)}`;
};
const append = (body, parent = "selected", mode = "append") => ({ mode, parent, body });

function baseDoc() {
  return {
    rootId: "r",
    nodes: { r: node("r", "Root", ["existing"]), existing: node("existing", "Existing") },
  };
}

function deepFreeze(value) {
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    Object.freeze(value);
  }
  return value;
}

async function valid(doc) {
  const s = await load("serialize.ts");
  assert.equal(s.fromData(JSON.parse(JSON.stringify(s.toData(doc)))).ok, true);
}

test("canvasStatePayload publishes whole-map bullets without the Path line and the normalized selection", async () => {
  const { canvasStatePayload } = await load("chatBridge.ts");
  const doc = {
    rootId: "r",
    nodes: {
      r: node("r", "Root", ["a", "b"]),
      a: node("a", "  Alpha\n  Beta  ", ["a1"]),
      a1: node("a1", "A1"),
      b: node("b", "Beta"),
    },
  };
  const state = canvasStatePayload(doc, "a", "board-1", "My Map");
  assert.equal(state.boardId, "board-1");
  assert.equal(state.title, "My Map");
  assert.equal(state.selectedId, "a");
  assert.equal(state.selectedText, "Alpha Beta");
  assert.equal(/^Path:/m.test(state.outline), false);
  assert.match(state.outline, /- Root/);
  assert.match(state.outline, / {2}- Alpha/);
  assert.match(state.outline, / {4}- A1/);
  assert.match(state.outline, / {2}- Beta/);
});

test("canvasStatePayload keeps the outline bounded for a 500-node map", async () => {
  const { canvasStatePayload, OUTLINE_BUDGET } = await load("chatBridge.ts");
  const nodes = { r: node("r", "Root", []) };
  for (let i = 0; i < 500; i += 1) {
    nodes[`n${i}`] = node(`n${i}`, `Node ${i}`);
    nodes.r.children.push(`n${i}`);
  }
  const state = canvasStatePayload({ rootId: "r", nodes }, "r", "board-1", "Big");
  assert.ok(state.outline.length <= OUTLINE_BUDGET);
  assert.ok(state.outline.split("\n").length < 500);
  assert.match(state.outline, /\[truncated: \d+ nodes omitted\]/);
});

test("applyBlocks appends under the selected node and focuses the first new node", async () => {
  const { applyBlocks } = await load("chatBridge.ts");
  const doc = baseDoc();
  const res = applyBlocks(doc, "existing", [append("- A\n  - A1")], seq(), "Root");
  assert.equal(res.added, 2);
  assert.equal(res.truncated, false);
  assert.deepEqual(res.doc.nodes.existing.children, ["n1"]);
  assert.equal(res.doc.nodes.n1.text, "A");
  assert.deepEqual(res.doc.nodes.n1.children, ["n2"]);
  assert.equal(res.doc.nodes.n2.text, "A1");
  assert.equal(res.focusId, "n1");
  assert.deepEqual(doc.nodes.existing.children, []);
  await valid(res.doc);
});

test("applyBlocks honours parent root and falls back to the root for an unknown selection", async () => {
  const { applyBlocks } = await load("chatBridge.ts");
  const rooted = applyBlocks(baseDoc(), "existing", [append("- A", "root")], seq(), "Root");
  assert.deepEqual(rooted.doc.nodes.r.children, ["existing", "n1"]);
  assert.equal(rooted.focusId, "n1");
  const unknown = applyBlocks(baseDoc(), "missing", [append("- A")], seq(), "Root");
  assert.deepEqual(unknown.doc.nodes.r.children, ["existing", "n1"]);
  assert.equal(unknown.focusId, "n1");
});

test("applyBlocks replaces on new and appends the following block to the new root", async () => {
  const { applyBlocks } = await load("chatBridge.ts");
  const res = applyBlocks(baseDoc(), "existing", [append("- Topic", "selected", "new"), append("- More")], seq(), "Root");
  assert.equal(res.doc.nodes.r.text, "Topic");
  assert.equal(res.doc.nodes.existing, undefined);
  assert.deepEqual(res.doc.nodes.r.children, ["n1"]);
  assert.equal(res.doc.nodes.n1.text, "More");
  assert.equal(res.focusId, "r");
  assert.equal(res.added, 1);
  await valid(res.doc);
});

test("applyBlocks focuses the first node when one block adds several topics", async () => {
  const { applyBlocks } = await load("chatBridge.ts");
  const res = applyBlocks(baseDoc(), "r", [append("- A\n- B\n  - B1")], seq(), "Root");
  assert.equal(res.focusId, "n1");
  assert.equal(res.doc.nodes.n1.text, "A");
  assert.equal(res.added, 3);
});

test("applyBlocks accumulates several blocks in order", async () => {
  const { applyBlocks } = await load("chatBridge.ts");
  const res = applyBlocks(baseDoc(), "r", [append("- A", "root"), append("- B", "root")], seq(), "Root");
  assert.deepEqual(res.doc.nodes.r.children, ["existing", "n1", "n2"]);
  assert.equal(res.added, 2);
  assert.equal(res.focusId, "n1");
});

test("applyBlocks returns the same doc for empty or garbage blocks", async () => {
  const { applyBlocks } = await load("chatBridge.ts");
  const doc = baseDoc();
  for (const blocks of [[], null, undefined, ["nope"], [{ mode: "append", parent: "sideways", body: "- A" }]]) {
    const res = applyBlocks(doc, "r", blocks, seq(), "Root");
    assert.equal(res.doc, doc);
    assert.equal(res.added, 0);
    assert.equal(res.focusId, null);
    assert.equal(res.truncated, false);
  }
});

test("applyBlocks reports a truncated parse", async () => {
  const [{ applyBlocks }, { MAX_OUTLINE_NODES }] = await Promise.all([load("chatBridge.ts"), load("outline.ts")]);
  const body = Array.from({ length: MAX_OUTLINE_NODES + 5 }, (_, i) => `- item ${i}`).join("\n");
  const res = applyBlocks(baseDoc(), "r", [append(body, "root")], seq(), "Root");
  assert.equal(res.truncated, true);
  assert.equal(res.added, MAX_OUTLINE_NODES);
});

test("applyBlocks never mutates the input doc and the result stays valid", async () => {
  const { applyBlocks } = await load("chatBridge.ts");
  const frozen = deepFreeze(baseDoc());
  const before = JSON.stringify(frozen);
  const res = applyBlocks(frozen, "existing", [append("- A\n  - A1")], seq(), "Root");
  assert.equal(JSON.stringify(frozen), before);
  assert.notEqual(res.doc, frozen);
  assert.equal(res.added, 2);
  await valid(res.doc);
});
