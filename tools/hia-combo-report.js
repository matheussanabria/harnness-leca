#!/usr/bin/env node
// @ts-check
// Report of the 9Router combo suggestions recorded by the HIA dispatcher.
// Usage: node tools/hia-combo-report.js [--since 2026-11-01] [--project <slug>] [--sample 30] [--json]
const fs = require("fs");
const path = require("path");
const { ROOT } = require("./lib/root");
const { parseSuggestions, summarize } = require("./lib/hia/combo-report");

const LOG_FILE = path.join(ROOT, "logs/telemetry/hia-executions.jsonl");

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {{since?: string, project?: string, sample?: number, json?: boolean}} */
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") opts.json = true;
    else if (a === "--since") opts.since = argv[++i];
    else if (a === "--project") opts.project = argv[++i];
    else if (a === "--sample") opts.sample = Number(argv[++i]);
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const text = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, "utf8") : "";
  const report = summarize(parseSuggestions(text), opts);
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(`Combo suggestions: ${report.total} (general/default: ${report.generalShare}%)`);
  if (!report.total) {
    console.log(`No suggestions recorded yet in ${path.relative(ROOT, LOG_FILE)}.`);
    return;
  }
  console.log("\nBy type:");
  for (const [k, v] of Object.entries(report.byType)) console.log(`  ${k.padEnd(12)} ${v}`);
  console.log("\nBy engine:");
  for (const [k, v] of Object.entries(report.byEngine)) console.log(`  ${k.padEnd(12)} ${v}`);
  console.log(`\nSample for manual review (${report.sample.length}, newest first):`);
  for (const s of report.sample) console.log(`  [${s.type} -> ${s.combo}] ${s.preview}`);
}

if (require.main === module) main();

module.exports = { parseArgs };
