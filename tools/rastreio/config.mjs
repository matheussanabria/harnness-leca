// rastreio/config: loads and validates a project's rastreio.config.json (decision D1: projects/<slug>/rastreio.config.json).
// Paths in the file are relative to the project root (`--root`, or the optional "root" field resolved against the config file).
// Fails early with one message per problem; gates only ever see the normalized object returned here.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ADAPTERS } from './adapters/index.mjs';
import { BOM } from './util.mjs';

const ARQUIVOS = { rastreio: 'rastreio.yml', regras: 'regras.md', mapa: 'mapa-camadas.json', status: '_status.md' };

function regexOk(src) { try { new RegExp(src); return true; } catch { return false; } }

// Returns { cfg } or { erros: [string] }.
export function carregaConfig(arquivo, rootCli) {
  const erros = [];
  const E = (m) => erros.push(m);
  if (!arquivo) return { erros: ['informe --config <rastreio.config.json>'] };
  if (!existsSync(arquivo)) return { erros: [`config inexistente: ${arquivo}`] };
  let j;
  try { j = JSON.parse(readFileSync(arquivo, 'utf8').replace(BOM, '')); } catch (e) { return { erros: [`config inválido (JSON): ${e.message}`] }; }

  const root = rootCli ? resolve(rootCli) : resolve(dirname(arquivo), j.root || '.');
  const abs = (p) => resolve(root, p);
  const caminho = (campo, valor, obrigatorio) => {
    if (valor === undefined || valor === null) { if (obrigatorio) E(`campo ausente: ${campo}`); return null; }
    if (typeof valor !== 'string') { E(`${campo}: deve ser texto`); return null; }
    if (!existsSync(abs(valor))) E(`${campo}: caminho inexistente: ${valor} (raiz ${root})`);
    return abs(valor);
  };

  const features = caminho('docs.features', j.docs?.features, true);
  const postman = j.docs?.postman ? caminho('docs.postman', j.docs.postman, false) : null;
  const ids = { regra: j.ids?.regra || 'RN', placeholder: j.ids?.placeholder || null, postmanPrefixo: j.ids?.postmanPrefixo || null };
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(ids.regra)) E(`ids.regra: use letras e números (recebido "${ids.regra}")`);
  if (ids.postmanPrefixo && !regexOk(ids.postmanPrefixo)) E(`ids.postmanPrefixo: expressão regular inválida: ${ids.postmanPrefixo}`);
  const linhaStatus = j.textos?.linhaStatus || 'Rastreabilidade (piloto)';
  const arquivos = { ...ARQUIVOS, ...(j.arquivos || {}) };

  const stacks = [];
  if (!Array.isArray(j.stacks) || !j.stacks.length) E('stacks: informe ao menos uma stack (tipos: ' + Object.keys(ADAPTERS).join(', ') + ')');
  else j.stacks.forEach((s, i) => {
    const onde = `stacks[${i}]`;
    const ad = ADAPTERS[s?.tipo];
    if (!ad) { E(`${onde}: tipo "${s?.tipo}" desconhecido (use: ${Object.keys(ADAPTERS).join(', ')})`); return; }
    let ok = true;
    for (const c of ad.obrigatorios) { if (!s[c]) { E(`${onde} (${s.tipo}): campo ausente: ${c}`); ok = false; } else caminho(`${onde}.${c}`, s[c], true); }
    if (s.modulo) caminho(`${onde}.modulo`, s.modulo, false);
    if (ok) stacks.push(ad.normaliza(s, root));
  });
  if (stacks.filter((s) => !s.prefixo).length > 1) E('stacks: só uma stack pode ficar sem "prefixo" (ela recebe as referências de código sem prefixo)');
  const prefs = stacks.map((s) => s.prefixo).filter(Boolean);
  if (new Set(prefs).size !== prefs.length) E('stacks: "prefixo" repetido');

  if (erros.length) return { erros: erros.map((m) => `${arquivo}: ${m}`) };
  return { cfg: { root, docs: { features, postman }, ids, textos: { linhaStatus }, arquivos, stacks } };
}
