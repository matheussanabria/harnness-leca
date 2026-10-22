// @ts-check
// Relatório de tamanho (--report) e remoção explícita de arquivos antigos (--prune).

const fs = require("fs");
const { isInside } = require("./managed-file");

const tokens = (bytes) => Math.ceil(bytes / 4);

/** @param {string} file */
function sizeOf(file) {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
}

/**
 * Bytes que o destino carrega hoje (arquivos planejados + legados) e o que passaria a carregar.
 * @param {string} slug
 * @param {Array<{dest:string,file:string,bytes:number}>} results
 * @param {Array<{dest:string,file:string}>} legacy
 */
function reportRows(slug, results, legacy) {
  /** @type {Map<string,{before:number,after:number}>} */
  const by = new Map();
  const row = (d) => by.get(d) || by.set(d, { before: 0, after: 0 }).get(d);
  for (const r of results) {
    row(r.dest).after += r.bytes;
    row(r.dest).before += sizeOf(r.file);
  }
  for (const l of legacy) row(l.dest).before += sizeOf(l.file);
  return [...by.entries()].map(([dest, v]) => ({ slug, dest, ...v }));
}

function printReport(rows, io) {
  io.log("\nRelatório (bytes/tokens estimados = bytes/4)");
  io.log("projeto | destino | antes | depois");
  for (const r of rows) {
    io.log(`${r.slug} | ${r.dest} | ${r.before}/${tokens(r.before)} | ${r.after}/${tokens(r.after)}`);
  }
}

/**
 * Lista os arquivos antigos existentes; só remove com `confirmed` e fora de dry-run.
 * @returns {number} quantidade removida
 */
function prune(legacy, { confirmed, dryRun }, io) {
  const found = legacy.filter((l) => fs.existsSync(l.file));
  io.log(`\n--prune: ${found.length} arquivo(s) antigo(s) encontrado(s)`);
  for (const l of found) io.log(`   ${l.file}`);
  if (!found.length) return 0;
  if (!confirmed || dryRun) {
    io.log(dryRun ? "   (dry-run: nada removido)" : "   Nada removido. Reexecute com --yes para confirmar a remoção.");
    return 0;
  }
  let removed = 0;
  for (const l of found) {
    if (!isInside(l.root, l.file)) continue;
    fs.rmSync(l.file);
    removed++;
  }
  io.log(`   Removidos: ${removed}`);
  return removed;
}

module.exports = { tokens, reportRows, printReport, prune };
