'use strict';
// audit-layers-rastreio: counts the parts of mapa-camadas.json that audit-layers-drift used to leave at zero
// (test groups by status, rules without `rn`) and reports G9 by running the rastreio gate (tools/rastreio).
const path = require('path');
const { spawnSync } = require('child_process');

// Test-group status that count as proof (the rest is a gap: so-bdd, so-requisicao, sem-teste...).
const COM_PROVA = ['teste-unitario', 'automatizado'];
const CLI = path.join(__dirname, '..', 'rastreio', 'cli.mjs');

function contaTestes(mapa) {
  const out = { total: 0, comProva: 0, semProva: 0, porSt: {} };
  for (const t of (mapa && mapa.telas) || []) {
    for (const g of (t.testes && t.testes.grupos) || []) {
      const st = g.st || 'a-confirmar';
      out.total++;
      out.porSt[st] = (out.porSt[st] || 0) + 1;
      if (COM_PROVA.includes(st)) out.comProva++; else out.semProva++;
    }
  }
  return out;
}

// Rules in force (implementado/diverge) that cite no `rn` and do not declare `sem_rn`: the map is not linked to the rastreio there.
function contaRegrasSemRn(mapa) {
  let semRn = 0, total = 0;
  for (const t of (mapa && mapa.telas) || []) {
    for (const r of t.regras || []) {
      total++;
      if (!(r.rn || []).length && ['implementado', 'diverge'].includes(r.st) && !r.sem_rn) semRn++;
    }
  }
  return { total, semRn };
}

// Runs the gate once and returns { slug: [G9 messages] }, or { erro } when the gate cannot run (invalid config).
function g9PorFeature(configFile, root) {
  const args = [CLI, '--config', configFile, '--json'];
  if (root) args.push('--root', root);
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.status === 2 || r.error) return { erro: (r.stderr || String(r.error)).trim() };
  let lista;
  try { lista = JSON.parse(r.stdout); } catch (e) { return { erro: `saída do gate não é JSON: ${e.message}` }; }
  const por = {};
  for (const f of lista) {
    por[f.slug] = [...f.erros.map((x) => ({ nivel: 'erro', ...x })), ...f.avisos.map((x) => ({ nivel: 'aviso', ...x }))]
      .filter((x) => x.g === 'G9');
  }
  return { por };
}

module.exports = { contaTestes, contaRegrasSemRn, g9PorFeature, COM_PROVA };
