// Context pack (ui/web/src/features/context-pack). Node 24 strips types, so the .ts sources are imported directly.
const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const dir = path.join(__dirname, "..", "ui", "web", "src", "features", "context-pack");
const load = (name) => import(pathToFileURL(path.join(dir, name)).href);

const node = (id, text, children = [], collapsed = false) => ({ id, text, children, collapsed });
const marker = (omitted) => `[truncated: ${omitted} nodes omitted]`;

function fixtureDoc() {
  return {
    rootId: "r",
    nodes: {
      r: node("r", "Root", ["a", "b"]),
      a: node("a", "Alpha", ["a1", "a2"]),
      a1: node("a1", "A1"),
      a2: node("a2", "A2"),
      b: node("b", "Beta", ["b1"], true),
      b1: node("b1", "B1"),
    },
  };
}

function boundaryDoc() {
  const long = "y".repeat(60);
  return {
    rootId: "r",
    nodes: {
      r: node("r", "Root", ["c"]),
      c: node("c", "Center", ["c1", "c2", "c3", "c4"]),
      c1: node("c1", long),
      c2: node("c2", "z".repeat(60)),
      c3: node("c3", "w".repeat(60)),
      c4: node("c4", long),
    },
  };
}

function orderDoc() {
  const text = (id) => id + "x".repeat(60 - id.length);
  return {
    rootId: "r",
    nodes: {
      r: node("r", "Root", ["s"]),
      s: node("s", text("S"), ["a", "b", "c"]),
      a: node("a", text("A"), ["a1"]),
      b: node("b", text("B"), ["b1"]),
      c: node("c", text("C")),
      a1: node("a1", text("A1")),
      b1: node("b1", text("B1")),
    },
  };
}

function parseBullets(markdown) {
  const out = [];
  for (const line of markdown.split("\n")) {
    const match = /^( *)- (.*)$/.exec(line);
    if (match) out.push({ depth: match[1].length / 2, text: match[2] });
  }
  return out;
}

function flatten(tree) {
  // Pre-order: a parent, then each child subtree in model order (the order the Markdown nests in).
  const out = [];
  const visit = (current, depth) => {
    out.push({ depth, text: current.text });
    for (const child of current.children) visit(child, depth + 1);
  };
  if (tree) visit(tree, 0);
  return out;
}

function deepFreeze(value) {
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    Object.freeze(value);
  }
  return value;
}

test("determinism: same doc, selection and options give byte-identical output", async () => {
  const { buildContextPack } = await load("build.ts");
  const doc = fixtureDoc();
  const first = buildContextPack(doc, "a", { budget: 300, boardTitle: "Board" });
  const second = buildContextPack(fixtureDoc(), "a", { budget: 300, boardTitle: "Board" });
  assert.equal(first.markdown, second.markdown);
  assert.equal(JSON.stringify(first.json), JSON.stringify(second.json));
  assert.equal(first.markdown, buildContextPack(doc, "a", { budget: 300, boardTitle: "Board" }).markdown);
});

test("null or unknown selection returns the empty pack", async () => {
  const { buildContextPack } = await load("build.ts");
  const expected = {
    schema: "context-pack@1",
    empty: true,
    markdown: "",
    json: {
      schema: "context-pack@1",
      empty: true,
      board: null,
      path: [],
      tree: null,
      truncated: false,
      omitted: 0,
      budget: 4000,
    },
    truncated: false,
    omitted: 0,
    budget: 4000,
  };
  assert.deepEqual(buildContextPack(fixtureDoc(), null), expected);
  assert.deepEqual(buildContextPack(fixtureDoc(), "ghost"), expected);
});

test("exact Markdown: board line, path line, blank line and nested bullets", async () => {
  const { buildContextPack } = await load("build.ts");
  const doc = fixtureDoc();
  assert.equal(
    buildContextPack(doc, "a").markdown,
    "Path: Root > Alpha\n\n- Alpha\n  - A1\n  - A2",
  );
  assert.equal(
    buildContextPack(doc, "a", { boardTitle: "Board" }).markdown,
    "# Board\nPath: Root > Alpha\n\n- Alpha\n  - A1\n  - A2",
  );
  const root = buildContextPack(doc, "r");
  assert.equal(root.json.tree.children[1].children[0].id, "b1");
  assert.equal(root.json.path.length, 1);
});

test("budget boundary: exact fit keeps all; one char less drops the last node", async () => {
  const { buildContextPack } = await load("build.ts");
  const doc = boundaryDoc();
  const full = buildContextPack(doc, "c", { budget: 4000 });
  const length = full.markdown.length;
  assert.equal(full.truncated, false);
  assert.equal(full.omitted, 0);
  assert.ok(length > 200, `full markdown must exceed the minimum budget (${length})`);

  const exact = buildContextPack(doc, "c", { budget: length });
  assert.equal(exact.markdown, full.markdown);
  assert.equal(exact.truncated, false);

  const tight = buildContextPack(doc, "c", { budget: length - 1 });
  assert.equal(tight.truncated, true);
  assert.equal(tight.omitted, 1);
  assert.equal(tight.json.tree.children.length, 3);
  assert.equal(tight.markdown.split("\n").at(-1), marker(1));
  assert.ok(tight.markdown.length <= length - 1);
});

test("truncation order: first node that does not fit stops its level and deeper levels", async () => {
  const { buildContextPack } = await load("build.ts");
  const doc = orderDoc();
  // Header "Path: Root > " + 60-char selected + newline, then S (depth 0), A and B (depth 1).
  const headerLen = "Path: Root > ".length + 60 + 1;
  const budget = headerLen + 63 + 65 + 65 + 1 + marker(3).length;
  const pack = buildContextPack(doc, "s", { budget });
  assert.equal(pack.truncated, true);
  assert.equal(pack.omitted, 3);
  assert.deepEqual(pack.json.tree.children.map((child) => child.id), ["a", "b"]);
  assert.deepEqual(pack.json.tree.children[0].children, []);
  const bullets = parseBullets(pack.markdown);
  assert.deepEqual(bullets.map((bullet) => bullet.depth), [0, 1, 1]);
  assert.ok(bullets.every((bullet, index) => index === 0 || bullet.depth <= bullets[index - 1].depth + 1));
  assert.equal(pack.markdown.split("\n").at(-1), marker(3));

  const narrower = buildContextPack(doc, "s", { budget: budget - 1 });
  assert.equal(narrower.omitted, 4);
  assert.deepEqual(narrower.json.tree.children.map((child) => child.id), ["a"]);
});

test("Markdown and JSON always describe the same kept set", async () => {
  const { buildContextPack } = await load("build.ts");
  const cases = [
    { doc: fixtureDoc(), id: "r", budget: 4000 },
    { doc: boundaryDoc(), id: "c", budget: 4000 },
    { doc: orderDoc(), id: "s", budget: 200 },
    { doc: orderDoc(), id: "s", budget: 296 },
    { doc: orderDoc(), id: "s", budget: 2000 },
  ];
  for (const item of cases) {
    const pack = buildContextPack(item.doc, item.id, { budget: item.budget });
    assert.deepEqual(parseBullets(pack.markdown), flatten(pack.json.tree), JSON.stringify(item));
  }
});

test("result length never exceeds the budget", async () => {
  const { buildContextPack } = await load("build.ts");
  for (const doc of [fixtureDoc(), boundaryDoc(), orderDoc()]) {
    for (const budget of [200, 201, 220, 260, 300, 500, 1000, 4000]) {
      const pack = buildContextPack(doc, doc.rootId, { budget });
      assert.equal(pack.budget, budget);
      assert.ok(pack.markdown.length <= budget, `${pack.markdown.length} > ${budget}`);
    }
  }
});

test("node text is capped at 300 characters and path segments at 80", async () => {
  const { buildContextPack } = await load("build.ts");
  const doc = { rootId: "r", nodes: { r: node("r", "x".repeat(400)) } };
  const pack = buildContextPack(doc, "r", { budget: 4000 });
  assert.equal(pack.json.tree.text.length, 300);
  assert.equal(pack.json.tree.text, `${"x".repeat(297)}...`);
  assert.equal(pack.json.path[0].text.length, 80);
  assert.equal(pack.json.path[0].text, `${"x".repeat(77)}...`);
});

test("control characters and whitespace runs are normalized; empty text renders (empty)", async () => {
  const { buildContextPack } = await load("build.ts");
  const doc = {
    rootId: "r",
    nodes: {
      r: node("r", "a\u0000b\u0001c\n d\t e\u009f f\u00a0g", ["e"]),
      e: node("e", " \n\t "),
    },
  };
  assert.equal(buildContextPack(doc, "r").markdown.split("\n")[0], "Path: a b c d e f g");
  assert.equal(buildContextPack(doc, "r").markdown.split("\n")[2], "- a b c d e f g");
  assert.equal(buildContextPack(doc, "e").markdown.split("\n").at(-1), "- (empty)");
});

test("budget is clamped to at least 200 (and defaults to 4000)", async () => {
  const { buildContextPack } = await load("build.ts");
  const doc = boundaryDoc();
  for (const budget of [0, -10, 1, 199, 199.9]) {
    assert.equal(buildContextPack(doc, "c", { budget }).budget, 200);
  }
  for (const budget of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.equal(buildContextPack(doc, "c", { budget }).budget, 4000);
  }
  assert.equal(buildContextPack(doc, "c", { budget: 5000 }).budget, 5000);
  assert.equal(buildContextPack(doc, "c").budget, 4000);
  assert.ok(buildContextPack(doc, "c", { budget: 1 }).markdown.length <= 200);
});

test("the input document is never mutated (deep-frozen input)", async () => {
  const { buildContextPack } = await load("build.ts");
  const doc = deepFreeze(fixtureDoc());
  const before = JSON.stringify(doc);
  const pack = buildContextPack(doc, "r", { budget: 220, boardTitle: "Frozen" });
  assert.ok(pack.markdown.startsWith("# Frozen\nPath: Root\n"));
  assert.equal(JSON.stringify(doc), before);
  assert.deepEqual(Object.keys(pack.json).sort(), [
    "board",
    "budget",
    "empty",
    "omitted",
    "path",
    "schema",
    "tree",
    "truncated",
  ]);
});

test("markdown nests children under their own parent even when the kept set is chosen breadth first", async () => {
  const { buildContextPack } = await load("index.ts");
  const doc = {
    rootId: "r",
    nodes: {
      r: { id: "r", text: "Root", children: ["a", "b"], collapsed: false },
      a: { id: "a", text: "A", children: ["a1", "a2"], collapsed: false },
      b: { id: "b", text: "B", children: ["b1"], collapsed: false },
      a1: { id: "a1", text: "A1", children: [], collapsed: false },
      a2: { id: "a2", text: "A2", children: [], collapsed: false },
      b1: { id: "b1", text: "B1", children: [], collapsed: false },
    },
  };
  const pack = buildContextPack(doc, "r", { budget: 4000 });
  assert.equal(
    pack.markdown,
    ["Path: Root", "", "- Root", "  - A", "    - A1", "    - A2", "  - B", "    - B1"].join(String.fromCharCode(10)),
  );
});
