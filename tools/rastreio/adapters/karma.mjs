// rastreio/adapters/karma: *.spec.ts index and the "file.spec.ts#title" / "#describe:Name" reference check.
// Entry field: `karma`. Config: { tipo: "karma", raiz, prefixo? }. Also fits Jest/Vitest when `sufixo` is set (e.g. ".test.ts").
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { lerTexto } from '../util.mjs';

export const campos = ['karma'];
export const obrigatorios = ['raiz'];

export function normaliza(s, root) {
  return { tipo: 'karma', prefixo: s.prefixo || null, raizCodigo: resolve(root, s.raiz), raiz: resolve(root, s.raiz), sufixo: s.sufixo || '.spec.ts' };
}

// path relative to the app root -> file content
export function indexa(s) {
  const specs = new Map();
  (function varre(dir, rel) {
    for (const n of existsSync(dir) ? readdirSync(dir) : []) {
      if (n === 'node_modules') continue;
      const f = join(dir, n), r = rel ? rel + '/' + n : n;
      if (statSync(f).isDirectory()) varre(f, r);
      else if (n.endsWith(s.sufixo)) specs.set(r, lerTexto(f));
    }
  })(s.raiz, '');
  return { specs };
}

// "file.spec.ts#title": the file is found by the end of its path; the title must appear in the spec.
// Returns null when valid, otherwise the reason.
export function existe({ specs }, ref) {
  const i = ref.indexOf('#');
  if (i < 0) return 'formato inválido (use "arquivo.spec.ts#título")';
  const arq = ref.slice(0, i).trim(), titulo = ref.slice(i + 1).trim();
  const achados = [...specs.keys()].filter((k) => k === arq || k.endsWith('/' + arq));
  if (!achados.length) return `spec inexistente: ${arq}`;
  if (achados.length > 1) return `spec ambíguo (${achados.length} arquivos terminam em ${arq}); use mais do caminho`;
  const txt = specs.get(achados[0]);
  // "describe:Block name" links the whole block; the name must exist as describe('...')
  if (titulo.startsWith('describe:')) {
    const nome = titulo.slice(9).trim();
    const ok = /describe\(\s*(['"`])/.test(txt) && txt.includes(nome)
      && new RegExp('describe\\(\\s*[\'"`]' + nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\'"`]').test(txt);
    return ok ? null : `describe não encontrado em ${arq}: ${nome}`;
  }
  return txt.includes(titulo) ? null : `título não encontrado em ${arq}`;
}

export const formata = (id, ref, motivo) => `${id}: karma: ${motivo}`;
