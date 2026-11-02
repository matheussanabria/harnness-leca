const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { compareScreen, parseArgs } = require("../tools/atelier-pilot/visual-compare");
const { launchBrowser } = require("../tools/atelier-pilot/lib/browser");

const dataUrl = (html) => `data:text/html;base64,${Buffer.from(html).toString("base64")}`;
const page = (body) => `<!doctype html><html><body style="margin:0;font-family:sans-serif">${body}</body></html>`;

test("parseArgs reads widths, thresholds and the baseline flag", () => {
  const a = parseArgs(["--proto", "p", "--screen", "home", "--widths", "320,800", "--threshold", "0.05", "--update-baseline"]);
  assert.deepEqual(a.widths, [320, 800]);
  assert.equal(a.threshold, 0.05);
  assert.equal(a.updateBaseline, true);
  assert.deepEqual(parseArgs([]).widths, [390, 1440]);
});

// The comparison runs in a real browser; it is skipped on a machine with neither Chrome nor Edge.
let browser = null;
let skipReason = "";
test.before(async () => {
  try {
    ({ browser } = await launchBrowser());
  } catch (err) {
    skipReason = err.message;
  }
});
test.after(async () => {
  if (browser) await browser.close();
});

function opts(dir, extra = {}) {
  return { widths: [320], name: "home", threshold: 0.001, tolerance: 16, updateBaseline: false, baselineDir: path.join(dir, "b"), outDir: path.join(dir, "d"), ...extra };
}

test("browser: first run stores a baseline, an identical second run passes", async (t) => {
  if (!browser) return t.skip(skipReason);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-"));
  try {
    const url = dataUrl(page('<div style="height:200px;background:#336699"></div>'));
    const first = await compareScreen(browser, url, opts(dir));
    assert.equal(first[0].status, "baseline");
    assert.ok(fs.existsSync(path.join(dir, "b", "home-320.png")));
    const second = await compareScreen(browser, url, opts(dir));
    assert.equal(second[0].status, "pass");
    assert.equal(second[0].ratio, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("browser: a colour change fails and writes a diff image", async (t) => {
  if (!browser) return t.skip(skipReason);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-"));
  try {
    await compareScreen(browser, dataUrl(page('<div style="height:200px;background:#336699"></div>')), opts(dir));
    const r = await compareScreen(browser, dataUrl(page('<div style="height:200px;background:#993366"></div>')), opts(dir));
    assert.equal(r[0].status, "fail");
    assert.ok(r[0].ratio > 0.2, `changed block covers about 22% of a 900px page, got ${r[0].ratio}`);
    assert.ok(fs.existsSync(r[0].diff), "diff image is written");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("browser: a taller page fails as a size change even if the top matches", async (t) => {
  if (!browser) return t.skip(skipReason);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-"));
  try {
    await compareScreen(browser, dataUrl(page('<div style="height:1000px;background:#336699"></div>')), opts(dir));
    const r = await compareScreen(browser, dataUrl(page('<div style="height:1000px;background:#336699"></div><div style="height:2px"></div>')), opts(dir));
    assert.equal(r[0].status, "fail");
    assert.match(r[0].note, /size changed/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("browser: --update-baseline replaces the stored image", async (t) => {
  if (!browser) return t.skip(skipReason);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-"));
  try {
    await compareScreen(browser, dataUrl(page('<div style="height:200px;background:#336699"></div>')), opts(dir));
    const changed = dataUrl(page('<div style="height:200px;background:#993366"></div>'));
    const updated = await compareScreen(browser, changed, opts(dir, { updateBaseline: true }));
    assert.equal(updated[0].status, "baseline");
    assert.equal((await compareScreen(browser, changed, opts(dir)))[0].status, "pass");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
