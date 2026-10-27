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
const { buildDcShowcase, buildRegistry, dcScreens, enhanceDcLogic, enhanceDcTemplate, referencedComponents, sourceSetFor } = require("./ds-docs/dc-showcase");
const { splitDcArtifact } = require("../ui/server/services/dc-artifact-parser.service");

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

function mergedDesignJson(designRoot, project, components, sourceArtifact = "") {
  const file = path.join(designRoot, "design.json");
  let current = {};
  try { current = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
  const generated = components.map((component) => ({
    id: slug(component.id),
    name: component.name,
    selector: `ds-${slug(component.id)}`,
    dsFolder: `design/ds/components/${slug(component.id)}`,
    feature: "design-system",
    ...(sourceArtifact ? { sourceArtifact } : {}),
  }));
  const byId = new Map([...(current.components || []), ...generated].map((item) => [item.id, item]));
  return { schema: 1, project: current.project || project, prototypes: current.prototypes || [], components: [...byId.values()], features: current.features || [] };
}

function run(args) {
  if (!args.source || !args.palette) throw new Error("Provide --source <file.dc.html> and --palette <palette.json>.");
  const sourceText = fs.readFileSync(args.source, "utf8");
  const { components, skipped } = extractDcDocs(sourceText);
  const palette = JSON.parse(fs.readFileSync(args.palette, "utf8"));
  const required = allRequiredTokens(components);
  const { css: tokensCss, missing } = buildTokensCss(palette, required);

  const designRoot = path.join(args.out, "projects", args.project, "design");
  const designJson = mergedDesignJson(designRoot, args.project, components, args.artifact || "");
  const registry = buildRegistry(components, args.namespace || "m57", args.vitrine || "");
  const files = [
    { rel: "ds/tokens.css", content: tokensCss },
    { rel: "ds/components.css", content: buildComponentsCss(components, typeof palette.overrides === "string" ? palette.overrides : "") },
    { rel: "ds/ds-index.md", content: buildIndex(components, required, palette.name) },
    ...components.flatMap((c) => {
      const id = slug(c.id); const source = sourceSetFor(c);
      return [
        { rel: `ds/components/${id}/${id}.html`, content: source.html },
        { rel: `ds/components/${id}/${id}.css`, content: source.css },
        { rel: `ds/components/${id}/${id}.js`, content: source.js },
        { rel: `ds/components/${id}/${id}.angular.ts`, content: source.angular },
        { rel: `ds/components/${id}/${id}.react.jsx`, content: source.react },
        { rel: `ds/components/${id}/manifest.json`, content: `${JSON.stringify(registry.components[`${args.namespace || "m57"}.${id}`], null, 2)}\n` },
      ];
    }),
    { rel: "ds/registry.json", content: `${JSON.stringify(registry, null, 2)}\n` },
    { rel: "design.json", content: `${JSON.stringify(designJson, null, 2)}\n` },
  ];
  if (args.vitrine) {
    const vitrineOptions = { protoId: args.vitrine,
    title: args.title || "Editable Design System inspection",
    sourceArtifact: args.artifact || "design-system",
    sourceFile: args.sourceFile || path.relative(path.join(args.out, "projects", args.project), args.source).replace(/\\/g, "/"),
    namespace: args.namespace || "m57" };
    files.push(...buildDcShowcase(components, vitrineOptions));
    const parts = splitDcArtifact(sourceText);
    const manifest = {
      schema: "dc-inspection/1", adapter: "dc-design-system-import", inspectionFormat: 5,
      sourceArtifact: vitrineOptions.sourceArtifact, sourceFile: vitrineOptions.sourceFile,
      logicAttrs: parts.logicAttrs, props: parts.props, screens: dcScreens(components).map((screen) => screen.id),
      defaultScreen: "inicio", assets: [], missingAssets: [], warnings: parts.warnings,
    };
    files.push(
      { rel: `prototypes/${args.vitrine}/dc/template.html`, content: enhanceDcTemplate(parts.template) },
      { rel: `prototypes/${args.vitrine}/dc/logic.js`, content: enhanceDcLogic(parts.logic, components, args.namespace || "m57") },
      { rel: `prototypes/${args.vitrine}/dc/helmet.html`, content: parts.helmet },
      { rel: `prototypes/${args.vitrine}/dc/manifest.json`, content: `${JSON.stringify(manifest, null, 2)}\n` },
    );
  }
  if (args.relatedPrototype && args.relatedSource) {
    const protoFile = path.join(designRoot, "prototypes", args.relatedPrototype, "proto.json");
    if (fs.existsSync(protoFile)) {
      const proto = JSON.parse(fs.readFileSync(protoFile, "utf8"));
      proto.components = referencedComponents(fs.readFileSync(args.relatedSource, "utf8"), components, args.namespace || "m57");
      proto.metadata = { ...(proto.metadata || {}), componentCatalog: args.artifact || "design-system", updatedAt: new Date().toISOString() };
      files.push({ rel: `prototypes/${args.relatedPrototype}/proto.json`, content: `${JSON.stringify(proto, null, 2)}\n` });
    }
  }
  const written = writeFiles(designRoot, files, !!args.dryRun);
  return { components: components.length, skipped, requiredTokens: required.length, missingTokens: missing, files: written.length, vitrine: args.vitrine || null, dryRun: !!args.dryRun };
}

function main() {
  const report = run(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
  if (report.missingTokens.length) process.exitCode = 2;
}

if (require.main === module) main();
module.exports = { run, parseArgs, mergedDesignJson };
