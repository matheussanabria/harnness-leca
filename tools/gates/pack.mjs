#!/usr/bin/env node
// gates/pack: ships the Harness gate engine into a project repository as a lock-pinned copy (ADR-016).
//
//   node tools/gates/pack.mjs pack  --repo <dir> [--config <file>]   first install into <repo>/tools/harness-gates
//   node tools/gates/pack.mjs sync  --repo <dir> [--config <file>]   replace the copy with the current engine
//   node tools/gates/pack.mjs check --repo <dir>                     is the copy intact and up to date?
//
// The packed copy runs with `node tools/harness-gates/cli.mjs` and needs no Harness. `--config` copies a
// config file to <repo>/harness-gates.json only when that file does not exist yet (never overwrites).
// Exit: 0 ok, 1 behind or edited (check) / refused (pack, sync), 2 bad usage.
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCK, hashDir, versaoDe } from './hash.mjs';
import { leLock, verificaIntegridade } from './integridade.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(aqui, '..', 'rastreio');
export const DESTINO = ['tools', 'harness-gates'];

// Builds the package in `dir`: engine, integrity helpers, entry point, VERSION and lock. Returns { versao, arquivos }.
export function montaPacote(dir, agora = new Date()) {
  mkdirSync(dir, { recursive: true });
  cpSync(ENGINE, join(dir, 'engine', 'rastreio'), { recursive: true });
  copyFileSync(join(aqui, 'hash.mjs'), join(dir, 'hash.mjs'));
  copyFileSync(join(aqui, 'integridade.mjs'), join(dir, 'integridade.mjs'));
  copyFileSync(join(aqui, 'packed-cli.mjs'), join(dir, 'cli.mjs'));
  const versao = versaoDe(hashDir(dir));
  writeFileSync(join(dir, 'VERSION'), `${versao}\n`);
  const arquivos = hashDir(dir);
  writeFileSync(join(dir, LOCK), JSON.stringify({ schema: 1, versao, gerado_em: agora.toISOString(), arquivos }, null, 2) + '\n');
  return { versao, arquivos };
}

// Version the current Harness would ship, without touching any repository.
export function versaoAtual() {
  const tmp = mkdtempSync(join(tmpdir(), 'harness-gates-'));
  try { return montaPacote(join(tmp, 'p')).versao; } finally { rmSync(tmp, { recursive: true, force: true }); }
}

function instala(repo, cmd, configOrigem) {
  const dest = join(repo, ...DESTINO);
  const existe = existsSync(dest);
  if (cmd === 'pack' && existe) return { codigo: 1, msg: `${dest} já existe; use "sync" para atualizar.` };
  if (existe && !leLock(dest)) return { codigo: 1, msg: `${dest} existe mas não tem ${LOCK} (não foi gerada pelo pack); nada foi alterado.` };
  const tmp = mkdtempSync(join(tmpdir(), 'harness-gates-'));
  try {
    const { versao } = montaPacote(join(tmp, 'p'));
    if (existe) rmSync(dest, { recursive: true, force: true });
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(tmp, 'p'), dest, { recursive: true });
    let nota = '';
    const cfgDest = join(repo, 'harness-gates.json');
    if (configOrigem && !existsSync(cfgDest)) { copyFileSync(configOrigem, cfgDest); nota = `; config copiada para ${cfgDest}`; }
    return { codigo: 0, msg: `${cmd === 'pack' ? 'instalado' : 'atualizado'} ${versao} em ${dest}${nota}` };
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

function confere(repo) {
  const dest = join(repo, ...DESTINO);
  if (!existsSync(dest)) return { codigo: 1, msg: `${dest} não existe (rode "pack").` };
  const integ = verificaIntegridade(dest);
  const linhas = integ.problemas.map((p) => `    ${p.tipo.padEnd(9)} ${p.arquivo}`);
  if (!integ.ok) return { codigo: 1, msg: ['cópia editada ou incompleta:', ...linhas].join('\n') };
  const atual = versaoAtual();
  if (atual !== integ.versao) return { codigo: 1, msg: `cópia atrasada: ${integ.versao}, o Harness tem ${atual} (rode "sync").` };
  return { codigo: 0, msg: `em dia: ${integ.versao}` };
}

export function roda(argv) {
  const cmd = argv[0];
  const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  if (!['pack', 'sync', 'check'].includes(cmd) || !opt('--repo')) {
    console.error('uso: node tools/gates/pack.mjs <pack|sync|check> --repo <dir> [--config <arquivo>]');
    return 2;
  }
  const repo = resolve(opt('--repo'));
  if (!existsSync(repo)) { console.error(`[gates] repositório inexistente: ${repo}`); return 2; }
  const cfg = opt('--config') ? resolve(opt('--config')) : null;
  if (cfg && !existsSync(cfg)) { console.error(`[gates] config inexistente: ${cfg}`); return 2; }
  const r = cmd === 'check' ? confere(repo) : instala(repo, cmd, cfg);
  (r.codigo ? console.error : console.log)(`[gates] ${r.msg}`);
  return r.codigo;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(roda(process.argv.slice(2)));
