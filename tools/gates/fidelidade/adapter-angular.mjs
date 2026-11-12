// fidelidade/adapter-angular: builds the normalized inventory from Angular templates (.html next to a .ts and
// a .css). Static only: nothing is compiled or run. Understands the DIS components listed under
// `componentes` in the config (default icon of a component, e.g. busca-typeahead -> magnifying-glass).
// Selectors: "<key>" or { chave, n } (key = formControlName | idExterno | id | name; n = nth match, 1-based),
// "texto:<exact text>", "legend:<text>" and "titulo:<text>".
import { existsSync, readFileSync } from 'node:fs';
import { ancestral, classes, desce, parse, rotuloDeInfo, textoDe } from './html-parse.mjs';
import { booleano, iconeDeClasses, iconeDeSimbolo, larguraPx, nomeIcone, normTexto, textoEstatico } from './util.mjs';

const lerSe = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : '');

// readonly iconeClipe = faPaperclip;  ->  { iconeClipe: 'paperclip' }
function iconesDoTs(ts) {
  const out = {};
  for (const m of ts.matchAll(/(?:readonly\s+|public\s+|protected\s+)?(\w+)\s*=\s*(fa[A-Z]\w*)\s*[;,]/g)) out[m[1]] = iconeDeSimbolo(m[2]);
  return out;
}

// .classe { ... width: 168px ... }  ->  { classe: 168 }
function largurasDoCss(css) {
  const out = {};
  for (const m of css.matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g)) {
    const w = /(?:^|[;\s])width\s*:\s*([^;]+)/.exec(m[2]);
    const px = w ? larguraPx(w[1]) : null;
    if (px != null) out[m[1]] = px;
  }
  return out;
}

export function carregaAngular(templates, estilos = [], componentes = {}) {
  const todos = [];
  const icones = {};
  const larguras = {};
  for (const t of templates) {
    todos.push(...parse(lerSe(t)).todos);
    Object.assign(icones, iconesDoTs(lerSe(t.replace(/\.html$/, '.ts'))));
    Object.assign(larguras, largurasDoCss(lerSe(t.replace(/\.html$/, '.css'))));
  }
  for (const e of estilos) Object.assign(larguras, largurasDoCss(lerSe(e)));

  const iconeDe = (n) => {
    let achado = null;
    desce(n, (f) => {
      if (achado) return;
      if (f.tag === 'fa-icon') achado = icones[(f.attrs['[icon]'] || '').trim()] ?? undefined;
      else if (f.tag === 'i') achado = iconeDeClasses(classes(f));
    });
    return achado;
  };
  const larguraDeClasses = (n) => {
    for (let e = n; e && e.tag !== '#raiz'; e = e.pai) {
      for (const c of classes(e)) if (c in larguras) return larguras[c];
    }
    return null;
  };

  // DIS components: one element carries label, placeholder, icon and action as inputs.
  function componente(el) {
    const a = el.attrs;
    const padrao = componentes[el.tag] || {};
    const acaoRotulo = textoEstatico(a, 'actionLabel');
    return {
      rotulo: textoEstatico(a, 'label'),
      placeholder: textoEstatico(a, 'placeholder') ?? padrao.placeholder ?? null,
      obrigatorio: booleano(a, 'required'),
      desabilitado: booleano(a, 'disabled') || booleano(a, 'readonly'),
      icone: a.icon ? nomeIcone(a.icon) : (padrao.icone ?? null),
      largura: larguraPx(a.inputWidth) ?? larguraDeClasses(el),
      acao: acaoRotulo ? { rotulo: acaoRotulo, icone: nomeIcone(a.actionIcon) } : null,
    };
  }

  function inputCru(el) {
    const id = el.attrs.id;
    const label = (id ? todos.find((n) => n.tag === 'label' && n.attrs.for === id) : null) || rotuloDeInfo(el);
    const wrap = ancestral(el, (n) => classes(n).includes('ds-input-wrap')) || el.pai;
    const estado = (n) => classes(n).includes('is-disabled');
    return {
      rotulo: label ? normTexto(textoDe(label)) : null,
      placeholder: el.attrs.placeholder ?? null,
      obrigatorio: booleano(el.attrs, 'required') || el.attrs['aria-required'] === 'true' || (label ? comMarca(label) : false),
      desabilitado: 'disabled' in el.attrs || 'readonly' in el.attrs || estado(wrap) || (label ? estado(label) : false),
      icone: iconeDe(wrap),
      largura: larguraPx(el.attrs.style) ?? larguraDeClasses(el),
      acao: null,
    };
  }

  const comMarca = (n) => { let m = false; desce(n, (f) => { if (classes(f).includes('ds-req')) m = true; }); return m; };
  const porChave = (chave, n = 1) => todos
    .filter((e) => [e.attrs.formControlName, e.attrs.idExterno, e.attrs.id, e.attrs.name].includes(chave))
    .filter((e) => e.tag !== 'label')[n - 1] || null;
  const porTexto = (texto, tags) => todos.find((e) => tags.includes(e.tag) && normTexto(textoDe(e)) === normTexto(texto));

  function item(seletor) {
    const { chave, n } = typeof seletor === 'object' ? seletor : { chave: seletor, n: 1 };
    let el = null;
    if (chave.startsWith('texto:')) el = porTexto(chave.slice(6), ['button', 'label', 'a', 'span']);
    else if (chave.startsWith('titulo:')) el = porTexto(chave.slice(7), ['h1', 'h2', 'h3', 'h4']);
    else if (chave.startsWith('legend:')) el = porTexto(chave.slice(7), ['legend']);
    else el = porChave(chave, n);
    if (!el) return null;
    if (['legend', 'h1', 'h2', 'h3', 'h4'].includes(el.tag) && !el.attrs.label) return { rotulo: normTexto(textoDe(el)) };
    if (el.tag === 'button') return { rotulo: normTexto(textoDe(el)), icone: iconeDe(el), desabilitado: 'disabled' in el.attrs };
    if (el.tag === 'label') return { rotulo: normTexto(textoDe(el)) };
    if (el.tag === 'input') return inputCru(el);
    if (el.tag === 'span') return { rotulo: normTexto(textoDe(el)) };
    return componente(el);
  }

  return { item, todos, total: todos.length };
}
