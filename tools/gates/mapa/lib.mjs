// gates/mapa/lib: núcleo do mapa de arquivos (arquivo → funcionalidade dona → responsabilidade).
// Nasceu em saude-dispensacao (tools/mapa) e foi para o Harness para sair como gate empacotado (ADR-016).
// Nada aqui conhece um projeto: aliases, repositórios, o que deve ser coberto e onde ficam as entradas vêm do bloco
// `mapa` do harness-gates.json. Diferenças em relação a tools/lib/mapa (CommonJS) do próprio Harness:
//   1. as entradas moram no dossiê de cada funcionalidade (doc/sistema/features/<slug>/arquivos.md)
//      e só o que não é funcionalidade fica em doc/mapa/<area>/<nome>.md;
//   2. a raiz não é repositório git: os arquivos vêm de cada repo (api, web), versionados ou não;
//   3. `paths` aceita aliases (api:, api-test:, web:...) para encurtar os pacotes Java.
// Regra central: cada arquivo coberto tem UM dono (um glob em `paths`). Quem só usa o arquivo cita-o na
// seção "Usa" do corpo, sem glob.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const toPosix = (p) => String(p).replace(/\\/g, '/');

/** Lê o bloco `mapa` de um harness-gates.json. Devolve { cfg } ou { erros }. */
export function carregaConfig(arquivo) {
  let j;
  try { j = JSON.parse(readFileSync(arquivo, 'utf8').replace(/^﻿/, '')); } catch (e) { return { erros: [`${arquivo}: config inválido (JSON): ${e.message}`] }; }
  const m = j.mapa;
  if (!m || typeof m !== 'object') return { erros: [`${arquivo}: falta o bloco "mapa"`] };
  const erros = [];
  for (const c of ['aliases', 'repos', 'cobertos', 'entradas', 'limiteBytes']) if (m[c] === undefined) erros.push(`${arquivo}: mapa.${c} ausente`);
  if (m.limiteBytes && !(m.limiteBytes.entrada > 0 && m.limiteBytes.mapa > 0)) erros.push(`${arquivo}: mapa.limiteBytes precisa de entrada e mapa`);
  if (erros.length) return { erros };
  return { cfg: { arquivo: 'MAPA.md', indice: 'doc/mapa/INDEX.md', comando: 'node tools/harness-gates/cli.mjs mapa', ...m } };
}

// ---------- frontmatter (subconjunto de YAML: `chave: valor` e listas inline `[a, b]`) ----------

const OBRIGATORIOS = ['resumo', 'paths', 'palavras', 'atualizado'];
const LISTAS = ['paths', 'palavras', 'historias'];
export const RESUMO_MAX = 120;

const tiraAspas = (s) => s.replace(/^(["'])(.*)\1$/, '$2');

function valor(bruto) {
  const v = bruto.trim();
  if (v.startsWith('[') && v.endsWith(']')) return v.slice(1, -1).split(',').map((x) => tiraAspas(x.trim())).filter(Boolean);
  return tiraAspas(v);
}

export function parseFrontmatter(texto) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(texto);
  if (!m) return { meta: null, corpo: texto };
  const meta = {};
  for (const linha of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(linha);
    if (kv) meta[kv[1]] = valor(kv[2]);
  }
  return { meta, corpo: texto.slice(m[0].length) };
}

export function validaFrontmatter(meta, chave) {
  const problemas = [];
  for (const k of [chave, ...OBRIGATORIOS]) {
    const v = meta[k];
    if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) problemas.push(`falta o campo "${k}"`);
  }
  for (const k of LISTAS) if (meta[k] !== undefined && !Array.isArray(meta[k])) problemas.push(`"${k}" precisa ser lista [a, b]`);
  if (typeof meta.resumo === 'string' && meta.resumo.length > RESUMO_MAX) problemas.push(`"resumo" passa de ${RESUMO_MAX} caracteres`);
  if (typeof meta.atualizado === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(meta.atualizado)) problemas.push('"atualizado" precisa ser AAAA-MM-DD');
  return problemas;
}

// ---------- glob e aliases ----------

/** `api:core/x/*.java` vira `dispensacao-novo/.../dispensacao/core/x/*.java`. Sem alias, o caminho é relativo à raiz. */
export function expandeAlias(glob, aliases) {
  const m = /^([a-z][\w-]*):(.*)$/.exec(glob);
  if (!m || !(m[1] in aliases)) return toPosix(glob);
  return `${toPosix(aliases[m[1]]).replace(/\/$/, '')}/${toPosix(m[2]).replace(/^\//, '')}`;
}

function globParaRegExp(glob) {
  let re = '';
  const g = toPosix(glob);
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*' && g[i + 1] === '*') {
      if (g[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

/** Glob sem curinga também casa tudo dentro da pasta (`web:shared` ou `web:shared/`). */
export function casaGlob(glob, arquivo) {
  const f = toPosix(arquivo);
  if (!/[*?]/.test(glob)) {
    const base = toPosix(glob).replace(/\/$/, '');
    return f === base || f.startsWith(`${base}/`);
  }
  return globParaRegExp(glob).test(f);
}

// ---------- leitura das entradas e dos arquivos ----------

/** Expande um padrão simples de `entradas` (só `*` por segmento) contra o disco. */
function expandePadrao(root, padrao) {
  let atuais = [''];
  for (const seg of padrao.split('/')) {
    const prox = [];
    for (const base of atuais) {
      const dir = join(root, base);
      if (!seg.includes('*')) { if (existsSync(join(dir, seg))) prox.push(base ? `${base}/${seg}` : seg); continue; }
      if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
      const re = globParaRegExp(seg);
      for (const nome of readdirSync(dir)) if (re.test(nome) && nome !== 'INDEX.md') prox.push(base ? `${base}/${nome}` : nome);
    }
    atuais = prox;
  }
  return atuais.sort();
}

/**
 * Entradas do mapa: { arquivo, tamanho, chave, esperado, meta, corpo, globs }.
 * `esperado` é o nome que a chave precisa ter (pasta da funcionalidade ou da área).
 */
export function lerEntradas(root, cfg) {
  return cfg.entradas.flatMap(({ padrao, chave }) => expandePadrao(root, padrao).map((arquivo) => {
    const bruto = readFileSync(join(root, arquivo));
    const { meta, corpo } = parseFrontmatter(bruto.toString('utf8'));
    const partes = arquivo.split('/');
    const esperado = partes[partes.length - 2]; // pasta da funcionalidade ou da área
    const globs = (meta && Array.isArray(meta.paths) ? meta.paths : []).map((g) => ({ original: g, expandido: expandeAlias(g, cfg.aliases) }));
    return { arquivo, tamanho: bruto.length, chave, esperado, meta, corpo, globs };
  }));
}

/** Arquivos de cada repo (versionados e novos não ignorados), relativos à raiz do projeto. */
export function listaArquivos(root, cfg) {
  return cfg.repos.flatMap((repo) => {
    const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: join(root, repo), maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
    return [...new Set(out.split('\0').filter(Boolean))].filter((f) => existsSync(join(root, repo, f))).map((f) => `${toPosix(repo)}/${toPosix(f)}`);
  }).sort();
}

export const listaCobertos = (todos, cfg) => todos.filter((f) => cfg.cobertos.some((c) => f.startsWith(c.prefixo) && new RegExp(c.ext).test(f)));

/** Caminhos citados entre crases no corpo (linhas da tabela), já com alias expandido. */
export function citadosNoCorpo(corpo, aliases) {
  return [...corpo.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((m) => ({ original: m[1], expandido: expandeAlias(m[1], aliases) }));
}

/** Como `citadosNoCorpo`, marcando se a linha está numa seção cujo título começa com "Usa". */
export function citadosPorSecao(corpo, aliases) {
  const out = [];
  let usa = false;
  for (const linha of corpo.split(/\r?\n/)) {
    const h = /^#{2,}\s+(.*)$/.exec(linha);
    if (h) { usa = /^usa\b/i.test(h[1].trim()); continue; }
    const m = /^\|\s*`([^`]+)`\s*\|/.exec(linha);
    if (m) out.push({ original: m[1], expandido: expandeAlias(m[1], aliases), usa });
  }
  return out;
}

// ---------- verificação ----------

/** Peso de um glob: [tamanho do prefixo literal, tamanho total]. Maior é mais específico. */
export function especificidade(glob) {
  const i = glob.search(/[*?]/);
  return [i < 0 ? glob.length + 1 : i, glob.length];
}
const comparaPeso = (a, b) => a[0] - b[0] || a[1] - b[1];

export function verifica(entradas, todos, cfg, { estrito = false, tamanhoMapa, root } = {}) {
  const erros = [];
  const avisos = [];
  const cobertos = listaCobertos(todos, cfg);
  const lim = cfg.limiteBytes;
  const conjunto = new Set(todos);

  if (tamanhoMapa !== undefined && tamanhoMapa > lim.mapa) erros.push(`${cfg.arquivo}: ${tamanhoMapa} bytes, acima do limite de ${lim.mapa}`);

  for (const e of entradas) {
    if (!e.meta) { erros.push(`${e.arquivo}: sem frontmatter`); continue; }
    if (e.tamanho > lim.entrada) erros.push(`${e.arquivo}: ${e.tamanho} bytes, acima do limite de ${lim.entrada}`);
    for (const p of validaFrontmatter(e.meta, e.chave)) erros.push(`${e.arquivo}: ${p}`);
    if (e.meta[e.chave] && e.meta[e.chave] !== e.esperado) erros.push(`${e.arquivo}: ${e.chave} "${e.meta[e.chave]}" difere da pasta "${e.esperado}"`);
    for (const g of e.globs) if (!todos.some((f) => casaGlob(g.expandido, f))) erros.push(`${e.arquivo}: path "${g.original}" não casa nenhum arquivo (link morto)`);
    for (const c of citadosNoCorpo(e.corpo, cfg.aliases)) {
      if (!/[*?]/.test(c.expandido) && !conjunto.has(c.expandido) && !todos.some((f) => f.startsWith(`${c.expandido.replace(/\/$/, '')}/`)) && !(root && existsSync(join(root, c.expandido)))) {
        avisos.push(`${e.arquivo}: a tabela cita \`${c.original}\`, que não existe`);
      }
    }
  }

  // Dono único, como no CODEOWNERS: o glob mais específico vence (ex.: `web:shared` na base e
  // `web:shared/components/busca-typeahead` no formulário). Empate entre entradas diferentes é ambíguo.
  const candidatos = new Map();
  for (const e of entradas) for (const g of e.globs) {
    const peso = especificidade(g.expandido);
    for (const f of todos) if (casaGlob(g.expandido, f)) (candidatos.get(f) || candidatos.set(f, []).get(f)).push({ arquivo: e.arquivo, glob: g.original, peso });
  }
  const donos = new Map();
  const globsVencedores = new Set();
  for (const [f, cs] of candidatos) {
    const melhor = cs.reduce((m, c) => (comparaPeso(c.peso, m) > 0 ? c.peso : m), cs[0].peso);
    const vencedores = cs.filter((c) => comparaPeso(c.peso, melhor) === 0);
    const entradasV = new Set(vencedores.map((c) => c.arquivo));
    donos.set(f, entradasV);
    for (const c of vencedores) globsVencedores.add(`${c.arquivo}\u0000${c.glob}`);
    if (entradasV.size > 1) erros.push(`${f}: tem mais de um dono com a mesma especificidade (${[...entradasV].join(', ')})`);
  }
  // Glob que casa arquivos mas perde todos para globs mais específicos não serve para nada.
  for (const e of entradas) for (const g of e.globs) {
    if (todos.some((f) => casaGlob(g.expandido, f)) && !globsVencedores.has(`${e.arquivo}\u0000${g.original}`)) avisos.push(`${e.arquivo}: path "${g.original}" perde todos os seus arquivos para globs mais específicos`);
  }

  // Tabela coerente com `paths`: linha de dono cita arquivo desta entrada; linha de "Usa" cita arquivo de outra.
  for (const e of entradas) {
    if (!e.meta) continue;
    const linhasDono = citadosPorSecao(e.corpo, cfg.aliases).filter((c) => !c.usa).map((c) => c.expandido.replace(/\/$/, ''));
    for (const g of e.globs) {
      const base = g.expandido.replace(/\/$/, '');
      const temLinha = linhasDono.some((r) => r === base || base.startsWith(`${r}/`) || r.startsWith(`${base}/`) || casaGlob(base, r) || (/[*?]/.test(r) && casaGlob(r, base)));
      if (!temLinha) avisos.push(`${e.arquivo}: path "${g.original}" não tem linha na tabela de dono`);
    }
    for (const c of citadosPorSecao(e.corpo, cfg.aliases)) {
      const alvos = todos.filter((f) => f === c.expandido || f.startsWith(`${c.expandido.replace(/\/$/, '')}/`) || (/[*?]/.test(c.expandido) && casaGlob(c.expandido, f)));
      if (!alvos.length) continue;
      const meus = alvos.filter((f) => donos.get(f)?.has(e.arquivo)).length;
      if (!c.usa && meus === 0) avisos.push(`${e.arquivo}: a tabela de dono cita \`${c.original}\`, que pertence a ${[...(donos.get(alvos[0]) || ['ninguém'])].join(', ')}`);
      if (c.usa && meus === alvos.length) avisos.push(`${e.arquivo}: "Usa" cita \`${c.original}\`, que é desta própria entrada`);
    }
  }

  const orfaos = cobertos.filter((f) => !donos.has(f));
  if (orfaos.length) avisos.push(`${orfaos.length} de ${cobertos.length} arquivo(s) fora de toda entrada do mapa; veja \`${cfg.comando} orfaos\``);
  if (estrito) erros.push(...avisos.splice(0));
  return { erros, avisos, orfaos, cobertos, donos };
}

// ---------- coerência com os fontes_* dos _status.md ----------

/**
 * Compara, arquivo coberto a arquivo coberto, o dono segundo o mapa com o dono segundo os `fontes_api`/`fontes_web`
 * (lidos pelos portões doc-gate, cobertura e rastreio). `status` é [{ slug, fontes: { api: [], web: [] } }];
 * `casa(globs, repo, relativoAoRepo)` é o mesmo dos portões (o glob do g6, em rastreio/util.mjs). Devolve uma linha por divergência.
 */
export function comparaFontes({ cobertos, donos, entradas, status, repos, casa }) {
  const slugDe = new Map(entradas.filter((e) => e.chave === 'funcionalidade').map((e) => [e.arquivo, e.esperado]));
  const out = [];
  for (const f of cobertos) {
    const repo = Object.keys(repos).find((r) => f.startsWith(`${repos[r]}/`));
    if (!repo || [...(donos.get(f) || [])].some((a) => !slugDe.has(a))) continue; // área (doc/mapa) não tem _status.md
    const rel = f.slice(repos[repo].length + 1);
    const peloStatus = status.filter((s) => (s.fontes[repo] || []).length && casa(s.fontes[repo], repo, rel)).map((s) => s.slug).sort();
    const peloMapa = [...(donos.get(f) || [])].map((a) => slugDe.get(a)).sort();
    if (peloStatus.join() !== peloMapa.join()) out.push(`${repo}:${rel}: fontes_${repo} diz [${peloStatus.join(', ') || 'ninguém'}], o mapa diz [${peloMapa.join(', ') || 'ninguém'}]`);
  }
  return out;
}

// ---------- consulta ----------

const lista = (v) => (Array.isArray(v) ? v : []);
const validas = (entradas) => entradas.filter((e) => e.meta);

/** Normaliza um caminho digitado (absoluto, com barra invertida, relativo a um repo ou com alias) para relativo à raiz. */
export function normalizaCaminho(q, cfg, root) {
  let p = toPosix(q.trim());
  if (/^[A-Za-z]:\//.test(p) || p.startsWith('/')) p = toPosix(relative(root, p));
  return expandeAlias(p, cfg.aliases);
}

/** Por caminho: entradas cujo glob cobre o arquivo, ou que o citam em "Usa". Por palavra: ranking por campo. */
export function procura(entradas, consulta, cfg, root) {
  const q = consulta.trim();
  if (!q) return [];
  if (/[/\\.]/.test(q)) {
    const alvo = normalizaCaminho(q, cfg, root);
    const sufixo = (f) => f === alvo || f.endsWith(`/${alvo}`);
    const hits = validas(entradas).flatMap((e) => {
      const dono = e.globs.filter((g) => casaGlob(g.expandido, alvo) || (!/[*?]/.test(g.expandido) && sufixo(g.expandido)));
      const usa = citadosNoCorpo(e.corpo, cfg.aliases).some((c) => sufixo(c.expandido) || c.expandido.endsWith(`/${alvo.split('/').pop()}`));
      if (dono.length) {
        const [p, t] = dono.map((g) => especificidade(g.expandido)).reduce((m, x) => (comparaPeso(x, m) > 0 ? x : m));
        return [{ entrada: e, papel: 'dono', score: 1e6 + p * 1000 + t }];
      }
      if (usa) return [{ entrada: e, papel: 'usa', score: 1 }];
      // Último recurso: o nome do arquivo casa algum glob (ex.: `DispensacaoResource.java` sem pasta).
      const nome = alvo.split('/').pop();
      const porNome = e.globs.some((g) => casaGlob(g.expandido.split('/').pop(), nome));
      return porNome ? [{ entrada: e, papel: 'dono?', score: 10 }] : [];
    }).sort((a, b) => b.score - a.score);
    // Só o glob mais específico é dono; as outras entradas cujo glob mais amplo também casa cedem o arquivo.
    hits.filter((h) => h.papel === 'dono').slice(1).forEach((h) => { h.papel = 'cede'; });
    return hits;
  }
  const palavras = q.toLowerCase().split(/\s+/);
  return validas(entradas).map((e) => {
    const m = e.meta;
    const campos = [[m[e.chave], 3], [lista(m.palavras).join(' '), 2], [lista(m.historias).join(' '), 2], [m.resumo, 1]];
    const score = palavras.reduce((s, w) => s + campos.reduce((t, [txt, peso]) => t + (String(txt || '').toLowerCase().includes(w) ? peso : 0), 0), 0);
    return { entrada: e, papel: 'tema', score };
  }).filter((h) => h.score > 0).sort((a, b) => b.score - a.score);
}

// ---------- índice gerado ----------

export function tabelaIndice(entradas, { donos, prefixo = '' } = {}) {
  const contagem = new Map();
  if (donos) for (const [, ls] of donos) for (const a of ls) contagem.set(a, (contagem.get(a) || 0) + 1);
  const linhas = validas(entradas).map((e) => {
    const nome = e.meta[e.chave];
    const tipo = e.chave === 'funcionalidade' ? 'funcionalidade' : 'área';
    return `| [${nome}](${prefixo}${e.arquivo}) | ${tipo} | ${e.meta.resumo} | ${contagem.get(e.arquivo) ?? '?'} |`;
  });
  return ['| Entrada | Tipo | Cobre | Arquivos |', '|---|---|---|---|', ...linhas].join('\n');
}

/** Versão compacta para o MAPA.md (que tem limite de tamanho): uma linha por tipo, `nome (n)` com link. */
export function listaCompacta(entradas, { donos, indice = 'doc/mapa/INDEX.md' } = {}) {
  const contagem = new Map();
  if (donos) for (const [, ls] of donos) for (const a of ls) contagem.set(a, (contagem.get(a) || 0) + 1);
  const grupos = new Map();
  for (const e of validas(entradas)) {
    const tipo = e.chave === 'funcionalidade' ? 'Funcionalidades' : 'Áreas';
    (grupos.get(tipo) || grupos.set(tipo, []).get(tipo)).push(`[${e.meta[e.chave]}](${e.arquivo}) ${contagem.get(e.arquivo) ?? '?'}`);
  }
  const total = donos ? donos.size : 0;
  return [...grupos].map(([t, l]) => `**${t}:** ${l.join(' · ')}`).concat(`\nNúmero = arquivos de que a entrada é dona (${total} no total). Resumo de cada uma: [${indice}](${indice}).`).join('\n\n');
}

/** Órfãos agrupados por pasta, para guiar a expansão do mapa. */
export function agrupaPorPasta(arquivos, cfg, profundidade = 3) {
  const inverso = Object.entries(cfg.aliases).sort((a, b) => b[1].length - a[1].length);
  const grupos = new Map();
  for (const f of arquivos) {
    let rotulo = f;
    for (const [alias, base] of inverso) if (f.startsWith(`${base}/`)) { rotulo = `${alias}:${f.slice(base.length + 1)}`; break; }
    const [cab, resto] = rotulo.includes(':') ? rotulo.split(/:(.*)/s) : ['', rotulo];
    const pasta = resto.split('/').slice(0, -1).slice(0, profundidade).join('/');
    const chave = cab ? `${cab}:${pasta}` : pasta;
    grupos.set(chave, (grupos.get(chave) || 0) + 1);
  }
  return [...grupos].sort((a, b) => b[1] - a[1]);
}
