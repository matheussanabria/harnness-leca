// @ts-check
// EP-24.03: Atelier motion player. Pure state rules plus the real modules in a real browser (CP-08, CP-09, keyboard, ARIA).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createProjectFixture } = require("./helpers/project-fixture");
const { renderSandboxScreen } = require("../ui/server/services/prototype-sandbox-renderer.service");

const PUBLIC = path.join(__dirname, "..", "ui", "public");
const stateModule = import("../ui/public/js/modules/prototype-motion-state.js");

test("CP-09: one frame forward at 30 fps from 0 ms seeks to 33 ms, snapped to the frame grid", async () => {
  const { createMotionState, onReady, stepTime } = await stateModule;
  const s = onReady(createMotionState(), { duration: 1000, fps: 30 });
  assert.equal(stepTime(s, 1), 33);
  assert.equal(stepTime({ ...s, time: 40 }, 1), 67);
  assert.equal(stepTime({ ...s, time: 0 }, -1), 0);
  assert.equal(stepTime({ ...s, time: 1000 }, 1), 1000);
});

test("CP-10: a new timeline keeps the current time when it fits, otherwise goes to the new end", async () => {
  const { createMotionState, onReady } = await stateModule;
  const at1500 = { ...onReady(createMotionState(), { duration: 4000, fps: 30 }), time: 1500 };
  assert.equal(onReady(at1500, { duration: 3000, fps: 30 }).time, 1500);
  assert.equal(onReady(at1500, { duration: 1000, fps: 30 }).time, 1000);
});

test("motion-state: format, screen-reader text, end and key times", async () => {
  const { createMotionState, onReady, onEnded, formatTime, timeValueText } = await stateModule;
  assert.equal(formatTime(1250), "00:01.250");
  assert.equal(formatTime(61005), "01:01.005");
  assert.equal(timeValueText(1250, 4000), "1,250 segundo de 4,000");
  const s = onReady(createMotionState(), { duration: 500, fps: 24, tracks: 2, keyTimes: [0, 250, 900], loop: true });
  assert.deepEqual([s.has, s.fps, s.tracks, s.keyTimes, s.loop], [true, 24, 2, [0, 250], true]);
  assert.equal(onEnded({ ...s, playing: true }).playing, false);
  assert.equal(onReady(createMotionState(), { duration: 0 }).has, false);
});

/** @returns {Promise<any>} */
async function tryBrowser() {
  try {
    return (await require("../tools/atelier-pilot/lib/browser").launchBrowser()).browser;
  } catch {
    return null;
  }
}

test("CP-08 and keyboard: the button follows the runtime, the bar opens, arrows step a frame, ARIA is set", async (t) => {
  const browser = await tryBrowser();
  if (!browser) return t.skip("no Chrome or Edge available");
  const fixture = createProjectFixture();
  try {
    const protoDir = path.join(fixture.dir, "design", "prototypes", "mp");
    fs.mkdirSync(path.join(protoDir, "screens"), { recursive: true });
    fs.writeFileSync(path.join(protoDir, "proto.json"), JSON.stringify({ schema: 1, id: "mp", screens: [{ id: "still", file: "screens/still.html" }, { id: "fade", file: "screens/fade.html" }] }));
    for (const id of ["still", "fade"]) fs.writeFileSync(path.join(protoDir, "screens", `${id}.html`), '<div data-pid="p-1">box</div>');
    fs.writeFileSync(path.join(protoDir, "screens", "fade.motion.json"), JSON.stringify({ schema: "motion@1", duration: 1000, fps: 30, tracks: [{ target: "p-1", keys: [{ t: 0, props: { opacity: 0 } }, { t: 1000, props: { opacity: 1 } }] }] }));
    const screens = { still: renderSandboxScreen(fixture.dir, fixture.dir, "mp", "still").html, fade: renderSandboxScreen(fixture.dir, fixture.dir, "mp", "fade").html };
    const host = `<!doctype html><html><body>
      <button id="btnAtelierMotion" hidden>Motion</button>
      <iframe id="atelierIframe" sandbox="allow-scripts" src="/frame/still"></iframe>
      <div id="atelierMotionBar" hidden></div>
      <script type="module">import { setupMotionPlayer } from "/js/modules/prototype-motion-player.js"; setupMotionPlayer(); window.__ready = true;</script>
    </body></html>`;
    const page = await browser.newPage();
    const posted = [];
    await page.exposeFunction("__log", (m) => posted.push(m));
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== "http://harness.test") return route.abort();
      if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: host });
      if (url.pathname.startsWith("/frame/")) return route.fulfill({ contentType: "text/html", body: screens[url.pathname.slice(7)] || "" });
      if (url.pathname.startsWith("/api/")) return route.fulfill({ contentType: "application/json", body: "{}" });
      const file = path.join(PUBLIC, url.pathname);
      if (!file.startsWith(PUBLIC) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ contentType: "text/javascript", body: fs.readFileSync(file, "utf8") });
    });
    await page.goto("http://harness.test/");
    await page.waitForFunction(() => window.__ready === true);
    await page.waitForTimeout(300);
    assert.equal(await page.$eval("#btnAtelierMotion", (b) => b.hidden), true, "hidden without a timeline");

    await page.$eval("#atelierIframe", (f) => { f.src = "/frame/fade"; });
    await page.waitForFunction(() => !document.getElementById("btnAtelierMotion").hidden);
    await page.click("#btnAtelierMotion");
    assert.equal(await page.$eval("#atelierMotionBar", (b) => b.hidden), false);
    assert.equal(await page.$eval("#btnAtelierMotion", (b) => b.getAttribute("aria-pressed")), "true");
    assert.match(await page.$eval('[data-motion="meta"]', (e) => e.textContent), /30 fps · 1 faixa/);

    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.querySelector('[data-motion="time"]').textContent.startsWith("00:00.033"));
    const opacity = await page.frameLocator("#atelierIframe").locator('[data-pid="p-1"]').evaluate((el) => getComputedStyle(el).opacity);
    assert.ok(Math.abs(Number(opacity) - 0.033) < 0.002, `opacity ${opacity}`);
    assert.equal(await page.$eval('[data-motion="scrub"]', (e) => e.getAttribute("aria-valuetext")), "0,033 segundo de 1,000");
    assert.equal(await page.$eval('[data-motion="ticks"]', (e) => e.children.length), 2);

    await page.keyboard.press("Home");
    await page.waitForFunction(() => document.querySelector('[data-motion="time"]').textContent.startsWith("00:00.000"));
    await page.keyboard.press(" "); // focus is on the Motion button: Space is its native click, the bar closes
    await page.waitForFunction(() => document.getElementById("atelierMotionBar").hidden);
    await page.keyboard.press(" ");
    await page.waitForFunction(() => !document.getElementById("atelierMotionBar").hidden);
    await page.focus('[data-motion="scrub"]');
    await page.keyboard.press(" ");
    await page.waitForFunction(() => document.querySelector('[data-motion="play"]').getAttribute("aria-label") === "Pausar");
    await page.waitForFunction(() => document.querySelector('[data-motion="play"]').getAttribute("aria-label") === "Tocar", null, { timeout: 4000 });
    assert.match(await page.$eval('[data-motion="time"]', (e) => e.textContent), /^00:01\.000/);

    await page.$eval("#atelierIframe", (f) => { f.src = "/frame/still"; });
    await page.waitForFunction(() => document.getElementById("btnAtelierMotion").hidden);
    assert.equal(await page.$eval('[data-motion="empty"]', (e) => e.hidden), false, "open bar explains the screen has no animation");
  } finally {
    await browser.close();
    fixture.cleanup();
  }
});
