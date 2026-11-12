// gates/integridade: checks a packed harness-gates directory against its lock. Part of the packed copy itself,
// so the team can verify it without the Harness. Reports edited, missing and extra files by name.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCK, hashDir } from './hash.mjs';

export function leLock(dir) {
  const f = join(dir, LOCK);
  if (!existsSync(f)) return null;
  try { return JSON.parse(readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch { return null; }
}

// Returns { ok, versao, problemas: [{ arquivo, tipo }] } with tipo in alterado | ausente | extra | sem-lock.
export function verificaIntegridade(dir) {
  const lock = leLock(dir);
  if (!lock || typeof lock.arquivos !== 'object') return { ok: false, versao: null, problemas: [{ arquivo: LOCK, tipo: 'sem-lock' }] };
  const atual = hashDir(dir);
  const problemas = [];
  for (const [arq, h] of Object.entries(lock.arquivos)) {
    if (!(arq in atual)) problemas.push({ arquivo: arq, tipo: 'ausente' });
    else if (atual[arq] !== h) problemas.push({ arquivo: arq, tipo: 'alterado' });
  }
  for (const arq of Object.keys(atual)) if (!(arq in lock.arquivos)) problemas.push({ arquivo: arq, tipo: 'extra' });
  return { ok: problemas.length === 0, versao: lock.versao || null, problemas };
}
