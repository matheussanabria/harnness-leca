// @ts-check
"use strict";

/**
 * Deterministic contrast repair for render-review findings. No model: given the measured text and background
 * colours and the required ratio, the smallest colour change that reaches it is arithmetic.
 *
 * Rules, in order:
 *  1. Keep the polarity of the text (light stays light, dark stays dark) and move the TEXT colour only as far as needed.
 *  2. If the text cannot get there, change the BACKGROUND, but only when the element itself owns it; otherwise skip,
 *     because darkening a card could hurt other text on it.
 *  3. Anything else is skipped and reported, never guessed.
 * Every fix is scoped to one element (data-pid) on one screen and wins by specificity, not by !important.
 */

const BLACK = { r: 0, g: 0, b: 0 };
const WHITE = { r: 255, g: 255, b: 255 };

function parse(value) {
  const m = /rgba?\(([^)]+)\)/.exec(value || "");
  if (!m) return null;
  const p = m[1].split(",").map((s) => parseFloat(s));
  return { r: p[0], g: p[1], b: p[2] };
}
const lin = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
function ratio(a, b) { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); }
const mix = (a, b, t) => ({ r: Math.round(a.r + (b.r - a.r) * t), g: Math.round(a.g + (b.g - a.g) * t), b: Math.round(a.b + (b.b - a.b) * t) });
const css = (c) => `rgb(${c.r}, ${c.g}, ${c.b})`;

/** Moves `from` toward `toward` in 2% steps until `ok` holds; null when even the extreme fails. */
function moveUntil(from, toward, ok) {
  for (let step = 0; step <= 50; step += 1) {
    const c = mix(from, toward, step / 50);
    if (ok(c)) return c;
  }
  return null;
}

/**
 * @param {{ fg: string, bg: string, needed: number, ownsBackground?: boolean }} issue
 * @param {number} margin extra ratio so rounding cannot leave the result just below the limit
 */
function fixOne(issue, margin, policy = "keep-polarity") {
  const fg = parse(issue.fg);
  const bg = parse(issue.bg);
  if (!fg || !bg) return { skip: "colours could not be read" };
  const need = issue.needed + margin;
  const lightText = lum(fg) > lum(bg);

  const text = moveUntil(fg, lightText ? WHITE : BLACK, (c) => ratio(c, bg) >= need);
  if (text) return { strategy: "text", fg: text, ratio: ratio(text, bg) };
  // Policy "keep-background": flip the label to the other polarity before repainting the background, so a
  // brand-coloured button keeps its colour (white label on terracotta, not a pale button with a dark label).
  if (policy === "keep-background") {
    const flipped = moveUntil(fg, lightText ? BLACK : WHITE, (c) => ratio(c, bg) >= need);
    if (flipped) return { strategy: "text-flipped", fg: flipped, ratio: ratio(flipped, bg) };
  }

  if (!issue.ownsBackground) return { skip: "the text cannot reach the ratio on its own and the background belongs to another element" };
  const back = moveUntil(bg, lightText ? BLACK : WHITE, (c) => ratio(fg, c) >= need);
  if (back) return { strategy: "background", bg: back, ratio: ratio(fg, back) };
  return { skip: "no colour change on this element reaches the ratio" };
}

/**
 * @param {Array<{ kind?: string, pid?: string, fg?: string, bg?: string, needed?: number, ownsBackground?: boolean, element?: string, text?: string }>} issues contrast findings of one screen
 * @param {string} screen screen id the findings belong to
 * @param {{ margin?: number, policy?: "keep-polarity" | "keep-background" }} [opts]
 */
function fixContrast(issues, screen, opts = {}) {
  const margin = opts.margin == null ? 0.15 : opts.margin;
  const fixes = [];
  const skipped = [];
  const done = new Set();
  for (const issue of issues.filter((i) => i.kind === "contrast")) {
    const label = `${issue.element || "element"} "${issue.text || ""}"`;
    if (!issue.pid) { skipped.push({ label, reason: "the element has no data-pid to target" }); continue; }
    if (done.has(issue.pid)) continue;
    done.add(issue.pid);
    const res = fixOne(/** @type {any} */ (issue), margin, opts.policy);
    if (res.skip) skipped.push({ label, pid: issue.pid, reason: res.skip });
    else fixes.push({ pid: issue.pid, label, strategy: res.strategy, from: { fg: issue.fg, bg: issue.bg }, fg: res.fg ? css(res.fg) : null, bg: res.bg ? css(res.bg) : null, ratio: Math.round(res.ratio * 100) / 100 });
  }
  const rules = fixes.map((f) => {
    const decl = [f.fg ? `color: ${f.fg}` : "", f.bg ? `background-color: ${f.bg}` : ""].filter(Boolean).join("; ");
    return `body[data-screen="${screen}"] [data-pid="${f.pid}"]:not(#_) { ${decl}; } /* ${f.label}: ${f.strategy} */`;
  });
  return { fixes, skipped, css: rules.join("\n") };
}

module.exports = { fixContrast, fixOne, ratio, parse };
