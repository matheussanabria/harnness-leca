const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { reviewUrl, summarize, launchEdge, parseArgs } = require("../tools/atelier-pilot/render-review");

const dataUrl = (html) => `data:text/html;base64,${Buffer.from(html).toString("base64")}`;
const page = (body, head = "") => `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:sans-serif;color:#222;background:#fff}${head}</style></head><body>${body}</body></html>`;

test("parseArgs reads widths and defaults", () => {
  const a = parseArgs(["--proto", "p", "--screen", "home", "--widths", "390,1440"]);
  assert.deepEqual(a.widths, [390, 1440]);
  assert.equal(a.project, "harness-leca");
  assert.deepEqual(parseArgs([]).widths, [360, 390, 768, 1440]);
});

test("summarize puts high severity first and drops repeats across widths", () => {
  const base = { overflow: { scrolls: false, offenders: [] }, lowContrast: { items: [] }, unstyledLinks: { items: [] }, defaultFont: { count: 0, items: [] }, smallTargets: { items: [] }, structure: { h1: 1, controlsWithoutName: 0 } };
  const wide = { ...base, width: 1440, lowContrast: { items: [{ ratio: 2, needed: 4.5, element: "p", text: "x" }] } };
  const narrow = { ...base, width: 390, lowContrast: wide.lowContrast, structure: { h1: 0, controlsWithoutName: 0 } };
  const out = summarize([wide, narrow]);
  assert.equal(out[0].severity, "high");
  assert.equal(out.filter((i) => /low contrast/.test(i.text)).length, 1, "same finding at two widths is listed once");
  assert.ok(out.some((i) => /expected one h1/.test(i.text)));
});

// The checks run in a real browser. They are skipped on a machine without playwright-core or Edge.
let browser = null;
let skipReason = "";
test.before(async () => {
  try { browser = await launchEdge(); } catch (err) { skipReason = err.message; }
});
test.after(async () => { if (browser) await browser.close(); });

async function review(html, widths = [390]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rr-"));
  try {
    const results = await reviewUrl(browser, dataUrl(html), { widths, outDir: dir, name: "t" });
    assert.ok(fs.existsSync(results[0].screenshot), "a screenshot is written");
    return { results, issues: summarize(results) };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("browser: a clean page has no high-severity issues", async (t) => {
  if (!browser) return t.skip(skipReason);
  const { issues } = await review(page('<header><nav><a href="#" style="color:#124">Home</a></nav></header><main><h1>Title</h1><p>Body text</p></main><footer>f</footer>'));
  assert.deepEqual(issues.filter((i) => i.severity === "high"), []);
});

test("browser: sideways overflow is found at the narrow width only", async (t) => {
  if (!browser) return t.skip(skipReason);
  const body = '<main><h1>T</h1><div style="width:700px;height:20px;background:#eee">wide</div></main>';
  const narrow = await review(page(body), [390]);
  assert.ok(narrow.results[0].overflow.scrolls);
  assert.ok(narrow.issues.some((i) => /scrolls sideways/.test(i.text)));
  const wide = await review(page(body), [1440]);
  assert.equal(wide.results[0].overflow.scrolls, false);
});

test("browser: low contrast is measured against the real background colour", async (t) => {
  if (!browser) return t.skip(skipReason);
  const { issues } = await review(page('<main><h1>T</h1><div style="background:#9a4a22"><p style="color:#a85a32">hard to read</p></div><div style="background:#fff"><p style="color:#a85a32">fine</p></div></main>'));
  const hits = issues.filter((i) => /low contrast/.test(i.text));
  assert.equal(hits.length, 1);
  assert.match(hits[0].text, /hard to read/);
});

test("browser: links to a missing anchor are flagged and existing ones are not", async (t) => {
  if (!browser) return t.skip(skipReason);
  const { issues } = await review(page('<main><h1>T</h1><a href="#planos">ok</a><a href="#ghost">broken</a><section id="planos">p</section></main>'));
  const hits = issues.filter((i) => /missing anchor/.test(i.text));
  assert.equal(hits.length, 1);
  assert.match(hits[0].text, /#ghost/);
});

test("browser: default blue links, default font and small touch targets are flagged", async (t) => {
  if (!browser) return t.skip(skipReason);
  const { issues } = await review(page('<main><h1>T</h1><a href="#">plain link</a><p style="font-family:\'Times New Roman\'">serif default</p><button style="height:30px;width:80px">ok</button></main>'));
  assert.ok(issues.some((i) => /unstyled link/.test(i.text)));
  assert.ok(issues.some((i) => /browser default font/.test(i.text)));
  assert.ok(issues.some((i) => /touch target 80x30/.test(i.text)));
});
