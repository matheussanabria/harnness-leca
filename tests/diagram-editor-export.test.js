// EP-21.04: export plan (CP-08, CP-09). Fakes only: no DOM, no Mermaid, no network.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const src = (...parts) => pathToFileURL(path.join(__dirname, "../ui/web/src/features", ...parts)).href;
const load = (...parts) => import(src(...parts));

/** Promise with external resolvers, to control the order in which async work finishes. */

// ---------------------------------------------------------------------------
// CP-08 and CP-09: export plan
// ---------------------------------------------------------------------------

async function plan() {
  const { buildExport, STALE_NOTICE } = await load("diagram", "exportPlan.ts");
  return { buildExport, STALE_NOTICE };
}

const EXPORT_INPUT = {
  title: "Meu fluxo",
  source: "flowchart TD\n A-->B",
  render: { svg: '<svg viewBox="0 0 10 10"></svg>', width: 10, height: 10 },
  hasError: false,
};

const fakeRasterize = (calls) => async (svg) => {
  calls.push(svg);
  return new Blob(["png"], { type: "image/png" });
};

test("CP-08 export: svg produces a .svg file with an SVG blob", async () => {
  const { buildExport } = await plan();
  const out = await buildExport("svg", EXPORT_INPUT, fakeRasterize([]));

  assert.equal(out.ok, true);
  assert.ok(out.fileName.endsWith(".svg"), out.fileName);
  assert.ok(out.blob.type.includes("image/svg"), out.blob.type);
});

test("CP-08 export: mmd produces a .mmd file whose text ends with a newline", async () => {
  const { buildExport } = await plan();
  const out = await buildExport("mmd", EXPORT_INPUT, fakeRasterize([]));

  assert.equal(out.ok, true);
  assert.ok(out.fileName.endsWith(".mmd"), out.fileName);
  const text = await out.blob.text();
  assert.ok(text.endsWith("\n"), JSON.stringify(text));
});

test("CP-08 export: markdown goes to the clipboard as a mermaid code block", async () => {
  const { buildExport } = await plan();
  const out = await buildExport("markdown", EXPORT_INPUT, fakeRasterize([]));

  assert.equal(out.ok, true);
  assert.ok(out.clipboard.includes("```mermaid"), out.clipboard);
});

test("CP-08 export: png calls the rasterizer with the render and produces a .png file", async () => {
  const { buildExport } = await plan();
  const calls = [];
  const out = await buildExport("png", EXPORT_INPUT, fakeRasterize(calls));

  assert.equal(out.ok, true);
  assert.ok(out.fileName.endsWith(".png"), out.fileName);
  assert.deepEqual(calls, [EXPORT_INPUT.render.svg]);
  assert.equal(await out.blob.text(), "png");
});

test("CP-08 export: svg and png without a render fail with a message", async () => {
  const { buildExport } = await plan();
  const input = { ...EXPORT_INPUT, render: null };

  for (const kind of ["svg", "png"]) {
    const out = await buildExport(kind, input, fakeRasterize([]));
    assert.equal(out.ok, false, kind);
    assert.equal(typeof out.message, "string", kind);
    assert.ok(out.message.length > 0, kind);
  }
});

test("CP-08 export: mmd and markdown still work without a render", async () => {
  const { buildExport } = await plan();
  const input = { ...EXPORT_INPUT, render: null };

  const mmd = await buildExport("mmd", input, fakeRasterize([]));
  assert.equal(mmd.ok, true);
  assert.ok(mmd.fileName.endsWith(".mmd"));

  const markdown = await buildExport("markdown", input, fakeRasterize([]));
  assert.equal(markdown.ok, true);
  assert.ok(markdown.clipboard.includes("```mermaid"));
});

test("CP-09 export: with a syntax error, svg and png carry the stale notice", async () => {
  const { buildExport, STALE_NOTICE } = await plan();
  const input = { ...EXPORT_INPUT, hasError: true };

  const svg = await buildExport("svg", input, fakeRasterize([]));
  assert.equal(svg.ok, true);
  assert.equal(svg.notice, STALE_NOTICE);

  const png = await buildExport("png", input, fakeRasterize([]));
  assert.equal(png.ok, true);
  assert.equal(png.notice, STALE_NOTICE);
});

test("CP-09 export: with a syntax error, mmd has no notice and exports the current text", async () => {
  const { buildExport } = await plan();
  const input = { ...EXPORT_INPUT, source: "flowchart TD\n A-->C", hasError: true };

  const out = await buildExport("mmd", input, fakeRasterize([]));

  assert.equal(out.ok, true);
  assert.equal(out.notice, "");
  const text = await out.blob.text();
  assert.ok(text.includes("A-->C"), text);
  assert.ok(!text.includes("A-->B"), text);
});

