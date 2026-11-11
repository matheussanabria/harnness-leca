// rastreio/util: helpers shared by loaders and gates (status header parser, glob matching, file reads).
import { existsSync, readFileSync } from 'node:fs';

export const BOM = /^﻿/;
export const lerTexto = (f) => readFileSync(f, 'utf8');
export const lerSeExiste = (f) => (existsSync(f) ? lerTexto(f) : null);

// Minimal YAML header of _status.md: keys, scalars and "- item" lists.
export function cabecalho(texto) {
  const m = texto.replace(BOM, '').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {};
  let chave = null;
  for (const l of m[1].split(/\r?\n/)) {
    const li = l.match(/^\s+-\s+(.*)$/);
    if (li && chave) { (out[chave] ||= []).push(li[1].trim().replace(/^["']|["']$/g, '')); continue; }
    const kv = l.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    chave = kv[1];
    const v = kv[2].trim();
    if (v === '') out[chave] = [];
    else if (v.startsWith('[') && v.endsWith(']')) out[chave] = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    else out[chave] = v.replace(/\s+#.*$/, '').replace(/^["']|["']$/g, '');
  }
  return out;
}

export function globParaRegex(g) {
  let r = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') { if (g[i + 2] === '/') { r += '(?:.*/)?'; i += 2; } else { r += '.*'; i += 1; } }
      else r += '[^/]*';
    } else if (c === '?') r += '[^/]';
    else r += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + r + '$');
}

// `file` is relative to the repo root; the glob is tested with and without the code roots stripped.
export function casa(globs, raizes, file) {
  const candidatos = [file, ...raizes.filter((x) => file.startsWith(x)).map((x) => file.slice(x.length))];
  const pos = globs.filter((g) => !g.startsWith('!')), neg = globs.filter((g) => g.startsWith('!')).map((g) => g.slice(1));
  const bate = (g) => { const re = globParaRegex(g); return candidatos.some((c) => re.test(c)); };
  return pos.some(bate) && !neg.some(bate);
}
