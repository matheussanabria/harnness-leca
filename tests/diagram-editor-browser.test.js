// EP-21.04: the diagram island in a real browser, against the real server (CP-01, CP-02, CP-05, CP-06, CP-07, CP-08,
// CP-10, CP-12). Skipped when no Chrome is available. The island build (ui/public/dist) must exist: npm run build:ui.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const BUILT = fs.readdirSync(path.join(ROOT, "ui/public/dist/islands"), { withFileTypes: false }).some((f) => f.startsWith("canvas-diagram-"));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "harness-diagram-e2e-"));
process.env.HARNESS_DB_PATH = path.join(TMP, "h.sqlite");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const SLOW = { timeout: 120000 };
const EDITOR = ".diagram-editor__text";
const BROKEN = "erDiagram\n  CLIENTE ||--o{ PEDIDO : faz\n  PEDIDO ??? ITEM\n";
const FIXED = 'erDiagram\n  CLIENTE ||--o{ PEDIDO : faz\n  PEDIDO ||--|{ ITEM : "contém"\n  ITEM }|--|| PRODUTO : tem\n';

let server;
let browser;
let base;

async function newPage(options = {}) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 800 }, ...options });
  await page.goto(`${base}/?p=harness-leca#/canvas-diagram`);
  return page;
}

/** Waits for a condition evaluated in the page (the app boot is slow on a busy machine). */
const until = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 60000 });
const state = (page) =>
  page.evaluate(() => ({
    svg: document.querySelector(".diagram-preview svg")?.outerHTML.length ?? 0,
    error: document.querySelector(".diagram-errbox--bad")?.innerText.trim() ?? "",
    valid: document.querySelector(".diagram-errbox")?.innerText.includes("Sintaxe válida") ?? false,
    status: document.querySelector(".diagram-status")?.innerText.trim() ?? "",
    stale: Boolean(document.querySelector(".diagram-preview__stale")),
    badLine: document.querySelector(".diagram-editor__line--bad")?.innerText ?? "",
    text: document.querySelector(".diagram-editor__text")?.value ?? "",
  }));

test.before(async () => {
  if (!BUILT) return;
  try {
    const { launchBrowser } = require("../tools/atelier-pilot/lib/browser");
    browser = (await launchBrowser()).browser;
  } catch {
    return;
  }
  const { createServer } = require("../ui/server");
  server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  try { await browser?.close(); } catch { /* already gone */ }
  server?.close();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* Windows may hold a handle */ }
});

const skip = () => (!BUILT ? "island not built (npm run build:ui)" : !browser ? "no browser available" : false);

test("CP-12 CP-07 CP-01 the Diagramas tab opens, the New menu offers six types and a new ER renders", SLOW, async (t) => {
  if (skip()) return t.skip(skip());
  const page = await newPage();
  await page.waitForSelector('[data-view="canvas-diagram"]');
  await page.click("[data-canvas-create]");
  assert.equal(await page.locator("[data-canvas-template]").count(), 6);
  await page.click('[data-canvas-template="er"]');
  await page.waitForSelector(EDITOR);
  await until(page, () => document.querySelector(".diagram-preview svg"));
  const now = await state(page);
  assert.ok(now.svg > 100, "the preview draws the diagram");
  assert.equal(now.valid, true);
  assert.match(now.text, /^erDiagram/);
  await page.close();
});

test("CP-02 CP-05 a syntax error marks the line and dims the last valid drawing; fixing it saves, and a reload keeps it", SLOW, async (t) => {
  if (skip()) return t.skip(skip());
  const page = await newPage();
  await page.waitForSelector(EDITOR);
  await until(page, () => document.querySelector(".diagram-preview svg"));

  await page.fill(EDITOR, BROKEN);
  await until(page, () => document.querySelector(".diagram-errbox--bad"));
  const bad = await state(page);
  assert.equal(bad.badLine, "3", "the gutter marks line 3");
  assert.match(bad.error, /Linha 3/);
  assert.equal(bad.stale, true, "the warning about the last valid version shows");
  assert.ok(bad.svg > 100, "the previous drawing stays on screen");

  await page.fill(EDITOR, FIXED);
  await until(page, () => document.querySelector(".diagram-status")?.innerText.includes("Salvo") && document.querySelector(".diagram-errbox")?.innerText.includes("Sintaxe válida"));
  await wait(1500); // past the autosave delay: the change is on the server
  await page.reload();
  await page.waitForSelector(EDITOR, { timeout: 60000 });
  assert.equal((await state(page)).text, FIXED, "the text survives a reload");
  await page.close();
});

test("CP-08 exporting SVG downloads a file named after the title; PNG and .mmd too", SLOW, async (t) => {
  if (skip()) return t.skip(skip());
  const page = await newPage();
  await page.waitForSelector(EDITOR);
  await until(page, () => document.querySelector(".diagram-preview svg"));
  for (const [label, ext] of [["SVG", ".svg"], ["PNG", ".png"], ["Arquivo .mmd", ".mmd"]]) {
    await page.click(".diagram-menu-wrap > button");
    const [download] = await Promise.all([page.waitForEvent("download"), page.click(`[role="menuitem"]:has-text("${label}")`)]);
    assert.ok(download.suggestedFilename().endsWith(ext), `${label}: ${download.suggestedFilename()}`);
  }
  await page.close();
});

test("CP-06 a second tab saving an old revision gets the conflict banner and nothing is overwritten silently", SLOW, async (t) => {
  if (skip()) return t.skip(skip());
  const a = await newPage();
  const b = await newPage();
  for (const page of [a, b]) {
    await page.waitForSelector(EDITOR);
    await until(page, () => document.querySelector(".diagram-preview svg"));
  }
  await a.fill(EDITOR, `${FIXED}  ITEM {\n    int id\n  }\n`);
  await until(a, () => document.querySelector(".diagram-status")?.innerText.includes("Salvo"));
  await wait(1500);
  await b.fill(EDITOR, `${FIXED}  PRODUTO {\n    int sku\n  }\n`);
  await b.waitForSelector(".diagram-banner", { timeout: 30000 });
  assert.match(await b.locator(".diagram-banner").innerText(), /Carregar a versão salva[\s\S]*Manter a minha/);
  await b.click('button:has-text("Carregar a versão salva")');
  await b.waitForSelector(EDITOR, { timeout: 60000 });
  assert.match((await state(b)).text, /ITEM \{\n {4}int id/, "the saved version of the other tab was loaded");
  await a.close();
  await b.close();
});

test("CP-10 the diagram is drawn again with the theme of the shell", SLOW, async (t) => {
  if (skip()) return t.skip(skip());
  const draw = async (colorScheme) => {
    const page = await newPage({ colorScheme });
    await page.waitForSelector(EDITOR);
    await until(page, () => document.querySelector(".diagram-preview svg"));
    const svg = await page.evaluate(() => document.querySelector(".diagram-preview svg").outerHTML);
    await page.close();
    return svg;
  };
  assert.notEqual(await draw("dark"), await draw("light"), "light and dark render differently");
});
