#!/usr/bin/env node
// gates/prototipo: copies a Harness prototype into a project repository so the team can run G10 without the
// Harness (ADR-016). Only proto.json and the screen HTML are copied (no assets), with a SNAPSHOT.json of hashes.
//
//   node tools/gates/prototipo.mjs snapshot --repo <dir> --id <proto id> --from <proto dir>
//        [--dest design/prototipos] [--config-from <harness config with a fidelidade block>]
//   node tools/gates/prototipo.mjs check    --repo <dir> --id <proto id> --from <proto dir> [--dest design/prototipos]
//
// `snapshot` also registers fidelidade.prototipos.<id> (relative path) in <repo>/harness-gates.json; with
// `--config-from` it creates the fidelidade block from that config when the repo has none.
// `check` says whether the Harness prototype changed after the snapshot (exit 1) and whether the copy was edited.
// Exit: 0 ok, 1 stale or edited (check), 2 bad usage.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashArquivo } from './hash.mjs';

const MARCA = 'SNAPSHOT.json';
const json = (f) => JSON.parse(readFileSync(f, 'utf8').replace(/^﻿/, ''));

// proto.json plus the HTML of every screen it lists, as relative posix paths.
export function arquivosDoPrototipo(dir) {
  const telas = (json(join(dir, 'proto.json')).screens || []).map((s) => s.file).filter(Boolean);
  return ['proto.json', ...telas];
}

const hashes = (dir, rels) => Object.fromEntries(rels.map((r) => [r, existsSync(join(dir, r)) ? hashArquivo(join(dir, r)) : null]));

export function snapshot({ repo, id, origem, dest = 'design/prototipos', configDe = null, agora = new Date() }) {
  const rels = arquivosDoPrototipo(origem);
  const alvo = join(repo, dest, id);
  for (const r of rels) {
    mkdirSync(dirname(join(alvo, r)), { recursive: true });
    copyFileSync(join(origem, r), join(alvo, r));
  }
  const versao = json(join(origem, 'proto.json')).version ?? null;
  writeFileSync(join(alvo, MARCA), JSON.stringify({ id, origem_versao: versao, gerado_em: agora.toISOString().slice(0, 10), arquivos: hashes(alvo, rels) }, null, 2) + '\n');

  const arqCfg = join(repo, 'harness-gates.json');
  const cfg = existsSync(arqCfg) ? json(arqCfg) : {};
  if (!cfg.fidelidade && configDe) cfg.fidelidade = { ...json(configDe).fidelidade, prototipos: {} };
  if (!cfg.fidelidade) return { codigo: 2, msg: 'o repositório não tem bloco "fidelidade" em harness-gates.json; informe --config-from <config do Harness>' };
  cfg.fidelidade.prototipos = { ...(cfg.fidelidade.prototipos || {}), [id]: `${dest}/${id}` };
  writeFileSync(arqCfg, JSON.stringify(cfg, null, 2) + '\n');
  return { codigo: 0, msg: `${rels.length} arquivos de "${id}" copiados para ${dest}/${id} (versão ${versao}); config atualizada` };
}

export function confere({ repo, id, origem, dest = 'design/prototipos' }) {
  const alvo = join(repo, dest, id);
  if (!existsSync(join(alvo, MARCA))) return { codigo: 1, msg: `sem snapshot de "${id}" em ${dest}/${id}; rode snapshot` };
  const marca = json(join(alvo, MARCA));
  const problemas = [];
  const copia = hashes(alvo, Object.keys(marca.arquivos));
  for (const [r, h] of Object.entries(marca.arquivos)) if (copia[r] !== h) problemas.push(`copia editada ou ausente: ${r}`);
  const atuais = arquivosDoPrototipo(origem);
  const origemHash = hashes(origem, atuais);
  for (const r of atuais) if (origemHash[r] !== marca.arquivos[r]) problemas.push(`o protótipo mudou desde o snapshot de ${marca.gerado_em}: ${r}`);
  return problemas.length
    ? { codigo: 1, msg: `snapshot de "${id}" desatualizado:\n    ${problemas.join('\n    ')}` }
    : { codigo: 0, msg: `snapshot de "${id}" em dia (versão ${marca.origem_versao}, ${marca.gerado_em})` };
}

export function roda(argv) {
  const cmd = argv[0];
  const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  if (!['snapshot', 'check'].includes(cmd) || !opt('--repo') || !opt('--id') || !opt('--from')) {
    console.error('uso: node tools/gates/prototipo.mjs <snapshot|check> --repo <dir> --id <id> --from <pasta do protótipo> [--dest <pasta>] [--config-from <arquivo>]');
    return 2;
  }
  const repo = resolve(opt('--repo'));
  const origem = resolve(opt('--from'));
  if (!existsSync(repo) || !existsSync(join(origem, 'proto.json'))) { console.error('[gates] repositório ou pasta do protótipo (com proto.json) inexistente'); return 2; }
  const base = { repo, id: opt('--id'), origem, dest: opt('--dest') || undefined };
  const r = cmd === 'check' ? confere(base) : snapshot({ ...base, configDe: opt('--config-from') ? resolve(opt('--config-from')) : null });
  (r.codigo ? console.error : console.log)(`[gates] ${r.msg}`);
  return r.codigo;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(roda(process.argv.slice(2)));
