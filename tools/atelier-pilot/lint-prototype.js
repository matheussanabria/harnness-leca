#!/usr/bin/env node
// @ts-check
"use strict";
/**
 * Biome check (lint + format) for prototype HTML/CSS/JS, using quality/biome-prototype/biome.json.
 * The root biome.json only covers ui/web; prototypes live in gitignored projects/, so they need their own config.
 *
 * Usage: node tools/atelier-pilot/lint-prototype.js --project <slug> [--proto <id>] [--fix]
 * Exit code: Biome's (non-zero when it reports errors); 2 for usage errors.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { HERE, mainRepoRoot, projectRoot } = require("./lib/repo-root");

const CONFIG_DIR = path.join(HERE, "quality", "biome-prototype");

function parseArgs(argv) {
  const args = { fix: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--fix") args.fix = true;
    else if (argv[i] === "--project") args.project = argv[(i += 1)];
    else if (argv[i] === "--proto") args.proto = argv[(i += 1)];
  }
  return args;
}

/** Biome entry point: this checkout's node_modules, else the main checkout's (worktrees have none). */
function biomeBin() {
  for (const root of [HERE, mainRepoRoot()]) {
    const bin = path.join(root, "node_modules", "@biomejs", "biome", "bin", "biome");
    if (fs.existsSync(bin)) return bin;
  }
  throw new Error("Biome is not installed. Run: npm install");
}

/** Prototype folder(s) to check; projects/ falls back to the main checkout because it is gitignored. */
function targets(args) {
  const base = path.join(projectRoot(args.project), "projects", args.project, "design", "prototypes");
  return args.proto ? [path.join(base, args.proto)] : [base];
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.project) {
    console.error("Provide --project <slug> [--proto <id>] [--fix].");
    process.exit(2);
  }
  const paths = targets(args);
  const missing = paths.find((p) => !fs.existsSync(p));
  if (missing) {
    console.error(`Not found: ${missing}`);
    process.exit(2);
  }
  const flags = [...(args.fix ? ["--write"] : []), `--config-path=${CONFIG_DIR}`];
  const r = spawnSync(process.execPath, [biomeBin(), "check", ...flags, ...paths], { stdio: "inherit" });
  process.exit(r.status ?? 2);
}

if (require.main === module) main();
module.exports = { parseArgs, targets, biomeBin, CONFIG_DIR };
