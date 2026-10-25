const test = require("node:test");
const assert = require("node:assert/strict");
const { fixContrast, fixOne, ratio, parse } = require("../tools/atelier-pilot/contrast-fix");

const issue = (extra) => ({ kind: "contrast", pid: "p-1", element: "a.btn", text: "Go", needed: 4.5, ownsBackground: true, ...extra });
const rgbOf = (s) => parse(s);

test("ratio matches the WCAG reference values", () => {
  assert.equal(Math.round(ratio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })), 21);
  assert.equal(ratio({ r: 119, g: 119, b: 119 }, { r: 255, g: 255, b: 255 }) > 4.4 && ratio({ r: 119, g: 119, b: 119 }, { r: 255, g: 255, b: 255 }) < 4.6, true);
});

test("dark text on a mid orange: only the text moves, and it stays dark", () => {
  // the real hero button of the pilot: rgb(51, 36, 26) on rgb(185, 106, 46) = 3.67:1
  const res = fixOne(issue({ fg: "rgb(51, 36, 26)", bg: "rgb(185, 106, 46)" }), 0.15);
  assert.equal(res.strategy, "text");
  assert.ok(ratio(res.fg, { r: 185, g: 106, b: 46 }) >= 4.65);
  assert.ok(res.fg.r < 51 && res.fg.g < 36 && res.fg.b < 26, "polarity kept: darker, not flipped to light");
});

test("light text that cannot reach the ratio: the background it owns is darkened, the text is untouched", () => {
  // rgb(255, 247, 238) on rgb(185, 106, 46) = 3.83:1; white on this orange is below 4.5, so the text alone cannot fix it
  const res = fixOne(issue({ fg: "rgb(255, 247, 238)", bg: "rgb(185, 106, 46)" }), 0.15);
  assert.equal(res.strategy, "background");
  assert.ok(ratio({ r: 255, g: 247, b: 238 }, res.bg) >= 4.65);
  assert.ok(res.bg.r < 185 && res.bg.g < 106, "the background got darker");
});

test("policy keep-background flips the label instead of repainting a brand-coloured button", () => {
  // rgb(36, 22, 17) on rgb(180, 85, 44) = 3.57:1; black on this orange only reaches 4.27, white reaches 4.92
  const bg = { r: 180, g: 85, b: 44 };
  const keep = fixOne(issue({ fg: "rgb(36, 22, 17)", bg: "rgb(180, 85, 44)" }), 0.15);
  assert.equal(keep.strategy, "background", "the default policy repaints the background");
  assert.ok(keep.bg.r > 180, "and lightens it, which washes the brand colour out");
  const flip = fixOne(issue({ fg: "rgb(36, 22, 17)", bg: "rgb(180, 85, 44)" }), 0.15, "keep-background");
  assert.equal(flip.strategy, "text-flipped");
  assert.ok(flip.fg.r > 200, "the label became light");
  assert.ok(ratio(flip.fg, bg) >= 4.65, "and reaches the ratio on the original colour");
  assert.equal(flip.bg, undefined, "the background is untouched");
  const out = fixContrast([issue({ fg: "rgb(36, 22, 17)", bg: "rgb(180, 85, 44)", pid: "p-9" })], "home", { policy: "keep-background" });
  assert.match(out.css, /\{ color: rgb\(/);
  assert.doesNotMatch(out.css, /background-color/);
});

test("a background owned by another element is never changed", () => {
  const res = fixOne(issue({ fg: "rgb(255, 247, 238)", bg: "rgb(185, 106, 46)", ownsBackground: false }), 0.15);
  assert.match(res.skip, /belongs to another element/);
});

test("fixContrast scopes every rule to one element on one screen and wins by specificity, without !important", () => {
  const out = fixContrast([issue({ fg: "rgb(51, 36, 26)", bg: "rgb(185, 106, 46)", pid: "p-25" })], "home");
  assert.equal(out.fixes.length, 1);
  assert.match(out.css, /^body\[data-screen="home"\] \[data-pid="p-25"\]:not\(#_\) \{ color: rgb\(\d+, \d+, \d+\); \}/);
  assert.doesNotMatch(out.css, /!important/);
});

test("fixContrast skips findings without a data-pid and repeats of the same element, and reports why", () => {
  const out = fixContrast([
    issue({ fg: "rgb(51, 36, 26)", bg: "rgb(185, 106, 46)", pid: "" }),
    issue({ fg: "rgb(51, 36, 26)", bg: "rgb(185, 106, 46)", pid: "p-2" }),
    issue({ fg: "rgb(51, 36, 26)", bg: "rgb(185, 106, 46)", pid: "p-2" }),
    { kind: "overflow", pid: "p-9" },
  ], "home");
  assert.equal(out.fixes.length, 1, "one fix for p-2, not two");
  assert.equal(out.skipped.length, 1);
  assert.match(out.skipped[0].reason, /no data-pid/);
});

test("every applied fix really reaches the required ratio (recomputed independently)", () => {
  const cases = [
    ["rgb(138, 124, 111)", "rgb(32, 19, 13)", 4.5],
    ["rgb(255, 247, 238)", "rgb(185, 106, 46)", 4.5],
    ["rgb(120, 120, 120)", "rgb(255, 255, 255)", 4.5],
    ["rgb(200, 200, 200)", "rgb(255, 255, 255)", 3],
  ];
  for (const [fg, bg, needed] of cases) {
    const res = fixOne(issue({ fg, bg, needed }), 0.15);
    assert.ok(!res.skip, `fixable: ${fg} on ${bg}`);
    const finalFg = res.fg || rgbOf(fg);
    const finalBg = res.bg || rgbOf(bg);
    assert.ok(ratio(finalFg, finalBg) >= needed, `${fg} on ${bg} -> ${ratio(finalFg, finalBg)}`);
  }
});

test("an already readable pair is left alone by the arithmetic (zero change needed)", () => {
  const res = fixOne(issue({ fg: "rgb(0, 0, 0)", bg: "rgb(255, 255, 255)" }), 0.15);
  assert.equal(res.strategy, "text");
  assert.deepEqual(res.fg, { r: 0, g: 0, b: 0 });
});
