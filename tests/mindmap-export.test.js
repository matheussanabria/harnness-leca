// Pure mind-map exports (ui/web/src/features/mindmap/exportMindmap.ts) and the shared file name helper.
const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const src = path.join(__dirname, "..", "ui", "web", "src", "features");
const load = (...parts) => import(pathToFileURL(path.join(src, ...parts)).href);

const doc = () => ({
  rootId: "r",
  nodes: {
    r: { id: "r", text: "Pharmacy", children: ["a", "b"], collapsed: false },
    a: { id: "a", text: "Stock <items> & more", children: ["c"], collapsed: true },
    b: { id: "b", text: "Orders", children: [], collapsed: false },
    c: { id: "c", text: "Expiry", children: [], collapsed: false },
  },
});

test("outline: root heading, nested bullets, collapsed branches included", async () => {
  const { toOutlineMarkdown } = await load("mindmap", "exportMindmap.ts");
  assert.equal(toOutlineMarkdown(doc()), "# Pharmacy\n\n- Stock <items> & more\n  - Expiry\n- Orders\n");
});

test("outline: multi-line text collapses to one line and a missing root gives empty text", async () => {
  const { toOutlineMarkdown } = await load("mindmap", "exportMindmap.ts");
  const d = doc();
  d.nodes.b.text = "Two\n  lines";
  assert.match(toOutlineMarkdown(d), /- Two lines\n/);
  assert.equal(toOutlineMarkdown({ rootId: "x", nodes: {} }), "");
});

test("svg: valid size, escaped text, every node drawn even when collapsed", async () => {
  const { toSvg } = await load("mindmap", "exportMindmap.ts");
  const { svg, width, height } = toSvg(doc());
  assert.ok(width > 0 && height > 0);
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(svg, /Stock &lt;items&gt; &amp; more/);
  assert.match(svg, /Expiry/);
  assert.equal((svg.match(/<rect x=/g) ?? []).length, 4);
  assert.equal((svg.match(/<path /g) ?? []).length, 3);
});

test("svg: does not mutate the document", async () => {
  const { toSvg } = await load("mindmap", "exportMindmap.ts");
  const d = doc();
  toSvg(d);
  assert.equal(d.nodes.a.collapsed, true);
});

test("wrapText: wraps, truncates after two lines, splits giant words", async () => {
  const { wrapText } = await load("mindmap", "exportMindmap.ts");
  assert.deepEqual(wrapText("short", 20), ["short"]);
  assert.deepEqual(wrapText("alpha beta gamma", 10), ["alpha beta", "gamma"]);
  const cut = wrapText("one two three four five six seven eight", 10);
  assert.equal(cut.length, 2);
  assert.ok(cut[1].endsWith("..."));
  assert.ok(wrapText("x".repeat(60), 10)[0].length <= 10);
  assert.deepEqual(wrapText("   ", 10), []);
});

test("safeFileName: strips unsafe characters and falls back", async () => {
  const { safeFileName } = await load("export", "fileName.ts");
  assert.equal(safeFileName("Mapa / Dispensação: v2", "md", "mindmap"), "Mapa-Dispensacao-v2.md");
  assert.equal(safeFileName("///", "svg", "mindmap"), "mindmap.svg");
  assert.equal(safeFileName("..hidden", "json", "x"), "hidden.json");
});
