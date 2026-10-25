#!/usr/bin/env node
// @ts-check
"use strict";
/**
 * Imports a Design System in the ".dc.html" format into a project's `design/ds/`.
 *
 * Usage: node tools/import-dc-design-system.js --source <file.dc.html> --palette <palette.json> [--project harness-leca] [--out <root>] [--dry-run]
 *
 * Writes design/ds/tokens.css, components.css, ds-index.md and ds/components/<slug>/<slug>.{html,css}.
 * Exits with code 2 when the palette does not define every token the components read.
 */
const fs = require("fs");
const path = require("path");
const { extractDcDocs, allRequiredTokens } = require("./ds-docs/extract-dc");
const { buildTokensCss, buildComponentsCss, buildIndex } = require("./ds-docs/dc-tokens");
const { writeFiles } = require("./ds-docs/writer");

function parseArgs(argv) {
  const args = { project: "harness-leca", out: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--dry-run") args.dryRun = true;
    else if (key.startsWith("--")) args[key.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = argv[(i += 1)];
  }
  return args;
}

const slug = (id) => String(id).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function mergedDesignJson(designRoot, project, components) {
  const file = path.join(designRoot, "design.json");
  let current = {};
  try { current = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
  const generated = components.map((component) => ({
    id: slug(component.id),
    name: component.name,
    selector: `ds-${slug(component.id)}`,
    dsFolder: `design/ds/components/${slug(component.id)}`,
    feature: "design-system",
  }));
  const byId = new Map([...(current.components || []), ...generated].map((item) => [item.id, item]));
  return { schema: 1, project: current.project || project, prototypes: current.prototypes || [], components: [...byId.values()], features: current.features || [] };
}

function run(args) {
  if (!args.source || !args.palette) throw new Error("Provide --source <file.dc.html> and --palette <palette.json>.");
  const { components, skipped } = extractDcDocs(fs.readFileSync(args.source, "utf8"));
  const palette = JSON.parse(fs.readFileSync(args.palette, "utf8"));
  const required = allRequiredTokens(components);
  const { css: tokensCss, missing } = buildTokensCss(palette, required);

  const designRoot = path.join(args.out, "projects", args.project, "design");
  const designJson = mergedDesignJson(designRoot, args.project, components);
  const files = [
    { rel: "ds/tokens.css", content: tokensCss },
    { rel: "ds/components.css", content: buildComponentsCss(components, typeof palette.overrides === "string" ? palette.overrides : "") },
    { rel: "ds/ds-index.md", content: buildIndex(components, required, palette.name) },
    ...components.flatMap((c) => [
      { rel: `ds/components/${slug(c.id)}/${slug(c.id)}.html`, content: c.html },
      { rel: `ds/components/${slug(c.id)}/${slug(c.id)}.css`, content: c.css },
    ]),
    { rel: "design.json", content: `${JSON.stringify(designJson, null, 2)}\n` },
  ];
  const written = writeFiles(designRoot, files, !!args.dryRun);
  return { components: components.length, skipped, requiredTokens: required.length, missingTokens: missing, files: written.length, dryRun: !!args.dryRun };
}

function main() {
  const report = run(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
  if (report.missingTokens.length) process.exitCode = 2;
}

if (require.main === module) main();
module.exports = { run, parseArgs, mergedDesignJson };
