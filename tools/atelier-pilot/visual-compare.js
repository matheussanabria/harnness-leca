#!/usr/bin/env node
// @ts-check
"use strict";
/**
 * Visual comparison for a generated Atelier screen: screenshots at several widths against stored baselines.
 * First run (or --update-baseline) stores the baselines; later runs write a diff image and fail above the threshold.
 *
 * Usage: node tools/atelier-pilot/visual-compare.js --proto <id> --screen <id>
 *          [--project harness-leca] [--base http://localhost:4321] [--widths 390,1440]
 *          [--threshold 0.001] [--tolerance 16] [--update-baseline] [--out <dir>]
 * Exit code: 0 pass or baseline written, 1 changed above the threshold, 2 usage or environment error.
 */
const fs = require("fs");
const path = require("path");
const { launchBrowser } = require("./lib/browser");
const { diffPngs } = require("./lib/image-diff");
const { projectRoot } = require("./lib/repo-root");

const DEFAULT_WIDTHS = [390, 1440];

function parseArgs(argv) {
  const args = {
    project: "harness-leca",
    base: "http://localhost:4321",
    widths: DEFAULT_WIDTHS,
    threshold: 0.001,
    tolerance: 16,
    updateBaseline: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    if (key === "update-baseline") {
      args.updateBaseline = true;
      continue;
    }
    const value = argv[(i += 1)];
    if (key === "widths") args.widths = value.split(",").map(Number).filter((n) => n > 0);
    else if (key === "threshold" || key === "tolerance") args[key] = Number(value);
    else args[key] = value;
  }
  return args;
}

/** @param {import("playwright-core").Browser} browser */
async function capture(browser, url, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.goto(url, { waitUntil: "load" });
    return await page.screenshot({ fullPage: true, animations: "disabled" });
  } finally {
    await page.close();
  }
}

/**
 * Compares one screen at several widths. Separate from the CLI so tests can call it.
 * @returns {Promise<{ width: number, status: "baseline"|"pass"|"fail", ratio?: number, diff?: string, note?: string }[]>}
 */
async function compareScreen(browser, url, opts) {
  fs.mkdirSync(opts.baselineDir, { recursive: true });
  const results = [];
  for (const width of opts.widths) {
    const base = path.join(opts.baselineDir, `${opts.name}-${width}.png`);
    const current = await capture(browser, url, width);
    if (opts.updateBaseline || !fs.existsSync(base)) {
      fs.writeFileSync(base, current);
      results.push({ width, status: "baseline", note: `stored ${path.basename(base)}` });
      continue;
    }
    const d = await diffPngs(browser, fs.readFileSync(base), current, { tolerance: opts.tolerance });
    // A different page height is a layout change even when the overlapping area matches.
    const fail = d.sizeMismatch || d.ratio > opts.threshold;
    let diff;
    if (fail) {
      fs.mkdirSync(opts.outDir, { recursive: true });
      diff = path.join(opts.outDir, `${opts.name}-${width}.diff.png`);
      fs.writeFileSync(diff, d.diffPng);
    }
    const note = d.sizeMismatch ? `size changed ${d.sizeA.join("x")} -> ${d.sizeB.join("x")}` : undefined;
    results.push({ width, status: fail ? "fail" : "pass", ratio: Number(d.ratio.toFixed(5)), diff, note });
  }
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.proto || !args.screen) {
    console.error("Provide --proto <id> --screen <id>.");
    process.exit(2);
  }
  const protoDir = path.join(projectRoot(args.project), "projects", args.project, "design", "prototypes", args.proto);
  const url = `${args.base}/api/project/${encodeURIComponent(args.project)}/design/prototypes/${encodeURIComponent(args.proto)}/render/${encodeURIComponent(args.screen)}`;
  const { browser, name: browserName } = await launchBrowser();
  try {
    const baselineDir = path.join(protoDir, "baselines", browserName);
    const results = await compareScreen(browser, url, {
      widths: args.widths,
      name: args.screen,
      threshold: args.threshold,
      tolerance: args.tolerance,
      updateBaseline: args.updateBaseline,
      baselineDir,
      outDir: args.out || path.join(baselineDir, "diff"),
    });
    const failed = results.filter((r) => r.status === "fail").length;
    console.log(JSON.stringify({ proto: args.proto, screen: args.screen, browser: browserName, failed, results }, null, 2));
    process.exitCode = failed ? 1 : 0;
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(2);
  });
}
module.exports = { compareScreen, parseArgs, capture };
