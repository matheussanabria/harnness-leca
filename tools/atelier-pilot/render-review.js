#!/usr/bin/env node
// @ts-check
"use strict";
/**
 * Render review for an Atelier prototype screen: screenshots plus in-page checks at several widths.
 * Drives the Microsoft Edge that is already installed (playwright-core, no browser download).
 *
 * Usage: node tools/atelier-pilot/render-review.js --proto <id> --screen <id> --out <dir>
 *          [--project harness-leca] [--base http://localhost:4321] [--widths 360,390,768,1440]
 */
const fs = require("fs");
const path = require("path");
const { pageChecks } = require("./review-checks");

const DEFAULT_WIDTHS = [360, 390, 768, 1440];

function parseArgs(argv) {
  const args = { project: "harness-leca", base: "http://localhost:4321", widths: DEFAULT_WIDTHS };
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const value = argv[(i += 1)];
    args[key] = key === "widths" ? value.split(",").map(Number).filter((n) => n > 0) : value;
  }
  return args;
}

/** Launches the installed Edge, or fails with a message that says what to do. */
async function launchEdge() {
  let chromium;
  try { ({ chromium } = require("playwright-core")); } catch { throw new Error("playwright-core is not installed. Run: npm install --save-dev --ignore-scripts playwright-core"); }
  try { return await chromium.launch({ channel: "msedge", headless: true }); } catch (err) {
    throw new Error(`Could not start the installed Microsoft Edge (${String(err.message).split("\n")[0]}). The render review needs Edge on this machine.`);
  }
}

/**
 * @param {import("playwright-core").Browser} browser
 * @param {string} url
 * @param {{ widths: number[], outDir: string, name: string }} opts
 */
async function reviewUrl(browser, url, opts) {
  fs.mkdirSync(opts.outDir, { recursive: true });
  const results = [];
  for (const width of opts.widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    try {
      await page.goto(url, { waitUntil: "load" });
      const checks = await page.evaluate(pageChecks, { maxItems: 8 });
      const shot = path.join(opts.outDir, `${opts.name}-${width}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      results.push({ ...checks, screenshot: shot });
    } finally {
      await page.close();
    }
  }
  return results;
}

/** Blocking problems first, then warnings, as short strings a person or a correction prompt can use. */
function summarize(results) {
  const issues = [];
  for (const r of results) {
    const at = `${r.width}px`;
    if (r.overflow.scrolls) issues.push({ severity: "high", at, text: `page scrolls sideways (${r.overflow.scrollWidth}px wide in a ${r.overflow.viewport}px viewport); first offender: ${r.overflow.offenders[0]?.element || "unknown"}` });
    else if (r.overflow.offenders.length) issues.push({ severity: "high", at, text: `content pokes past the right edge: ${r.overflow.offenders.map((o) => o.element).slice(0, 3).join(", ")}` });
    // The computed colours matter: a rule elsewhere can override what the stylesheet seems to say.
    for (const c of r.lowContrast.items) issues.push({ severity: "high", at, kind: "contrast", pid: c.pid, fg: c.fg, bg: c.bg, needed: c.needed, ownsBackground: c.ownsBackground, text: `low contrast ${c.ratio}:1 (needs ${c.needed}) on ${c.element} "${c.text}": the text is ${c.fg} on ${c.bg}` });
    for (const l of r.unstyledLinks.items) issues.push({ severity: "high", at, text: `unstyled link (browser default blue): ${l.element} "${l.text}"` });
    if (r.defaultFont.count) issues.push({ severity: "medium", at, text: `${r.defaultFont.count} element(s) use the browser default font, for example ${r.defaultFont.items[0].element}` });
    for (const t of r.smallTargets.items) issues.push({ severity: "medium", at, text: `touch target ${t.size} (needs 44x44): ${t.element} "${t.text}"` });
    for (const b of r.brokenAnchors ? r.brokenAnchors.items : []) issues.push({ severity: "high", at, text: `link to a missing anchor ${b.href}: ${b.element} "${b.text}"` });
    if (r.structure.h1 !== 1) issues.push({ severity: "medium", at, text: `expected one h1, found ${r.structure.h1}` });
    if (r.structure.controlsWithoutName) issues.push({ severity: "medium", at, text: `${r.structure.controlsWithoutName} link/button without an accessible name` });
  }
  // The same finding at several widths is listed once, with every width it occurs at.
  const grouped = new Map();
  for (const i of issues) {
    const key = `${i.severity}|${i.text}`;
    if (grouped.has(key)) grouped.get(key).widths.push(i.at);
    else grouped.set(key, { ...i, widths: [i.at] });
  }
  return [...grouped.values()]
    .map(({ widths, ...i }) => ({ ...i, at: widths.length > 1 ? widths.join(", ") : widths[0] }))
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.proto || !args.screen || !args.out) throw new Error("Provide --proto <id> --screen <id> --out <dir>.");
  const url = `${args.base}/api/project/${encodeURIComponent(args.project)}/design/prototypes/${encodeURIComponent(args.proto)}/render/${encodeURIComponent(args.screen)}`;
  const browser = await launchEdge();
  try {
    const results = await reviewUrl(browser, url, { widths: args.widths, outDir: args.out, name: `${args.proto}-${args.screen}` });
    const issues = summarize(results);
    const report = { proto: args.proto, screen: args.screen, widths: args.widths, high: issues.filter((i) => i.severity === "high").length, medium: issues.filter((i) => i.severity === "medium").length, issues, results };
    fs.writeFileSync(path.join(args.out, `${args.proto}-${args.screen}-review.json`), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ proto: report.proto, screen: report.screen, high: report.high, medium: report.medium, issues: issues.slice(0, 15), screenshots: results.map((r) => r.screenshot) }, null, 2));
  } finally {
    await browser.close();
  }
}

if (require.main === module) main().catch((err) => { console.error(err.message); process.exit(1); });
module.exports = { reviewUrl, summarize, launchEdge, parseArgs };
