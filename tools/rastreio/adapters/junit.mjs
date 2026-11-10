// rastreio/adapters/junit: Java test index and the "Class#method" / "method_*" reference check.
// Entry fields: `junit` and `it`. Config: { tipo: "junit", raizMain, raizTest, modulo?, prefixo?, fontes? }.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { lerTexto } from '../util.mjs';

export const campos = ['junit', 'it'];
export const obrigatorios = ['raizMain', 'raizTest'];
const slash = (p) => p.replace(/\\/g, '/');

// `modulo` (optional) is the module root; globs in _status.md are relative to it (default: the project root).
export function normaliza(s, root) {
  const abs = (p) => resolve(root, p);
  const base = abs(s.modulo || '.');
  const relTest = slash(relative(base, abs(s.raizTest))) + '/';
  const relMain = slash(relative(base, abs(s.raizMain))) + '/';
  return { tipo: 'junit', prefixo: s.prefixo || null, raizCodigo: abs(s.raizMain), raizTest: abs(s.raizTest), relTest, raizes: [relMain, relTest], fontes: s.fontes || 'fontes_api' };
}

export function indexa(s) {
  const metodos = new Map();     // name -> Set(classes)
  const testes = [];             // { arquivo (relative to the module), classe, nome }
  (function varre(d) {
    if (!existsSync(d)) return;
    for (const n of readdirSync(d)) {
      const f = join(d, n);
      if (statSync(f).isDirectory()) { varre(f); continue; }
      if (!n.endsWith('.java')) continue;
      const cls = n.replace('.java', ''), txt = lerTexto(f);
      const rel = s.relTest + slash(f.slice(s.raizTest.length + 1));
      for (const m of txt.matchAll(/void\s+([A-Za-z0-9_]+)\s*\(/g)) { if (!metodos.has(m[1])) metodos.set(m[1], new Set()); metodos.get(m[1]).add(cls); }
      for (const m of txt.matchAll(/@(?:Test|ParameterizedTest)\b[\s\S]*?void\s+([A-Za-z0-9_]+)\s*\(/g)) testes.push({ arquivo: rel, classe: cls, nome: m[1] });
    }
  })(s.raizTest);
  return { metodos, testes };
}

// Returns null when the test exists, otherwise the reason.
export function existe(idx, t) {
  const { metodos } = idx;
  const [cls, nome] = t.includes('#') ? t.split('#') : [null, t];
  const pref = nome.endsWith('_*'), base = pref ? nome.slice(0, -2) : nome;
  const achados = pref ? [...metodos.keys()].filter((k) => k.startsWith(base)) : (metodos.has(base) ? [base] : []);
  if (!achados.length) return 'inexistente';
  if (cls && !achados.some((a) => metodos.get(a).has(cls))) return `existe, mas não na classe ${cls} (está em ${[...metodos.get(achados[0])].join(', ')})`;
  return null;
}

export const formata = (id, ref, motivo) => `${id}: teste ${motivo}: ${ref}`;
