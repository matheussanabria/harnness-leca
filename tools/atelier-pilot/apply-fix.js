#!/usr/bin/env node
// @ts-check
"use strict";
/**
 * Applies the deterministic contrast repair to a COPY of a prototype and reviews the copy.
 * The source prototype is never touched; HTML is copied unchanged, only an override block is appended to the CSS.
 *
 * Usage: node tools/atelier-pilot/apply-fix.js --proto <srcId> --new <newId> --review-dir <dir>
 *          [--screens home,confirmacao] [--project harness-leca] [--base http://localhost:4321]
 * The review JSON of the source (`<srcId>-<screen>-review.json`, from render-review.js) must already exist.
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const { fixContrast } = require("./contrast-fix");
const { reviewUrl, summarize, launchEdge } = require("./render-review");
const { initPrototype, savePrototypeFiles } = require(path.join(ROOT, "ui/server/services/prototype-storage.service.js"));
const History = require(path.join(ROOT, "ui/server/services/prototype-history.service.js"));

function parseArgs(argv) {
  const args = { project: "harness-leca", base: "http://localhost:4321", screens: ["home"] };
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase());
    const value = argv[(i += 1)];
    args[key] = key === "screens" ? value.split(",") : value;
  }
  return args;
}

const high = (issues) => issues.filter((i) => i.severity === "high").length;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.proto || !args.new || !args.reviewDir) throw new Error("Provide --proto <srcId> --new <newId> --review-dir <dir>.");
  const t0 = Date.now();
  const projectDir = path.join(ROOT, "projects", args.project);
  const srcDir = path.join(projectDir, "design", "prototypes", args.proto);

  const before = {};
  const fixes = [];
  const skipped = [];
  const patches = [];
  for (const screen of args.screens) {
    const report = JSON.parse(fs.readFileSync(path.join(args.reviewDir, `${args.proto}-${screen}-review.json`), "utf8"));
    before[screen] = high(report.issues);
    const res = fixContrast(report.issues, screen);
    fixes.push(...res.fixes.map((f) => ({ screen, ...f })));
    skipped.push(...res.skipped.map((s) => ({ screen, ...s })));
    if (res.css) patches.push(`/* ${screen} */\n${res.css}`);
  }
  const fixMs = Date.now() - t0;

  const files = fs.readdirSync(path.join(srcDir, "screens")).filter((f) => f.endsWith(".html")).map((f) => ({ path: `screens/${f}`, content: fs.readFileSync(path.join(srcDir, "screens", f), "utf8") }));
  const css = fs.readFileSync(path.join(srcDir, "styles", "proto.css"), "utf8").trimEnd();
  files.push({ path: "styles/proto.css", content: patches.length ? `${css}\n\n/* Contrast autofix (deterministic, no model) */\n${patches.join("\n")}\n` : `${css}\n` });
  const srcMeta = JSON.parse(fs.readFileSync(path.join(srcDir, "proto.json"), "utf8")).metadata || {};

  initPrototype(projectDir, args.new, `Contrast autofix of ${args.proto}`);
  History.withHistory(projectDir, args.new, { label: "Contrast autofix", kind: "files", detail: files.map((f) => f.path).join(", ") },
    () => savePrototypeFiles(projectDir, args.new, files, { engine: "script", author: "apply-fix", message: "Contrast autofix", ...(srcMeta.dsComponents ? { dsComponents: true } : {}) }));

  const after = {};
  const remaining = {};
  const browser = await launchEdge();
  try {
    for (const screen of args.screens) {
      const results = await reviewUrl(browser, `${args.base}/api/project/${args.project}/design/prototypes/${args.new}/render/${screen}`, { widths: [360, 390, 768, 1440], outDir: args.reviewDir, name: `${args.new}-${screen}` });
      const issues = summarize(results);
      fs.writeFileSync(path.join(args.reviewDir, `${args.new}-${screen}-review.json`), JSON.stringify({ proto: args.new, screen, issues, results }, null, 2));
      after[screen] = high(issues);
      remaining[screen] = issues.slice(0, 6).map((i) => `${i.severity} @${i.at}: ${i.text}`);
    }
  } finally { await browser.close(); }

  const summary = { source: args.proto, copy: args.new, model: null, tokens: 0, fixSeconds: Math.round(fixMs) / 1000, totalSeconds: Math.round((Date.now() - t0) / 100) / 10, highBefore: before, highAfter: after, fixes, skipped, remaining };
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) main().catch((err) => { console.error("FAILED", err.message); process.exit(1); });
module.exports = { parseArgs };
