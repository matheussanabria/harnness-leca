#!/usr/bin/env node
// rastreio/cli: traceability gate. Contract: <project>/doc/sistema/features/_contrato-rastreio.md
//
// Checks each feature's rastreio.yml against code, tests, Postman collections and regras.md. Read-only; never runs
// git. Exits 1 on any error (warnings do not block).
//
// Usage:
//   node tools/rastreio/cli.mjs --root <project dir>                 every feature that has a rastreio.yml
//   node tools/rastreio/cli.mjs --root <dir> --features a,b          only these
//   node tools/rastreio/cli.mjs --root <dir> --features a --arquivo x.yml   use another YAML (testing)
//   node tools/rastreio/cli.mjs --root <dir> --json
//
// Gates: G1 entry without proof, G2 rule without code/proof, G3 broken link, G4 code/test/request missing,
// G5 placeholder id in the header, G6 module test without link (warning), G7 reused id, G8 stale count in
// _status.md (warning), G9 mapa-camadas.json <-> rastreio. To retire an id list it in `descontinuados:`.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { dispensacaoConfig } from './config.mjs';
import { criaContexto } from './carrega.mjs';
import { verifica } from './verifica.mjs';

export function roda(argv, cwd = process.cwd()) {
  const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  const flag = (n) => argv.includes(n);
  const cfg = dispensacaoConfig(resolve(cwd, opt('--root') || '.'));
  const ctx = criaContexto(cfg);
  const { features } = cfg.docs;
  const { rastreio } = cfg.arquivos;

  const pedidas = opt('--features') ? opt('--features').split(',').map((s) => s.trim()).filter(Boolean) : null;
  const slugs = pedidas || readdirSync(features).filter((n) => statSync(join(features, n)).isDirectory() && existsSync(join(features, n, rastreio))).sort();
  const resultados = [];
  for (const slug of slugs) {
    const yml = opt('--arquivo') || join(features, slug, rastreio);
    if (!existsSync(yml)) { if (pedidas && !flag('--json')) console.log(`[rastreio] ${slug}: sem ${rastreio} (funcionalidade ainda fora do piloto; ignorada)`); continue; }
    resultados.push(verifica(ctx, slug, yml));
  }

  if (flag('--json')) { console.log(JSON.stringify(resultados, null, 1)); return resultados.some((r) => r.erros.length) ? 1 : 0; }

  let falhou = false;
  for (const r of resultados) {
    const s = r.resumo ? `${r.resumo.entradas} entradas, ${r.resumo.regras} regras, ${r.resumo.semProva} sem prova declarada, ${r.resumo.testesSemElo} teste(s) sem elo` : '';
    console.log(`[rastreio] ${r.erros.length ? '✗' : '✓'} ${r.slug}${s ? ' — ' + s : ''}`);
    for (const e of r.erros) console.log(`    ERRO  ${e.g}  ${e.m}`);
    for (const a of r.avisos) console.log(`    aviso ${a.g}  ${a.m}`);
    if (r.erros.length) falhou = true;
  }
  if (!resultados.length) console.log(`[rastreio] nenhuma funcionalidade com ${rastreio} para conferir.`);
  return falhou ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(roda(process.argv.slice(2)));
