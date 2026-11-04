// Outline parser/applier (ui/web/src/features/mindmap). Node strips types, so the .ts sources import directly.
const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const dir = path.join(__dirname, "..", "ui", "web", "src", "features", "mindmap");
const load = (name) => import(pathToFileURL(path.join(dir, name)).href);
const texts = (nodes) => nodes.map((node) => node.text);
const leaf = (text) => ({ text, children: [] });
const seq = (prefix = "n") => {
  let i = 0;
  return () => `${prefix}${(i += 1)}`;
};
const fit = (nodes) => (nodes.length === 0 ? 0 : 1 + Math.max(...nodes.map((node) => fit(node.children))));

async function fixture() {
  const [tree, cmd] = await Promise.all([load("tree.ts"), load("commands.ts")]);
  let doc = tree.createDoc("r", "Root");
  doc = cmd.addChild(doc, "r", "existing", "Existing");
  return { tree, cmd, doc };
}

async function valid(doc) {
  const s = await load("serialize.ts");
  assert.equal(s.fromData(JSON.parse(JSON.stringify(s.toData(doc)))).ok, true);
}

function deepFreeze(value) {
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    Object.freeze(value);
  }
  return value;
}

test("parse accepts dash, asterisk, plus and numbered bullets; prose, headings and blanks are ignored", async () => {
  const { parseOutline } = await load("outline.ts");
  const res = parseOutline(
    "# Title\nProse\n\n- Dash\n* Star\n+ Plus\n1. One\n2) Two\n1.no space\nnot - bullet\n```\n- hidden\n```\n- Last",
  );
  assert.deepEqual(texts(res.nodes), ["Dash", "Star", "Plus", "One", "Two", "Last"]);
  assert.equal(res.truncated, false);
});
test("parse honours 2-space, 4-space, tab and mixed indentation", async () => {
  const { parseOutline } = await load("outline.ts");
  const two = parseOutline("- A\n  - A1\n    - A11\n- B");
  assert.deepEqual(texts(two.nodes), ["A", "B"]);
  assert.deepEqual(texts(two.nodes[0].children[0].children), ["A11"]);
  const four = parseOutline("- A\n    - A1\n        - A11");
  assert.deepEqual(texts(four.nodes[0].children), ["A1"]);
  assert.deepEqual(texts(four.nodes[0].children[0].children), ["A11"]);
  const tabbed = parseOutline("- A\n\t- T\n\t\t- TT");
  assert.deepEqual(texts(tabbed.nodes[0].children[0].children), ["TT"]);
  const mixed = parseOutline("- A\n\t- T\n        - E");
  assert.deepEqual(texts(mixed.nodes[0].children), ["T"]);
  assert.deepEqual(texts(mixed.nodes[0].children[0].children), ["E"]);
  const shallower = parseOutline("- A\n    - A1\n  - B2\n- B");
  assert.deepEqual(texts(shallower.nodes), ["A", "B2", "B"]);
});
test("parse attaches a skipped indentation level one level deeper only", async () => {
  const { parseOutline } = await load("outline.ts");
  const res = parseOutline("- A\n        - deep\n- B");
  assert.deepEqual(texts(res.nodes), ["A", "B"]);
  assert.deepEqual(texts(res.nodes[0].children), ["deep"]);
  const nested = parseOutline("- A\n    - A1\n            - deep2");
  assert.deepEqual(texts(nested.nodes[0].children[0].children), ["deep2"]);
  assert.equal(fit(nested.nodes), 3);
});
test("parse normalises text, markers, controls and CRLF, and skips empty bullets", async () => {
  const { parseOutline } = await load("outline.ts");
  const crlf = parseOutline("- A\r\n  - A1\r\n- B");
  assert.deepEqual(texts(crlf.nodes), ["A", "B"]);
  assert.deepEqual(texts(crlf.nodes[0].children), ["A1"]);
  const clean = parseOutline("-   hello    world  \n- **Bold**\n- __Under__\n- `Code`\n- **kept");
  assert.deepEqual(texts(clean.nodes), ["hello world", "Bold", "Under", "Code", "**kept"]);
  const skipped = parseOutline("- A\n- \n-   \n- ** **\n  - A1\n- B");
  assert.deepEqual(texts(skipped.nodes), ["A", "B"]);
  assert.deepEqual(texts(skipped.nodes[0].children), ["A1"]);
});
test("parse caps text, total nodes and depth", async () => {
  const [{ parseOutline, MAX_OUTLINE_NODES }, { MAX_TEXT }] = await Promise.all([
    load("outline.ts"),
    load("types.ts"),
  ]);
  const long = parseOutline(`- ${"x".repeat(MAX_TEXT + 50)}`).nodes[0].text;
  assert.equal(long.length, MAX_TEXT);
  assert.ok(long.endsWith("..."));
  const many = parseOutline(Array.from({ length: MAX_OUTLINE_NODES + 5 }, (_, i) => `- item ${i}`).join("\n"));
  assert.equal(many.nodes.length, MAX_OUTLINE_NODES);
  assert.equal(many.truncated, true);
  assert.equal(parseOutline("- A").truncated, false);
  const deepLines = Array.from({ length: 10 }, (_, i) => `${"  ".repeat(i)}- level ${i + 1}`);
  const deep = parseOutline(deepLines.join("\n"));
  assert.equal(fit(deep.nodes), 8);
  let seventhNode = deep.nodes[0];
  for (let i = 0; i < 6; i += 1) seventhNode = seventhNode.children[0];
  assert.deepEqual(texts(seventhNode.children), ["level 8", "level 9", "level 10"]);
});
test("appendOutline keeps order after existing children and expands the parent", async () => {
  const { cmd, doc } = await fixture();
  const { appendOutline } = await load("outlineApply.ts");
  const outline = [{ text: "A", children: [leaf("A1")] }, leaf("B")];
  const res = appendOutline(doc, "r", outline, seq());
  assert.equal(res.added, 3);
  assert.deepEqual(res.doc.nodes.r.children, ["existing", "n1", "n3"]);
  assert.deepEqual(res.doc.nodes.n1.children, ["n2"]);
  assert.deepEqual(["n1", "n2", "n3"].map((id) => res.doc.nodes[id].text), ["A", "A1", "B"]);
  const collapsed = cmd.toggleCollapse(doc, "r");
  assert.equal(appendOutline(collapsed, "r", outline, seq()).doc.nodes.r.collapsed, false);
  assert.equal(collapsed.nodes.r.collapsed, true);
});
test("appendOutline retries colliding ids and stops after five attempts", async () => {
  const { doc } = await fixture();
  const { appendOutline } = await load("outlineApply.ts");
  const ids = ["existing", "existing", "fresh"];
  let calls = 0;
  const retried = appendOutline(doc, "r", [leaf("A")], () => ids[calls++] ?? "extra");
  assert.equal(retried.added, 1);
  assert.equal(retried.doc.nodes.r.children[1], "fresh");
  assert.equal(calls, 3);
  calls = 0;
  const failed = appendOutline(doc, "r", [leaf("A"), leaf("B")], () => {
    calls += 1;
    return "existing";
  });
  assert.equal(failed.doc, doc);
  assert.equal(failed.added, 0);
  assert.equal(calls, 5);
});
test("appendOutline ignores unknown parents and empty outlines and never mutates the input", async () => {
  const { doc } = await fixture();
  const { appendOutline } = await load("outlineApply.ts");
  assert.equal(appendOutline(doc, "missing", [leaf("A")], seq()).doc, doc);
  assert.equal(appendOutline(doc, "r", [], seq()).added, 0);
  assert.equal(appendOutline(doc, "r", [], seq()).doc, doc);
  const frozen = deepFreeze(structuredClone(doc));
  const before = JSON.stringify(frozen);
  const res = appendOutline(frozen, "r", [{ text: "A", children: [leaf("A1")] }], seq());
  assert.equal(res.added, 2);
  assert.equal(JSON.stringify(frozen), before);
  assert.notEqual(res.doc, frozen);
  await valid(res.doc);
});
test("appendOutline respects the document cap", async () => {
  const [{ appendOutline }, { MAX_NODES }] = await Promise.all([load("outlineApply.ts"), load("types.ts")]);
  const nodes = { r: { id: "r", text: "Root", children: [], collapsed: false } };
  for (let i = 1; i < MAX_NODES - 1; i += 1) {
    nodes[`n${i}`] = { id: `n${i}`, text: `N${i}`, children: [], collapsed: false };
    nodes.r.children.push(`n${i}`);
  }
  const doc = { rootId: "r", nodes };
  const res = appendOutline(doc, "r", [leaf("A"), leaf("B")], seq("x"));
  assert.equal(res.added, 1);
  assert.equal(Object.keys(res.doc.nodes).length, MAX_NODES);
  assert.equal(res.doc.nodes.r.children.at(-1), "x1");
  assert.equal(appendOutline(res.doc, "r", [leaf("C")], seq("y")).doc, res.doc);
  await valid(res.doc);
});
test("replaceWithOutline makes a single top-level node the root", async () => {
  const { doc } = await fixture();
  const { replaceWithOutline } = await load("outlineApply.ts");
  const outline = [{ text: "Topic", children: [leaf("Sub")] }];
  const res = replaceWithOutline(doc, outline, seq(), "ignored");
  assert.equal(res.doc.rootId, "r");
  assert.equal(res.doc.nodes.r.text, "Topic");
  assert.equal(res.added, 1);
  assert.deepEqual(texts(res.doc.nodes.r.children.map((id) => res.doc.nodes[id])), ["Sub"]);
  assert.equal(res.doc.nodes.existing, undefined);
  assert.equal(doc.nodes.existing.id, "existing");
  await valid(res.doc);
});
test("replaceWithOutline keeps a cleaned rootText when there are several top-level nodes", async () => {
  const { doc } = await fixture();
  const { replaceWithOutline } = await load("outlineApply.ts");
  const outline = [leaf("A"), { text: "B", children: [leaf("B1")] }];
  const res = replaceWithOutline(doc, outline, seq(), "  **My   Map**  ");
  assert.equal(res.doc.nodes.r.text, "My Map");
  assert.deepEqual(res.doc.nodes.r.children, ["n1", "n2"]);
  assert.equal(res.added, 3);
  const fallback = replaceWithOutline(doc, outline, seq(), "   ");
  assert.equal(fallback.doc.nodes.r.text, "Central idea");
  await valid(res.doc);
});
test("replaceWithOutline keeps rootId, retries its id and returns the same doc for an empty outline", async () => {
  const { doc } = await fixture();
  const { replaceWithOutline } = await load("outlineApply.ts");
  const ids = ["r", "n1"];
  let calls = 0;
  const res = replaceWithOutline(doc, [{ text: "A", children: [leaf("A1")] }], () => ids[calls++] ?? "n2", "x");
  assert.equal(res.doc.rootId, "r");
  assert.deepEqual(res.doc.nodes.r.children, ["n1"]);
  assert.equal(calls, 2);
  assert.equal(res.added, 1);
  const empty = replaceWithOutline(doc, [], seq(), "x");
  assert.equal(empty.doc, doc);
  assert.equal(empty.added, 0);
  await valid(res.doc);
});
