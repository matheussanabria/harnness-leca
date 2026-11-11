#!/usr/bin/env node
// @ts-check
// Playbook generator. One data source (docs/playbook/) plus the DAI repository produce the playbook page.
//   node tools/playbook.js check [--dai <path>]
//   node tools/playbook.js build --out <file.html> [--dai <path>]
// The DAI path comes from --dai, then DAI_PATH (tools/lib/dai.js). It is never hard-coded here.
const fs = require("fs");
const path = require("path");
const { ROOT } = require("./lib/root");
const { getDaiPath } = require("./lib/dai");
const { loadPlaybook, compareWithDai } = require("./lib/playbook/load");
const { readDai } = require("./lib/playbook/dai-source");
const { buildPage } = require("./lib/playbook/build-page");

const DATA_DIR = path.join(ROOT, "docs", "playbook");

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    else args._.push(argv[i]);
  }
  return args;
}

function prepare(args) {
  const daiPath = typeof args.dai === "string" ? path.resolve(args.dai) : getDaiPath();
  if (!daiPath) throw new Error("DAI path not found: pass --dai <path> or set DAI_PATH");
  const { data, issues } = loadPlaybook(DATA_DIR);
  const dai = readDai(daiPath);
  return { data, dai, daiPath, issues: [...issues, ...compareWithDai(data, dai)] };
}

function main(argv) {
  const args = parseArgs(argv);
  const cmd = args._[0];
  if (cmd !== "check" && cmd !== "build") {
    console.error("usage: node tools/playbook.js check|build [--out <file.html>] [--dai <path>]");
    return 2;
  }
  const { data, dai, daiPath, issues } = prepare(args);
  console.log(`DAI: ${daiPath} (${dai.stages.length} stages, ${dai.agents.length} agents)`);
  for (const issue of issues) console.error(`  - ${issue}`);
  if (issues.length) { console.error(`${issues.length} problem(s)`); return 1; }
  if (cmd === "check") { console.log("playbook data OK"); return 0; }
  if (typeof args.out !== "string") { console.error("build needs --out <file.html>"); return 2; }
  const out = path.resolve(args.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buildPage(data, dai));
  console.log(`wrote ${out} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 1; }
}

module.exports = { main, parseArgs };
