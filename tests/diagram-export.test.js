// EP-21.03: export names and texts, SVG helpers and the stored payload (pure, node:test).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const load = (name) => import(pathToFileURL(path.join(__dirname, "../ui/web/src/features/diagram", name)).href);

test("CP-06: export file names are safe for downloads and carry the format extension", async () => {
  const { diagramFileName } = await load("exportName.ts");
  assert.equal(diagramFileName("Fluxo do Pedido", "svg"), "Fluxo-do-Pedido.svg");
  assert.equal(diagramFileName("Fluxo do Pedido", "png"), "Fluxo-do-Pedido.png");
  assert.equal(diagramFileName("Fluxo do Pedido", "mmd"), "Fluxo-do-Pedido.mmd");
  assert.equal(diagramFileName("Fluxo do Pedido", "md"), "Fluxo-do-Pedido.md");
  assert.equal(diagramFileName("a/b\\c:d*e?f", "svg"), "abcdef.svg", "path and reserved characters are dropped");
  assert.equal(diagramFileName("../../etc/passwd", "mmd"), "etcpasswd.mmd");
  assert.equal(diagramFileName("", "svg"), "diagram.svg");
  assert.equal(diagramFileName("   ", "png"), "diagram.png");
  assert.equal(diagramFileName("x".repeat(200), "md").length, 80 + ".md".length, "long titles are cut");
  assert.equal(diagramFileName("Cobrança", "svg"), "Cobranca.svg", "accents are folded");
});

test("toMmd: LF line breaks and exactly one final newline", async () => {
  const { toMmd } = await load("exportText.ts");
  assert.equal(toMmd("flowchart TD\r\n A-->B\r\n\r\n"), "flowchart TD\n A-->B\n");
  assert.equal(toMmd("flowchart TD\n A-->B"), "flowchart TD\n A-->B\n");
  assert.equal(toMmd("a\rb"), "a\nb\n", "a lone CR is a line break too");
});

test("toMarkdownBlock: a mermaid fence, longer than any backtick run inside the source", async () => {
  const { toMarkdownBlock } = await load("exportText.ts");
  assert.equal(toMarkdownBlock("flowchart TD\n A-->B"), "```mermaid\nflowchart TD\n A-->B\n```\n");
  const tricky = toMarkdownBlock('flowchart TD\n A["use ``` aqui"]-->B');
  assert.ok(tricky.startsWith("````mermaid\n"), "four backticks around a source that holds three");
  assert.ok(tricky.endsWith("\n````\n"));
  assert.equal(toMarkdownBlock('A["``````"]').startsWith("```````mermaid\n"), true, "one more than the longest run");
});

test("svgSize reads the viewBox; standaloneSvg adds the namespace and a pixel size; svgDataUrl is UTF-8 safe", async () => {
  const { svgSize, standaloneSvg, svgDataUrl } = await load("svg.ts");
  const mermaidLike = '<svg id="d1" width="100%" xmlns="http://www.w3.org/2000/svg" style="max-width: 115.24px;" viewBox="0 0 115.2421875 188.85"><g/></svg>';
  assert.deepEqual(svgSize(mermaidLike), { width: 116, height: 189 });
  assert.deepEqual(svgSize('<svg viewBox="-10, -5, 300 200"/>'), { width: 300, height: 200 }, "commas and negative origins");
  for (const bad of ["<svg/>", '<svg viewBox="0 0 0 0"/>', '<svg viewBox="a b c d"/>', ""]) assert.deepEqual(svgSize(bad), { width: 800, height: 600 }, bad);

  const standalone = standaloneSvg(mermaidLike);
  assert.ok(standalone.startsWith('<svg width="116" height="189"'), standalone.slice(0, 60));
  assert.ok(!/width="100%"/.test(standalone), "the percentage width is replaced");
  const noNs = standaloneSvg('<svg viewBox="0 0 10 20"><g/></svg>');
  assert.match(noNs, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  const url = svgDataUrl('<svg viewBox="0 0 10 20"><text>Cobrança ção</text></svg>');
  assert.ok(url.startsWith("data:image/svg+xml;charset=utf-8,%3Csvg"));
  assert.match(decodeURIComponent(url), /Cobrança ção/);
});

test("pngScale: keeps the longest side within 8192 px instead of failing", async () => {
  const { pngScale } = await import(pathToFileURL(path.join(__dirname, "../ui/web/src/features/diagram/exportRaster.ts")).href);
  assert.equal(pngScale(400, 300, 2), 2);
  assert.equal(pngScale(5000, 100, 2), 8192 / 5000);
  assert.equal(pngScale(100, 9000, 1), 8192 / 9000);
});

test("readDiagramData: accepts a valid mermaid@1 payload and rejects everything else without throwing", async () => {
  const { readDiagramData, createDiagramData } = await load("data.ts");
  const valid = { schema: "mermaid@1", diagramType: "er", source: "erDiagram\n A ||--o{ B : x" };
  assert.deepEqual(readDiagramData(valid), valid);
  assert.deepEqual(readDiagramData({ ...valid, theme: "dark" }), { ...valid, theme: "dark" });
  assert.deepEqual(readDiagramData({ ...valid, theme: "neon" }), valid, "an unknown theme is dropped, not an error");
  assert.deepEqual(readDiagramData({ ...valid, extra: 1 }), valid, "unknown keys are not copied");
  for (const bad of [null, undefined, 3, "x", [], {}, { ...valid, schema: "mermaid@2" }, { ...valid, source: 5 }, { ...valid, diagramType: "pie" }, { ...valid, diagramType: "" }]) {
    assert.equal(readDiagramData(bad), null, JSON.stringify(bad));
  }
  assert.equal(readDiagramData({ ...valid, source: "x".repeat(64 * 1024 + 1) }), null, "over 64 KB");
  assert.deepEqual(createDiagramData("s", "gantt"), { schema: "mermaid@1", diagramType: "gantt", source: "s" }, "default theme is not stored");
  assert.deepEqual(createDiagramData("s", "gantt", "forest"), { schema: "mermaid@1", diagramType: "gantt", source: "s", theme: "forest" });
});

test("the payload the client builds passes the server's own kind check (canvas-kinds.js)", async () => {
  const { createDiagramData } = await load("data.ts");
  const { KIND_REGISTRY } = require("../ui/server/services/canvas/canvas-kinds.js");
  const check = KIND_REGISTRY.diagram.check;
  assert.equal(typeof check, "function", "the server exposes the diagram check");
  assert.equal(check(createDiagramData("flowchart TD\n A-->B", "flowchart-v2")), true);
  assert.equal(check({ ...createDiagramData("x", "flowchart-v2"), source: "x".repeat(64 * 1024 + 1) }), false, "same 64 KB cap on both sides");
});
