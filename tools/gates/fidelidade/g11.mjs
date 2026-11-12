// fidelidade/g11: review by hash. The pairing file stores the hash of every code file it relies on; when a file
// changes after the last review, the map items that cite it need another look. Comparison is by content with
// CRLF normalized (hash.mjs), so Git line-ending conversion never triggers it.
import { existsSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { hashArquivo } from '../hash.mjs';

const posix = (p) => p.split(sep).join('/');

// Files a screen relies on: templates plus the .ts and .css that sit next to them, plus declared styles.
export function arquivosDaTela(root, tela) {
  const lista = [];
  const add = (f) => { const abs = resolve(root, f); if (existsSync(abs) && !lista.includes(abs)) lista.push(abs); };
  for (const t of tela.codigo?.templates || []) {
    add(t);
    add(t.replace(/\.html$/, '.ts'));
    add(t.replace(/\.html$/, '.css'));
  }
  for (const e of tela.codigo?.estilos || []) add(e);
  return lista;
}

// Returns [{ m }] for files with no recorded review or whose hash changed.
export function conferePorHash(root, telas, revisao = {}) {
  const out = [];
  for (const tela of telas) {
    for (const abs of arquivosDaTela(root, tela)) {
      const rel = posix(relative(root, abs));
      const guardado = revisao[rel];
      if (!guardado) out.push({ m: `${rel}: sem revisão registrada` });
      else if (guardado.sha !== hashArquivo(abs)) out.push({ m: `${rel}: mudou desde a revisão de ${guardado.revisado_em || 'data desconhecida'}; revise os itens do mapa que o citam` });
    }
  }
  return out;
}

// Current hashes for every file of every screen, ready to store as `revisao`.
export function registraRevisao(root, telas, data) {
  const out = {};
  for (const tela of telas) {
    for (const abs of arquivosDaTela(root, tela)) out[posix(relative(root, abs))] = { sha: hashArquivo(abs), revisado_em: data };
  }
  return out;
}
