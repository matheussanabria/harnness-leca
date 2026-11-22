// @ts-check
// EP-24.06: the keyframe panel in Chrome against the real router (API, history and files on disk). Skipped without a browser.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createProjectFixture } = require("./helpers/project-fixture");

const fixture = createProjectFixture();
fixture.activate();

const PROTO = "kf-ui";
const protoDir = path.join(fixture.dir, "design", "prototypes", PROTO);
fs.mkdirSync(path.join(protoDir, "screens"), { recursive: true });
fs.writeFileSync(path.join(protoDir, "proto.json"), JSON.stringify({ schema: 1, id: PROTO, version: 1, screens: [{ id: "home", file: "screens/home.html" }] }));
fs.writeFileSync(path.join(protoDir, "screens", "home.html"), '<main data-pid="p-1"><h1 data-pid="p-2">Ofertas</h1><div data-pid="p-3" style="width:120px;height:40px;background:#ccc">card</div></main>');
const motionFile = path.join(protoDir, "screens", "home.motion.json");
const DOC = { schema: "motion@1", duration: 1800, fps: 30, tracks: [
  { target: "p-2", keys: [{ t: 0, props: { opacity: 0 } }, { t: 500, props: { opacity: 1 }, ease: "ease-out" }] },
  { target: "p-3", keys: [{ t: 300, props: { opacity: 0 } }, { t: 900, props: { opacity: 1 } }, { t: 1500, props: { opacity: 0.5 } }] },
] };
const disk = () => JSON.parse(fs.readFileSync(motionFile, "utf8"));

/** @type {import("node:http").Server} */ let server;
let port = 0;
test.before(async () => {
  fs.writeFileSync(motionFile, JSON.stringify(DOC));
  server = require("../ui/server").createServer(); // the real HTTP gate (methods, host, origin), not only the router
  await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(undefined)));
  port = /** @type {any} */ (server.address()).port;
});
test.after(async () => {
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(() => resolve(undefined)));
  fixture.cleanup();
});

async function tryBrowser() {
  try { return (await require("../tools/atelier-pilot/lib/browser").launchBrowser()).browser; } catch { return null; }
}

/**
 * Waits until the file on disk satisfies `check` (saves are async). Up to 10 s: under the full suite the debounced
 * save can take more than the 3 s this used to allow, which made the test fail only when the machine was busy.
 * @param {(d: any) => boolean} check
 */
async function waitDisk(check) {
  for (let i = 0; i < 200; i += 1) {
    try { if (check(disk())) return disk(); } catch { /* mid-write */ }
    await new Promise((r) => setTimeout(r, 50));
  }
  return disk();
}

test("keyframe panel: opens with one lane per track, drag snaps and saves, arrows and Delete edit, ease saves, layer select follows", async (t) => {
  const browser = await tryBrowser();
  if (!browser) return t.skip("no Chrome or Edge available");
  const origin = `http://127.0.0.1:${port}`;
  const host = `<!doctype html><html><head><link rel="stylesheet" href="/css/design.css"></head><body style="width:1200px">
    <iframe id="atelierIframe" sandbox="allow-scripts" style="width:1100px;height:240px"></iframe>
    <button id="btnAtelierMotion" hidden>Motion</button>
    <div id="atelierMotionBar" class="proto-motion" hidden></div>
    <section id="atelierMotionTimeline" class="motion-tl" hidden></section>
    <script type="module">
      import { ctx } from "/js/modules/prototype-atelier-ctx.js";
      import { setupMotionPlayer } from "/js/modules/prototype-motion-player.js";
      Object.assign(ctx, { slug: ${JSON.stringify(fixture.slug)}, protoId: "${PROTO}", screen: "home" });
      setupMotionPlayer(); window.__ready = true;
      // Same order as the Atelier view: the player listens before the iframe loads.
      document.getElementById("atelierIframe").src = "/api/project/${fixture.slug}/design/prototypes/${PROTO}/render/home";
    </script></body></html>`;
  try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 800 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route(`${origin}/host`, (route) => route.fulfill({ contentType: "text/html", body: host }));
    await page.goto(`${origin}/host`);
    await page.waitForFunction(() => /** @type {any} */ (window).__ready === true);
    await page.waitForSelector("#btnAtelierMotion:not([hidden])", { timeout: 10000 });
    if (await page.$eval("#atelierMotionBar", (b) => /** @type {HTMLElement} */ (b).hidden)) await page.click("#btnAtelierMotion");
    await page.click('[data-motion="timeline"]');
    await page.waitForSelector("#atelierMotionTimeline:not([hidden]) .motion-tl__key", { timeout: 10000 });
    assert.equal(await page.$$eval(".motion-tl__lane", (l) => l.length), 2);
    assert.equal(await page.$$eval(".motion-tl__key", (k) => k.length), 5);

    // Drag p-3's middle key (900 ms) toward 1047 ms: it snaps to the 1033 ms frame and saves.
    const rows = await page.$('[data-tl="rows"]');
    const rowsBox = /** @type {any} */ (await rows?.boundingBox());
    const key = await page.$('.motion-tl__key[data-tl-track="1"][data-tl-key="1"]');
    const box = /** @type {any} */ (await key?.boundingBox());
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(rowsBox.x + rowsBox.width * (1047 / 1800), box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    assert.equal((await waitDisk((d) => d.tracks[1].keys[1].t !== 900)).tracks[1].keys[1].t, 1033);

    // Arrow right moves the selected key one frame; Delete removes it.
    await page.focus('.motion-tl__key[data-tl-track="1"][data-tl-key="1"]');
    await page.keyboard.press("ArrowRight");
    assert.equal((await waitDisk((d) => d.tracks[1].keys[1].t !== 1033)).tracks[1].keys[1].t, 1067);
    await page.keyboard.press("Delete");
    assert.deepEqual((await waitDisk((d) => d.tracks[1].keys.length === 2)).tracks[1].keys.map((/** @type {any} */ k) => k.t), [300, 1500]);

    // Ease from the inspector.
    await page.click('.motion-tl__key[data-tl-track="1"][data-tl-key="1"]');
    await page.selectOption("[data-tl-ease]", "ease-in-out");
    assert.equal((await waitDisk((d) => d.tracks[1].keys[1].ease === "ease-in-out")).tracks[1].keys[1].ease, "ease-in-out");

    // Clicking a layer label selects its track (and asks the iframe to select the element).
    await page.click('.motion-tl__label[data-tl-track="0"]');
    assert.equal(await page.$eval(".motion-tl__label.is-sel", (l) => l.getAttribute("data-tl-track")), "0");
    assert.match(await page.$eval('[data-tl="inspector"] h3', (h) => h.textContent || ""), /0 ms/);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
