// @ts-check
// EP-24.02: motion runtime in the prototype iframe (ADR-018): keyframe conversion, conditional injection, real seek.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createProjectFixture } = require("./helpers/project-fixture");
const { toKeyframes, cssValue } = require("../ui/public/js/modules/prototype-bridge-motion.js");
const { renderSandboxScreen } = require("../ui/server/services/prototype-sandbox-renderer.service");
const { scriptSafeJson } = require("../ui/server/services/motion-render.service");

const fixture = createProjectFixture();
test.after(() => fixture.cleanup());

const PROTO = "motion-runtime";
const protoDir = path.join(fixture.dir, "design", "prototypes", PROTO);
fs.mkdirSync(path.join(protoDir, "screens"), { recursive: true });
fs.writeFileSync(path.join(protoDir, "proto.json"), JSON.stringify({
  schema: 1, id: PROTO, title: "Runtime", activeScreen: "still",
  screens: [{ id: "still", file: "screens/still.html" }, { id: "fade", file: "screens/fade.html" }, { id: "broken", file: "screens/broken.html" }],
}));
const BOX = '<div data-pid="p-1" style="width:100px;height:40px;background:#000">box</div>';
for (const id of ["still", "fade", "broken"]) fs.writeFileSync(path.join(protoDir, "screens", `${id}.html`), BOX);
const FADE = {
  schema: "motion@1", duration: 1000, fps: 30,
  tracks: [
    { target: "p-1", keys: [{ t: 0, props: { opacity: 0 } }, { t: 1000, props: { opacity: 1 }, ease: "linear" }] },
    { target: "p-404", keys: [{ t: 0, props: { opacity: 0 } }] },
  ],
};
fs.writeFileSync(path.join(protoDir, "screens", "fade.motion.json"), JSON.stringify(FADE));
fs.writeFileSync(path.join(protoDir, "screens", "broken.motion.json"), JSON.stringify({ ...FADE, fps: 25 }));

/** @param {string} screen @param {string} [part] */
const render = (screen, part) => renderSandboxScreen(fixture.dir, fixture.dir, PROTO, screen, { part });

test("toKeyframes: offsets over the timeline, edge keys, carried props and ease on the previous frame", () => {
  const frames = toKeyframes({ keys: [
    { t: 250, props: { opacity: 0, transform: "translateY(20px)" } },
    { t: 500, props: { opacity: 1 }, ease: "ease-out" },
    { t: 750, props: { transform: "translateY(0)", width: 120 } },
  ] }, 1000);
  assert.deepEqual(frames.map((f) => f.offset), [0, 0.25, 0.5, 0.75, 1]);
  assert.equal(frames[1].easing, "ease-out");
  assert.equal(frames[2].transform, "translateY(20px)");
  assert.equal(frames[0].width, "120px");
  assert.equal(frames[4].easing, undefined);
  assert.deepEqual(frames[3], { offset: 0.75, opacity: 1, transform: "translateY(0)", width: "120px" });
});

test("toKeyframes: unsorted keys are ordered and css names become camelCase", () => {
  const frames = toKeyframes({ keys: [{ t: 1000, props: { "background-color": "red" } }, { t: 0, props: { "background-color": "blue" } }] }, 1000);
  assert.deepEqual(frames, [{ offset: 0, backgroundColor: "blue" }, { offset: 1, backgroundColor: "red" }]);
  assert.equal(cssValue("opacity", 0.5), 0.5);
  assert.equal(cssValue("border-radius", 8), "8px");
  assert.equal(cssValue("stroke-dashoffset", 30), "30");
});

test("CP-06: a screen without a timeline renders without the motion script", () => {
  const html = render("still").html;
  assert.doesNotMatch(html, /harness-motion|__harnessMotion/);
});

test("motion render: valid timeline injects JSON and runtime; invalid timeline and content part do not", () => {
  const html = render("fade").html;
  assert.match(html, /<script type="application\/json" id="harness-motion">/);
  assert.match(html, /__harnessMotion/);
  assert.doesNotMatch(render("broken").html, /__harnessMotion/);
  assert.doesNotMatch(render("fade", "content").html, /__harnessMotion/);
});

test("motion render: timeline JSON cannot close the script element", () => {
  const out = scriptSafeJson({ v: "</script><img src=x>" });
  assert.doesNotMatch(out, /<|>/);
  assert.deepEqual(JSON.parse(out), { v: "</script><img src=x>" });
});

/** Loads the shared Atelier pilot launcher; null when no browser is installed. */
async function tryBrowser() {
  try {
    const { launchBrowser } = require("../tools/atelier-pilot/lib/browser");
    return (await launchBrowser()).browser;
  } catch {
    return null;
  }
}

test("CP-05 and CP-07: SEEK in the iframe shows the exact frame and orphan tracks do not break READY", async (t) => {
  const browser = await tryBrowser();
  if (!browser) return t.skip("no Chrome or Edge available");
  try {
    const page = await browser.newPage();
    await page.route(/^https?:/, (route) => route.abort());
    await page.setContent("<iframe id=\"f\" style=\"width:400px;height:200px\"></iframe>");
    const result = await page.evaluate(async (html) => {
      const frame = /** @type {HTMLIFrameElement} */ (document.getElementById("f"));
      /** @type {Record<string, any>} */
      const got = {};
      const wait = (type) => new Promise((resolve) => {
        const on = (e) => { if (e.data && e.data.type === type) { window.removeEventListener("message", on); resolve(e.data); } };
        window.addEventListener("message", on);
      });
      const readyP = wait("HARNESS_MOTION_READY");
      frame.srcdoc = html;
      got.ready = await readyP;
      const seekedP = wait("HARNESS_MOTION_SEEKED");
      frame.contentWindow?.postMessage({ type: "HARNESS_MOTION_SEEK", ms: 500 }, "*");
      got.seeked = await seekedP;
      const el = frame.contentDocument?.querySelector('[data-pid="p-1"]');
      got.opacity = el ? getComputedStyle(el).opacity : null;
      return got;
    }, render("fade").html);
    assert.equal(result.ready.duration, 1000);
    assert.equal(result.ready.tracks, 1, "the orphan track p-404 is skipped");
    assert.equal(result.seeked.ms, 500);
    assert.equal(Number(result.opacity), 0.5);
  } finally {
    await browser.close();
  }
});
