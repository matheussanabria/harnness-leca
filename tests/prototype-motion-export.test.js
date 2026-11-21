// @ts-check
// EP-24.05: export dialog of the motion player. Pure option helpers plus the real modules in Chrome over a stubbed API.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const PUBLIC = path.join(__dirname, "..", "ui", "public");
const mod = import("../ui/public/js/modules/prototype-motion-export.js");

test("motion-export dialog: fps and size choices per format, summary and size text", async () => {
  const { fpsChoices, scaleChoices, summaryText, sizeText } = await mod;
  assert.deepEqual(fpsChoices("webm", 30), { list: [24, 30, 60], selected: 30 });
  assert.deepEqual(fpsChoices("gif", 60), { list: [12, 15, 24, 30], selected: 15 });
  assert.deepEqual(fpsChoices("mp4", 25), { list: [24, 30, 60], selected: 30 }, "unknown rate falls back to 30");
  assert.deepEqual(scaleChoices("gif", { w: 1920, h: 1080 }).map((o) => o.label), ["50% · 960×540", "25% · 480×270", "100% · 1920×1080"]);
  assert.equal(summaryText(10000, 30, 1), "300 quadros · cerca de 47 s para gerar");
  assert.equal(summaryText(500, 12, 0.5), "6 quadros · cerca de 5 s para gerar");
  assert.equal(sizeText(450000), "0,45 MB");
});

async function tryBrowser() {
  try { return (await require("../tools/atelier-pilot/lib/browser").launchBrowser()).browser; } catch { return null; }
}

test("motion-export dialog in Chrome: unavailable MP4, progress by frame, download link, cancel back to options", async (t) => {
  const browser = await tryBrowser();
  if (!browser) return t.skip("no Chrome or Edge available");
  try {
    const host = `<!doctype html><html><body><div id="atelierMotionBar" class="proto-motion"></div>
      <script type="module">
        import { ctx } from "/js/modules/prototype-atelier-ctx.js";
        import { exportDialogHtml, bindExportDialog, toggleExportDialog } from "/js/modules/prototype-motion-export.js";
        Object.assign(ctx, { slug: "demo", protoId: "ofertas", screen: "home" });
        document.getElementById("atelierMotionBar").innerHTML = '<button data-motion="export">Exportar</button>' + exportDialogHtml();
        bindExportDialog();
        window.__open = () => toggleExportDialog(true, { duration: 2000, fps: 30, size: { w: 1920, h: 1080 } });
        window.__ready = true;
      </script></body></html>`;
    const page = await browser.newPage();
    const calls = [];
    let polls = 0;
    await page.route("**/*", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.origin !== "http://harness.test") return route.abort();
      if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: host });
      if (url.pathname.startsWith("/api/")) {
        calls.push(`${req.method()} ${url.pathname} ${req.postData() || ""}`.trim());
        const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
        if (url.pathname.endsWith("/export-formats")) return json({ ok: true, formats: ["webm", "gif"] });
        if (req.method() === "POST") return json({ ok: true, job: { id: "abcdef123456", status: "queued", format: "gif", frame: 0, total: 0 } }, 202);
        if (req.method() === "DELETE") return json({ ok: true, cancelled: true });
        polls += 1;
        const job = polls < 2 ? { id: "abcdef123456", status: "running", format: "gif", frame: 9, total: 30 } : { id: "abcdef123456", status: "done", format: "gif", frame: 30, total: 30, bytes: 450000 };
        return json({ ok: true, job });
      }
      const file = path.join(PUBLIC, url.pathname);
      if (!file.startsWith(PUBLIC) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ contentType: "text/javascript", body: fs.readFileSync(file, "utf8") });
    });
    await page.goto("http://harness.test/");
    await page.waitForFunction(() => /** @type {any} */ (window).__ready === true);
    await page.evaluate(() => /** @type {any} */ (window).__open());
    await page.waitForSelector('input[name="motionExportFormat"]');
    assert.equal(await page.$eval('input[value="mp4"]', (i) => /** @type {HTMLInputElement} */ (i).disabled), true, "MP4 not offered");
    assert.match(await page.$eval('input[value="mp4"] + span', (e) => e.textContent || ""), /indisponível aqui/);
    await page.click('input[value="gif"] + span');
    assert.equal(await page.$eval('[data-export="fps"]', (s) => /** @type {HTMLSelectElement} */ (s).value), "15");
    assert.match(await page.$eval('[data-export="summary"]', (e) => e.textContent || ""), /^30 quadros/);
    await page.click('[data-export-act="start"]');
    await page.waitForFunction(() => /Quadro 9 de 30/.test(document.querySelector('[data-export="runText"]')?.textContent || ""), null, { timeout: 5000 });
    await page.waitForSelector('[data-export-act="download"]', { timeout: 5000 });
    assert.equal(await page.$eval('[data-export-act="download"]', (a) => a.getAttribute("href")), "/api/project/demo/design/motion/export/abcdef123456/file");
    assert.match(await page.$eval(".proto-motion-export__status", (e) => e.textContent || ""), /GIF.*0,45 MB/);
    assert.ok(calls.some((c) => c.includes("POST /api/project/demo/design/prototypes/ofertas/motion/home/export") && c.includes('"format":"gif"') && c.includes('"fps":15') && c.includes('"scale":0.5')), calls.join("\n"));

    await page.click('[data-export-act="form"]');
    polls = 0;
    await page.click('[data-export-act="start"]');
    await page.waitForSelector('[data-export-act="cancel"]');
    await page.click('[data-export-act="cancel"]');
    assert.ok(calls.some((c) => c.startsWith("DELETE /api/project/demo/design/motion/export/abcdef123456")));
    await page.keyboard.press("Escape");
  } finally {
    await browser.close();
  }
});
