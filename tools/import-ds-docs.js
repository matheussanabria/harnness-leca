#!/usr/bin/env node
// @ts-check
"use strict";
/**
 * Recria o DIS Design System a partir do HTML publicado (window.DOCS):
 *  - design/ds/components/<nome>/ (HTML, CSS, JS, React, Angular, manifest) + registry.json;
 *  - design/ds/tokens.css e design/ds/components.css;
 *  - protótipo editável do fluxo do paciente (8 telas com navegação goto:);
 *  - protótipo da vitrine do DS (fundamentos e uma tela por componente).
 *
 * Uso: node tools/import-ds-docs.js --source <dis-design-system.html> [--project saude-dispensacao]
 *        [--root <repo>] [--out <repo de saída>] [--assets <pasta com os PNG>] [--site <site-capture.json>] [--force] [--force-protos] [--dry-run]
 */
const fs = require("fs");
const path = require("path");
const { extractDocs, kebab, isScreenModel } = require("./ds-docs/extract");
const { buildAllComponents, registerAll } = require("./ds-docs/components");
const { buildRootClassMap } = require("./ds-docs/screen-transform");
const { buildPatientPrototype } = require("./ds-docs/patient-flow");
const { buildShowcasePrototype } = require("./ds-docs/showcase");
const { writeFiles, dataUri, updateDesignIndex } = require("./ds-docs/writer");
const { buildDocsSitePrototype } = require("./ds-docs/docs-site");
const { snippetsFor } = require("./ds-docs/showcase");

const LEGACY_TOKENS = `
/* Compatibilidade: tokens antigos usados por protótipos anteriores (dis-modular). */
:root {
  --space-xxs: 2px; --space-xs: 4px; --space-sm: 8px; --space-md: 12px; --space-lg: 16px; --space-xl: 24px; --space-xxl: 32px;
  --radius-xs: 2px; --radius-sm: 4px; --radius-md: 6px; --radius-lg: 8px; --radius-full: 9999px;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}
`;

function parseArgs(argv) {
  const args = { project: "saude-dispensacao", root: process.cwd(), protoId: "dis-paciente", vitrineId: "dis-ds-vitrine" };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--force" || key === "--force-protos" || key === "--dry-run") args[key.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = true;
    else if (key.startsWith("--")) args[key.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = argv[(i += 1)];
  }
  args.out = args.out || args.root;
  return args;
}

function loadAssets(dir) {
  const png = (name) => dataUri(path.join(dir, name));
  const logo = png("6dcc80f34d52972ca0f7dfb4d2675a25.png");
  const coat = png("822eb157d58ce4882b9e83babef9964e.png");
  const signature = png("4d23f8b85adb1816b2d80f67b4b5d7ea.png");
  return {
    "logo-dis.svg": logo,
    "/assets/logo-dis.svg": logo,
    "/assets/brasao-pmpa.png": coat,
    "https://www.procempa.com.br/img/desenvolvimento_procempa.svg": signature,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.source) throw new Error("Informe --source <dis-design-system.html>.");
  const projectRel = path.join("projects", args.project);
  const designDir = path.join(args.out, projectRel, "design");
  const assetsDir = args.assets || path.join(args.root, projectRel, "design", "dis-fluxo-paciente", "assets");
  const docs = extractDocs(fs.readFileSync(args.source, "utf8"));
  const built = buildAllComponents(docs);
  const rootMap = buildRootClassMap(built.map((b) => ({ id: b.id, html: docs.components[Object.keys(docs.components).find((n) => `dis.${kebab(n)}` === b.id)].html })));
  const ctx = { assets: loadAssets(assetsDir), rootMap, demoRootMap: rootMap, wide: docs.wide, protoId: args.protoId };

  const report = {};
  const projectOut = path.join(args.out, projectRel);
  if (!args.dryRun) fs.mkdirSync(path.join(designDir, "ds"), { recursive: true });
  const registryFile = path.join(projectOut, "design", "ds", "registry.json");
  if (!fs.existsSync(registryFile) && fs.existsSync(path.join(args.root, projectRel, "design", "ds", "registry.json"))) {
    fs.mkdirSync(path.dirname(registryFile), { recursive: true });
    fs.copyFileSync(path.join(args.root, projectRel, "design", "ds", "registry.json"), registryFile);
  }
  const indexFile = path.join(designDir, "design.json");
  const rootIndex = path.join(args.root, projectRel, "design", "design.json");
  if (!fs.existsSync(indexFile) && fs.existsSync(rootIndex) && !args.dryRun) fs.copyFileSync(rootIndex, indexFile);
  const reg = args.dryRun ? { written: built.map((b) => b.id), skipped: [] } : registerAll(projectOut, built, { force: !!args.force });
  const keep = new Set(reg.written);
  report.components = writeFiles(path.join(args.out, projectRel, "design"), built.filter((b) => keep.has(b.id)).flatMap((b) => b.files), args.dryRun).length;
  report.skippedComponents = reg.skipped;

  const base = [
    { rel: "design/ds/tokens.css", content: `${docs.tokensCss.trimEnd()}\n${LEGACY_TOKENS}` },
    { rel: "design/ds/components.css", content: `/* DIS Design System: CSS de todos os componentes (gerado por tools/import-ds-docs.js). */\n${docs.bundleCss}\n` },
  ];
  writeFiles(projectOut, base, args.dryRun);

  const siteCapture = args.site ? JSON.parse(fs.readFileSync(args.site, "utf8")) : null;
  const protos = [
    { id: args.protoId, title: "DIS — Fluxo do paciente (editável)", files: buildPatientPrototype(docs, ctx) },
    { id: args.vitrineId, title: "DIS Design System (editável)", files: siteCapture ? buildDocsSitePrototype(docs, siteCapture, { ...ctx, protoId: args.vitrineId }, snippetsFor) : buildShowcasePrototype(docs, { ...ctx, protoId: args.vitrineId }) },
  ];
  report.prototypes = {};
  for (const proto of protos) {
    const exists = fs.existsSync(path.join(args.root, projectRel, "design", "prototypes", proto.id)) || fs.existsSync(path.join(designDir, "prototypes", proto.id));
    if (exists && !args.force && !args.forceProtos) { report.prototypes[proto.id] = "já existe (use --force)"; continue; }
    report.prototypes[proto.id] = `${writeFiles(projectOut, proto.files, args.dryRun).length} arquivos`;
  }
  report.designIndex = updateDesignIndex(designDir, protos.map((p) => ({ id: p.id, title: p.title, file: `design/prototypes/${p.id}/proto.json` })), args.dryRun);
  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) main();
module.exports = { parseArgs, loadAssets, LEGACY_TOKENS, isScreenModel };
