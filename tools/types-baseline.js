#!/usr/bin/env node
// @ts-check
// Baseline de tipos: a divida de tipos nao pode crescer sem decisao registrada.
//
//   node tools/types-baseline.js            compara com o baseline e falha se crescer
//   node tools/types-baseline.js --update   grava o numero atual como novo baseline
//
// O baseline fica em quality/types-baseline.json, versionado: qualquer mudanca nele
// aparece no diff e explica por que a divida mudou.
const fs = require("fs");
const path = require("path");
const { runTsc } = require("./lib/tsc-runner");

const ROOT = path.resolve(__dirname, "..");
const BASELINE_FILE = path.join(ROOT, "quality", "types-baseline.json");

/**
 * @returns {{ errors: number, files: number, checkedAt?: string, note?: string }}
 */
function readBaseline() {
  try {
    const parsed = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"));
    return { errors: Number(parsed.errors) || 0, files: Number(parsed.files) || 0, checkedAt: parsed.checkedAt, note: parsed.note };
  } catch {
    return { errors: 0, files: 0 };
  }
}

/**
 * @param {{ errors: number, files: number, note?: string }} data
 */
function writeBaseline(data) {
  fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
  const payload = {
    checkedAt: new Date().toISOString().slice(0, 10),
    errors: data.errors,
    files: data.files,
    note: data.note || "Baseline de erros de tipo (JSDoc). Nao pode crescer sem decisao registrada.",
  };
  fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function main() {
  const update = process.argv.includes("--update");
  const result = runTsc();
  const baseline = readBaseline();

  if (update) {
    writeBaseline({ errors: result.errors, files: result.files.size });
    console.log(`Baseline de tipos atualizado: ${result.errors} erro(s) em ${result.files.size} arquivo(s).`);
    return;
  }

  if (result.errors > baseline.errors) {
    console.error(`Divida de tipos cresceu: ${result.errors} erro(s), baseline ${baseline.errors}.`);
    console.error("Corrija o que introduziu os erros ou atualize o baseline com decisao registrada.");
    for (const file of [...result.files].slice(0, 10)) console.error(`  - ${file}`);
    process.exit(1);
  }

  if (result.errors < baseline.errors) {
    console.log(`Divida de tipos reduziu: ${result.errors} erro(s), baseline ${baseline.errors}. Atualize o baseline com --update.`);
    return;
  }

  console.log(`Divida de tipos estavel: ${result.errors} erro(s) em ${result.files.size} arquivo(s) (baseline ${baseline.errors}).`);
}

module.exports = { readBaseline, writeBaseline, BASELINE_FILE };

if (require.main === module) main();
