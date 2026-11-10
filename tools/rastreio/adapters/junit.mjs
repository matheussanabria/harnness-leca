// rastreio/adapters/junit: index of Java test methods and the "Class#method" / "method_*" reference check.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { lerTexto } from '../util.mjs';

export function indexaJunit(cfg) {
  const { test: dir, relTest } = cfg.stacks.junit;
  const metodos = new Map();     // name -> Set(classes)
  const testesPorArquivo = [];   // { arquivo (relative to the api root), classe, nome }
  (function varre(d) {
    if (!existsSync(d)) return;
    for (const n of readdirSync(d)) {
      const f = join(d, n);
      if (statSync(f).isDirectory()) { varre(f); continue; }
      if (!n.endsWith('.java')) continue;
      const cls = n.replace('.java', ''), txt = lerTexto(f);
      const rel = relTest + f.slice(dir.length + 1).replace(/\\/g, '/');
      for (const m of txt.matchAll(/void\s+([A-Za-z0-9_]+)\s*\(/g)) { if (!metodos.has(m[1])) metodos.set(m[1], new Set()); metodos.get(m[1]).add(cls); }
      for (const m of txt.matchAll(/@(?:Test|ParameterizedTest)\b[\s\S]*?void\s+([A-Za-z0-9_]+)\s*\(/g)) testesPorArquivo.push({ arquivo: rel, classe: cls, nome: m[1] });
    }
  })(dir);
  return { metodos, testesPorArquivo };
}

// Returns null when the test exists, otherwise the reason.
export function existeTeste(junit, t) {
  const { metodos } = junit;
  const [cls, nome] = t.includes('#') ? t.split('#') : [null, t];
  const pref = nome.endsWith('_*'), base = pref ? nome.slice(0, -2) : nome;
  const achados = pref ? [...metodos.keys()].filter((k) => k.startsWith(base)) : (metodos.has(base) ? [base] : []);
  if (!achados.length) return 'inexistente';
  if (cls && !achados.some((a) => metodos.get(a).has(cls))) return `existe, mas não na classe ${cls} (está em ${[...metodos.get(achados[0])].join(', ')})`;
  return null;
}
