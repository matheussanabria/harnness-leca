#!/usr/bin/env node
// @ts-check
"use strict";
/**
 * Sincroniza o Design System de um projeto com o quadro de componentes (registry.json).
 *
 * Uso: node tools/ds-sync.js [--project <slug>] [--root <repo>] [--apply] [--prune]
 *   Sem --apply: mostra o plano (novos, alterados, sumidos, inválidos) e não grava nada.
 *   --project    projeto (padrão: o ativo em projects/.active)
 *   --prune      com --apply, remove do registro os componentes cuja pasta sumiu
 */
const fs = require("fs");
const path = require("path");
const { planSync, applySync } = require("./lib/ds-sync");

function activeProject(root) {
  const file = path.join(root, "projects", ".active");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim() : "";
}

function printPlan(plan) {
  const line = (label, ids) => console.log(`${label.padEnd(10)} ${ids.length}${ids.length ? `  ${ids.join(", ")}` : ""}`);
  console.log(`Namespace  ${plan.namespace}`);
  line("novos", plan.added);
  line("alterados", plan.changed);
  line("iguais", plan.unchanged);
  line("sumiram", plan.missing);
  if (plan.invalid.length) {
    console.log(`invalidos  ${plan.invalid.length}`);
    for (const item of plan.invalid) console.log(`  - ${item.id}: ${item.problems.join(" ")}`);
  }
}

function main() {
  const argv = process.argv.slice(2);
  const args = { root: process.cwd(), project: "", apply: false, prune: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--apply") args.apply = true;
    else if (argv[i] === "--prune") args.prune = true;
    else if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[(i += 1)];
  }
  const project = args.project || activeProject(args.root);
  if (!project) {
    console.error("Informe --project <slug> (ou defina projects/.active).");
    process.exit(2);
  }
  const projectDir = path.join(args.root, "projects", project);
  const plan = planSync(projectDir);
  printPlan(plan);
  if (!args.apply) {
    console.log("\nDry-run: nada foi gravado. Rode com --apply para sincronizar.");
    return;
  }
  const result = applySync(projectDir, plan, { prune: args.prune });
  console.log(`\nRegistrados: ${result.registered.length}${result.registered.length ? `  ${result.registered.join(", ")}` : ""}`);
  if (args.prune) console.log(`Removidos do registro: ${result.removed.length}${result.removed.length ? `  ${result.removed.join(", ")}` : ""}`);
  for (const err of result.errors) console.log(`Erro em ${err.id}: ${err.error}`);
  if (result.errors.length) process.exitCode = 1;
}

if (require.main === module) main();
module.exports = { activeProject };
