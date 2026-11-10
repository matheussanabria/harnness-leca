// rastreio/adapters/pytest: Python test index and the "file.py#test_name" / "test_name_*" reference check.
// Entry field: `pytest`. Config: { tipo: "pytest", raizMain, raizTest, modulo?, prefixo?, fontes? }.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { lerTexto } from '../util.mjs';

export const campos = ['pytest'];
export const obrigatorios = ['raizMain', 'raizTest'];
const slash = (p) => p.replace(/\\/g, '/');

export function normaliza(s, root) {
  const abs = (p) => resolve(root, p);
  const base = abs(s.modulo || '.');
  const relTest = slash(relative(base, abs(s.raizTest))) + '/';
  const relMain = slash(relative(base, abs(s.raizMain))) + '/';
  return { tipo: 'pytest', prefixo: s.prefixo || null, raizCodigo: abs(s.raizMain), raizTest: abs(s.raizTest), relTest, raizes: [relMain, relTest], fontes: s.fontes || 'fontes_api' };
}

export function indexa(s) {
  const porArquivo = new Map();  // path relative to raizTest -> Set(test names)
  const testes = [];             // { arquivo (relative to the module), classe (file), nome }
  (function varre(d) {
    if (!existsSync(d)) return;
    for (const n of readdirSync(d)) {
      const f = join(d, n);
      if (statSync(f).isDirectory()) { if (n !== '__pycache__') varre(f); continue; }
      if (!/^(test_.*|.*_test)\.py$/.test(n)) continue;
      const rel = slash(f.slice(s.raizTest.length + 1));
      const nomes = new Set();
      for (const m of lerTexto(f).matchAll(/^\s*(?:async\s+)?def\s+(test_\w+)\s*\(/gm)) { nomes.add(m[1]); testes.push({ arquivo: s.relTest + rel, classe: n, nome: m[1] }); }
      porArquivo.set(rel, nomes);
    }
  })(s.raizTest);
  return { porArquivo, testes };
}

// "file.py#test_name", "test_name" (any file) or a `_*` suffix as prefix match. Returns null when valid, otherwise the reason.
export function existe({ porArquivo }, ref) {
  const [arq, nome] = ref.includes('#') ? [ref.slice(0, ref.indexOf('#')).trim(), ref.slice(ref.indexOf('#') + 1).trim()] : [null, ref.trim()];
  const arquivos = arq ? [...porArquivo.keys()].filter((k) => k === arq || k.endsWith('/' + arq)) : [...porArquivo.keys()];
  if (arq && !arquivos.length) return `arquivo de teste inexistente: ${arq}`;
  if (arq && arquivos.length > 1) return `arquivo ambíguo (${arquivos.length} terminam em ${arq})`;
  const pref = nome.endsWith('_*'), base = pref ? nome.slice(0, -2) : nome;
  const ok = arquivos.some((k) => [...porArquivo.get(k)].some((t) => (pref ? t.startsWith(base) : t === base)));
  return ok ? null : 'inexistente';
}

export const formata = (id, ref, motivo) => `${id}: pytest ${motivo}: ${ref}`;
