#!/usr/bin/env node
// @ts-check
// Verifica o indice mestre do programa de evolucao (docs/harness-evolution/00-index.md):
// links quebrados, contagem de cada epico (tabela x checklist x cabecalho) e totais declarados.
//
//   node tools/verify-index.js
//
// Sai com codigo 1 quando encontra divergencia. Pensado para rodar depois de mexer no
// indice, para que dois agentes nao voltem a declarar numeros diferentes.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INDEX = path.join(ROOT, "docs", "harness-evolution", "00-index.md");
const PROGRESS = path.join(ROOT, "docs", "harness-evolution", "05-progress", "progress.md");

/**
 * @param {string} file
 * @returns {string}
 */
function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

/**
 * @param {string} text
 * @returns {{ done: number, total: number }}
 */
function countCheckboxes(text) {
  const done = (text.match(/^- \[x\]/gm) || []).length;
  const total = (text.match(/^- \[[ x]\]/gm) || []).length;
  return { done, total };
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function brokenLinks(text) {
  const problems = [];
  const re = /\]\(([^)#][^)]*)\)/g;
  let m;
  while ((m = re.exec(text))) {
    const target = m[1].split("#")[0].trim();
    if (!target || /^(https?:|mailto:)/.test(target)) continue;
    if (!fs.existsSync(path.resolve(path.dirname(INDEX), target))) problems.push(target);
  }
  return problems;
}

/**
 * @param {string} text
 * @returns {Map<string, { done: number, total: number }>}
 */
function tableRows(text) {
  const rows = new Map();
  const re = /^\| \[(EP-\d+)\]\([^)]+\) \| .+? \| P\d \| .+? \| (\d+)\/(\d+) \|$/gm;
  let m;
  while ((m = re.exec(text))) rows.set(m[1], { done: Number(m[2]), total: Number(m[3]) });
  return rows;
}

/**
 * @param {string} text
 * @returns {Map<string, { done: number, total: number, boxes: number, checked: number }>}
 */
function sections(text) {
  const out = new Map();
  const lines = text.split("\n");
  let current = null;
  for (const line of lines) {
    const head = /^### (EP-\d+) .+? \((\d+)\/(\d+)\)/.exec(line);
    if (head) {
      current = head[1];
      out.set(current, { done: Number(head[2]), total: Number(head[3]), boxes: 0, checked: 0 });
      continue;
    }
    if (!current) continue;
    if (/^### /.test(line)) {
      current = null;
      continue;
    }
    const item = /^- \[( |x)\]/.exec(line);
    if (item) {
      const section = out.get(current);
      section.boxes += 1;
      if (item[1] === "x") section.checked += 1;
    }
  }
  return out;
}

function main() {
  const text = read(INDEX);
  if (!text) {
    console.error("Indice mestre nao encontrado.");
    process.exit(1);
  }

  const problems = [];
  const rows = tableRows(text);
  const secs = sections(text);

  let totalDone = 0;
  let totalAll = 0;
  for (const [ep, row] of rows) {
    totalDone += row.done;
    totalAll += row.total;
    const sec = secs.get(ep);
    if (!sec) {
      problems.push(`${ep}: sem secao de checklist no indice.`);
      continue;
    }
    if (sec.done !== sec.checked) problems.push(`${ep}: cabecalho diz ${sec.done}, checklist tem ${sec.checked} marcadas.`);
    if (row.done !== sec.checked) problems.push(`${ep}: tabela diz ${row.done}, checklist tem ${sec.checked} marcadas.`);
    if (row.total !== sec.boxes) problems.push(`${ep}: tabela diz ${row.total} historias, checklist tem ${sec.boxes}.`);
  }

  const snapshot = /Snapshot verificado em [^:]+: (\d+)\/(\d+)/.exec(text);
  const backlog = /## 3\. Backlog \((\d+)\/(\d+)\)/.exec(text);
  if (!snapshot) problems.push("Snapshot nao encontrado.");
  if (!backlog) problems.push("Cabecalho do backlog nao encontrado.");
  if (snapshot && backlog && (snapshot[1] !== backlog[1] || snapshot[2] !== backlog[2])) {
    problems.push(`Snapshot (${snapshot[1]}/${snapshot[2]}) difere do backlog (${backlog[1]}/${backlog[2]}).`);
  }
  if (snapshot && (Number(snapshot[1]) !== totalDone || Number(snapshot[2]) !== totalAll)) {
    problems.push(`Snapshot (${snapshot[1]}/${snapshot[2]}) difere da soma da tabela (${totalDone}/${totalAll}).`);
  }
  for (const match of text.matchAll(/(\d+)\/(\d+) global/g)) {
    if (Number(match[1]) !== totalDone || Number(match[2]) !== totalAll) {
      problems.push(`Mencao "${match[0]}" difere da soma da tabela (${totalDone}/${totalAll}).`);
    }
  }

  for (const link of brokenLinks(text)) problems.push(`Link quebrado: ${link}.`);

  const progressText = read(PROGRESS);
  const progressTotal = /\*\*Total: (\d+)\/(\d+)\*\*/.exec(progressText);
  if (progressTotal && (Number(progressTotal[1]) !== totalDone || Number(progressTotal[2]) !== totalAll)) {
    problems.push(`progress.md diz ${progressTotal[0]}, indice soma ${totalDone}/${totalAll}.`);
  }
  const progressRow = /^\| EP-09 \| (\d+)\/(\d+) \|/m.exec(progressText);
  const indexRow = rows.get("EP-09");
  if (progressRow && indexRow && progressRow[1] !== String(indexRow.done)) {
    problems.push(`EP-09: indice ${indexRow.done}/5 e progress.md ${progressRow[1]}/5 divergem.`);
  }

  console.log(`Indice: ${totalDone}/${totalAll} entregas aceitas em ${rows.size} epicos.`);
  if (problems.length) {
    console.error(`\n${problems.length} divergencia(s):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log("Links, contagens por epico e totais conferem.");
}

module.exports = { countCheckboxes, tableRows, sections, brokenLinks };

if (require.main === module) main();
