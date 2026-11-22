// EP-21.03: the diagram feature against the REAL Mermaid and DOMPurify in headless Chrome (skipped without a browser).
// The feature's .ts files are served with their types stripped by Node itself; mermaid.parse needs a DOM (it fails in
// plain Node with "DOMPurify.addHook is not a function"), which is why this part cannot run under node:test alone.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { stripTypeScriptTypes } = require("node:module");

const WEB_SRC = path.join(__dirname, "..", "ui", "web", "src");
// Some packages do not export ./package.json, so the folder is found from the package's own main file.
const packageDist = (pkg) => {
  const main = require.resolve(pkg);
  const marker = `${path.sep}${pkg}${path.sep}`;
  return path.join(main.slice(0, main.lastIndexOf(marker) + marker.length), "dist");
};
const MERMAID = packageDist("mermaid");
const PURIFY = packageDist("dompurify");

const NL = "\n";
const join = (...lines) => lines.join(NL);
// [name, source, expected source line]; measured on mermaid 11.17.2, the same table as tests/diagram-errors.test.js.
const LINE_CASES = [
  ["plain", join("flowchart TD", " A --> B", " B --x-- ?? C"), 3],
  ["front matter", join("---", "title: T", "---", "flowchart TD", " A --> B", " B --x-- ?? C"), 6],
  ["front matter with --- in a value", join("---", 'title: "a --- b"', "---", "flowchart TD", " A --> B", " B --x-- ?? C"), 6],
  ["leading comments", join("%% c1", "%% c2", "flowchart TD", " A --> B", " B --x-- ?? C"), 5],
  ["interior comments", join("flowchart TD", " A --> B", " %% mid", " %% mid2", " B --x-- ?? C"), 5],
  ["init directive", join('%%{init: {"theme":"dark"}}%%', "flowchart TD", " A --> B", " B --x-- ?? C"), 4],
  ["leading blank lines", join("", "", "flowchart TD", " A --> B", " B --x-- ?? C"), 5],
  ["CRLF", "flowchart TD\r\n A --> B\r\n B --x-- ?? C", 3],
  ["interior blank lines", join("flowchart TD", "", " A --> B", "", " B --x-- ?? C"), 5],
  ["comment eats the blank lines before it", join("flowchart TD", " A --> B", "", " %% note", "", " C --> D", " B --x-- ?? C"), 7],
  ["whitespace-only line", join("flowchart TD", " A --> B", "   ", " B --x-- ?? C"), 4],
];
const TRAILING = join("flowchart TD", " A --> B %% trailing", " B --x-- ?? C"); // error is on line 3; the line with the comment is 2

const SUPPORTED = {
  "flowchart-v2": "flowchart TD\n A[Inicio] --> B{Ok?}\n B -->|sim| C[Fim]",
  sequence: "sequenceDiagram\n A->>B: oi",
  classDiagram: "classDiagram\n A <|-- B",
  stateDiagram: "stateDiagram-v2\n [*] --> A\n A --> B",
  er: "erDiagram\n A ||--o{ B : has",
  gantt: "gantt\n title t\n section s\n a :a1, 2024-01-01, 3d",
};

const EVIL = 'flowchart TD\n A["<img src=x onerror=alert(1)>hi"] --> B["<script>alert(2)</script>"]\n click A "javascript:alert(3)"';

async function tryBrowser() {
  try { return (await require("../tools/atelier-pilot/lib/browser").launchBrowser()).browser; } catch { return null; }
}

const HTML = `<!doctype html><meta charset="utf-8"><title>diagram</title>
<script type="importmap">{"imports":{"mermaid":"/mm/mermaid.esm.min.mjs","dompurify":"/dp/purify.es.mjs"}}</script>
<script type="module">
  import { validateDiagram } from "/src/features/diagram/validate.ts";
  import { renderDiagram, DiagramRenderError } from "/src/features/diagram/render.ts";
  import { svgToPng } from "/src/features/diagram/exportRaster.ts";
  window.api = { validateDiagram, renderDiagram, svgToPng, DiagramRenderError };
  window.__ready = true;
</script>`;

async function serve(page) {
  await page.route("http://localhost:59997/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: HTML });
    const roots = { "/src/": WEB_SRC, "/mm/": MERMAID, "/dp/": PURIFY };
    const prefix = Object.keys(roots).find((key) => url.pathname.startsWith(key));
    if (!prefix) return route.fulfill({ status: 404, body: "" });
    const file = path.join(roots[prefix], url.pathname.slice(prefix.length));
    if (!file.startsWith(roots[prefix]) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
    const code = fs.readFileSync(file, "utf8");
    return route.fulfill({ contentType: "text/javascript", body: file.endsWith(".ts") ? stripTypeScriptTypes(code) : code });
  });
  await page.goto("http://localhost:59997/");
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
}

test("CP-04: real Mermaid: validate accepts the six types, refuses the rest, and reports the line the user typed", async (t) => {
  const browser = await tryBrowser();
  if (!browser) return t.skip("no Chrome or Edge available");
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await serve(page);

    const accepted = await page.evaluate(async (sources) => {
      const out = {};
      for (const [type, source] of Object.entries(sources)) out[type] = await window.api.validateDiagram(source);
      return out;
    }, SUPPORTED);
    for (const [type, result] of Object.entries(accepted)) assert.deepEqual(result, { ok: true, type }, type);

    const lines = await page.evaluate(async (cases) => {
      const out = [];
      for (const [name, source] of cases) out.push([name, await window.api.validateDiagram(source)]);
      return out;
    }, LINE_CASES.map(([name, source]) => [name, source]));
    for (const [index, [name, result]] of lines.entries()) {
      assert.equal(result.ok, false, name);
      assert.equal(result.line, LINE_CASES[index][2], `${name}: ${result.message}`);
      assert.match(result.message, new RegExp(`^Linha ${LINE_CASES[index][2]}: trecho inesperado \\(START_LINK\\) perto de "`), name);
      assert.match(result.message, /Esperado: /, name);
    }

    const trailing = await page.evaluate((source) => window.api.validateDiagram(source), TRAILING);
    assert.equal(trailing.ok, false);
    assert.ok([2, 3].includes(trailing.line), `a trailing %% joins two lines; got line ${trailing.line}`);
    assert.match(trailing.message, /%% trailing B --x--/, "the quoted fragment shows the joined text, which tells where the error really is");

    const refused = await page.evaluate(async () => ({
      mindmap: await window.api.validateDiagram("mindmap\n root\n  a"),
      pie: await window.api.validateDiagram('pie title X\n "a" : 1'),
      unknown: await window.api.validateDiagram("foo bar\n baz"),
      empty: await window.api.validateDiagram(""),
    }));
    assert.match(refused.mindmap.message, /^Mapa mental em Mermaid não é aceito aqui/);
    assert.match(refused.pie.message, /^O tipo "pie" não é aceito neste editor/);
    assert.match(refused.unknown.message, /^Tipo de diagrama não reconhecido/);
    assert.equal(refused.empty.message, "O diagrama está vazio.");
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test("CP-08: real Mermaid: render gives a sanitized SVG with its size, unique ids, themes, and cleans up after a failure", async (t) => {
  const browser = await tryBrowser();
  if (!browser) return t.skip("no Chrome or Edge available");
  try {
    const page = await browser.newPage();
    await serve(page);
    const result = await page.evaluate(async ({ ok, evil, bad }) => {
      const first = await window.api.renderDiagram(ok);
      const second = await window.api.renderDiagram(ok);
      const dark = await window.api.renderDiagram(ok, "dark");
      const hostile = await window.api.renderDiagram(evil);
      let failure = null;
      try { await window.api.renderDiagram(bad); } catch (error) { failure = { isRenderError: error instanceof window.api.DiagramRenderError, line: error.line, message: error.message }; }
      const idOf = (svg) => /<svg[^>]*\sid="([^"]+)"/.exec(svg)?.[1];
      const flags = (svg) => ({ script: /<script/i.test(svg), onerror: /onerror/i.test(svg), jsHref: /javascript:/i.test(svg), foreign: /foreignObject/i.test(svg), img: /<img/i.test(svg), style: /<style/.test(svg) });
      return {
        sizes: [first.width, first.height], startsWithSvg: first.svg.startsWith("<svg"),
        ids: [idOf(first.svg), idOf(second.svg)], sameSvgTwice: first.svg.replace(/harness-diagram-\d+/g, "ID") === second.svg.replace(/harness-diagram-\d+/g, "ID"),
        themeChanged: first.svg.replace(/harness-diagram-\d+/g, "ID") !== dark.svg.replace(/harness-diagram-\d+/g, "ID"),
        okFlags: flags(first.svg), hostileFlags: flags(hostile.svg), failure,
        leftovers: Array.from(document.querySelectorAll('[id^="dharness-diagram-"]')).length,
      };
    }, { ok: SUPPORTED["flowchart-v2"], evil: EVIL, bad: LINE_CASES[1][1] });

    assert.ok(result.startsWithSvg);
    assert.ok(result.sizes[0] > 50 && result.sizes[1] > 50, `size ${result.sizes}`);
    assert.equal(new Set(result.ids).size, 2, `ids must be unique: ${result.ids}`);
    assert.match(String(result.ids[0]), /^harness-diagram-\d+$/);
    assert.equal(result.sameSvgTwice, true, "the same source renders the same diagram");
    assert.equal(result.themeChanged, true, "the dark theme changes the SVG");
    assert.equal(result.okFlags.style, true, "the Mermaid theme <style> survives sanitizing");
    assert.deepEqual({ ...result.hostileFlags, style: undefined }, { script: false, onerror: false, jsHref: false, foreign: false, img: false, style: undefined });
    assert.equal(result.failure?.isRenderError, true);
    assert.equal(result.failure?.line, 6, "the failed render reports the line of the user's text");
    assert.match(String(result.failure?.message), /^Linha 6: /);
    assert.equal(result.leftovers, 0, "a failed render leaves no temporary element behind");
  } finally {
    await browser.close();
  }
});

test("real Mermaid: the PNG export draws the SVG at twice its size and returns a real PNG", async (t) => {
  const browser = await tryBrowser();
  if (!browser) return t.skip("no Chrome or Edge available");
  try {
    const page = await browser.newPage();
    await serve(page);
    const out = await page.evaluate(async (source) => {
      const { svg, width, height } = await window.api.renderDiagram(source);
      const blob = await window.api.svgToPng(svg);
      const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0, 8));
      const bitmap = await createImageBitmap(blob);
      const small = await window.api.svgToPng(svg, { scale: 1, background: "#000000" });
      const smallBitmap = await createImageBitmap(small);
      return { type: blob.type, size: blob.size, bytes, png: [bitmap.width, bitmap.height], natural: [width, height], one: [smallBitmap.width, smallBitmap.height] };
    }, SUPPORTED.sequence);
    assert.equal(out.type, "image/png");
    assert.deepEqual(out.bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "PNG signature");
    assert.ok(out.size > 500);
    assert.deepEqual(out.png, [out.natural[0] * 2, out.natural[1] * 2], "default scale is 2");
    assert.deepEqual(out.one, out.natural, "scale 1 matches the natural size");
  } finally {
    await browser.close();
  }
});
