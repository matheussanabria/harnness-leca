// @ts-check
// Atelier preview header in a narrow column (found in EP-24.03): every toolbar button stays visible; nothing is clipped.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const PUBLIC = path.join(__dirname, "..", "ui", "public");

async function tryBrowser() {
  try { return (await require("../tools/atelier-pilot/lib/browser").launchBrowser()).browser; } catch { return null; }
}

/** Real view markup and real CSS, with the preview column forced to `width` px; returns clipped buttons and overflow. */
async function measure(browser, width) {
  const host = `<!doctype html><html><head><link rel="stylesheet" href="/css/index.css"></head><body>
    <div id="root" style="width:${width}px;height:700px;display:flex"></div>
    <script type="module">
      import { renderAtelierHtml } from "/js/modules/prototype-atelier-view.js";
      const model = { slug: "demo", prototypeId: "ofertas", activeScreen: "home", viewportWidth: 1280, catalog: [], protoComponents: [], mcpServer: "", versions: [],
        prototype: { title: "Ofertas", version: 1, screens: [{ id: "home", title: "Ofertas" }] } };
      const root = document.getElementById("root");
      root.innerHTML = renderAtelierHtml(model);
      for (const sel of [".proto-col-catalog", ".proto-col-chat", ".proto-col-inspector", ".proto-resizer"]) root.querySelectorAll(sel).forEach((el) => { el.style.display = "none"; });
      const col = root.querySelector(".proto-col-preview");
      col.style.flex = "0 0 ${width}px"; col.style.width = "${width}px";
      document.getElementById("btnAtelierMotion").hidden = false;
      window.__ready = true;
    </script></body></html>`;
  const page = await browser.newPage({ viewport: { width: Math.max(width + 40, 400), height: 800 } });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== "http://harness.test") return route.abort();
    if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: host });
    const file = path.join(PUBLIC, url.pathname);
    if (!file.startsWith(PUBLIC) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: file.endsWith(".css") ? "text/css" : "text/javascript", body: fs.readFileSync(file, "utf8") });
  });
  await page.goto("http://harness.test/");
  await page.waitForFunction(() => /** @type {any} */ (window).__ready === true);
  const result = await page.evaluate(() => {
    const header = /** @type {HTMLElement} */ (document.querySelector(".proto-preview-header"));
    const col = /** @type {HTMLElement} */ (document.querySelector(".proto-col-preview")).getBoundingClientRect();
    const clipped = Array.from(header.querySelectorAll("button, select"))
      .filter((el) => /** @type {HTMLElement} */ (el).offsetParent !== null)
      .filter((el) => { const r = el.getBoundingClientRect(); return r.right > col.right + 0.5 || r.left < col.left - 0.5; })
      .map((el) => el.id || el.textContent?.trim() || el.tagName);
    return { clipped, overflow: header.scrollWidth - header.clientWidth, height: header.getBoundingClientRect().height };
  });
  await page.close();
  return result;
}

test("CP-01: at 592 px (chat open, 1500 px window) every Atelier header button is visible", async (t) => {
  const browser = await tryBrowser();
  if (!browser) return t.skip("no Chrome or Edge available");
  try {
    for (const width of [592, 420]) {
      const { clipped, overflow } = await measure(browser, width);
      assert.deepEqual(clipped, [], `clipped at ${width}px`);
      assert.ok(overflow <= 0, `header overflows by ${overflow}px at ${width}px`);
    }
  } finally {
    await browser.close();
  }
});

test("CP-02: at 1280 px the header stays on a single row", async (t) => {
  const browser = await tryBrowser();
  if (!browser) return t.skip("no Chrome or Edge available");
  try {
    const { clipped, overflow, height } = await measure(browser, 1280);
    assert.deepEqual(clipped, []);
    assert.ok(overflow <= 0);
    assert.ok(height < 50, `header is ${height}px tall at 1280px (one row expected)`);
  } finally {
    await browser.close();
  }
});
