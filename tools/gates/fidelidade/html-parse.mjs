// fidelidade/html-parse: tiny tolerant HTML parser shared by the prototype and Angular-template adapters.
// Handles quoted attributes that contain ">" or newlines, comments, void tags, `{{ }}` interpolation and the
// Angular control-flow blocks (@if, @else, @for, ...). Elements inside a block get `cond: true`. Not a validator.
const VOID = new Set(['input', 'img', 'br', 'hr', 'meta', 'link', 'source', 'col', 'area', 'base', 'wbr']);
const BLOCO = /@(?:else\s+if|if|else|for|switch|case|default|empty|defer|placeholder|loading|error)\b/y;

// Reads attributes from `src` starting at `i`; returns { attrs, fim, autoFecha }.
function leAtributos(src, i) {
  const attrs = {};
  while (i < src.length) {
    while (/\s/.test(src[i] || '')) i++;
    if (src[i] === '>') return { attrs, fim: i + 1, autoFecha: false };
    if (src[i] === '/' && src[i + 1] === '>') return { attrs, fim: i + 2, autoFecha: true };
    const m = /^[^\s=/>]+/.exec(src.slice(i));
    if (!m) { i++; continue; }
    const nome = m[0];
    i += nome.length;
    while (/\s/.test(src[i] || '')) i++;
    let valor = '';
    if (src[i] === '=') {
      i++;
      while (/\s/.test(src[i] || '')) i++;
      const q = src[i];
      if (q === '"' || q === "'") {
        const f = src.indexOf(q, i + 1);
        const fim = f < 0 ? src.length : f;
        valor = src.slice(i + 1, fim);
        i = fim + 1;
      } else {
        const u = /^[^\s>]+/.exec(src.slice(i));
        valor = u ? u[0] : '';
        i += valor.length;
      }
    }
    attrs[nome] = valor;
  }
  return { attrs, fim: i, autoFecha: false };
}

// Text between tags: strips `{{ }}`, tracks control-flow braces, returns the visible text.
function processaTexto(txt, estado) {
  const limpo = txt.replace(/\{\{[\s\S]*?\}\}/g, ' ');
  let visivel = '';
  let i = 0;
  while (i < limpo.length) {
    const c = limpo[i];
    if (c === '@') {
      BLOCO.lastIndex = i;
      const m = BLOCO.exec(limpo);
      if (m) {
        let j = i + m[0].length;
        while (/\s/.test(limpo[j] || '')) j++;
        if (limpo[j] === '(') {
          let n = 0;
          for (; j < limpo.length; j++) {
            if (limpo[j] === '(') n++;
            else if (limpo[j] === ')' && --n === 0) { j++; break; }
          }
        }
        while (/\s/.test(limpo[j] || '')) j++;
        if (limpo[j] === '{') { estado.prof++; i = j + 1; continue; }
      }
    }
    if (c === '}' && estado.prof > 0) { estado.prof--; i++; continue; }
    visivel += c;
    i++;
  }
  return visivel;
}

// Returns { raiz, todos } where `todos` lists every element in document order.
export function parse(src) {
  const raiz = { t: 'el', tag: '#raiz', attrs: {}, filhos: [], pai: null, cond: false, idx: -1 };
  const todos = [];
  const estado = { prof: 0 };
  let atual = raiz;
  let i = 0;
  while (i < src.length) {
    if (src.startsWith('<!--', i)) { const f = src.indexOf('-->', i + 4); i = f < 0 ? src.length : f + 3; continue; }
    if (src[i] === '<' && src[i + 1] === '/') {
      const f = src.indexOf('>', i);
      const nome = src.slice(i + 2, f < 0 ? src.length : f).trim().toLowerCase();
      for (let n = atual; n && n !== raiz; n = n.pai) if (n.tag === nome) { atual = n.pai; break; }
      i = f < 0 ? src.length : f + 1;
      continue;
    }
    if (src[i] === '<' && /[A-Za-z]/.test(src[i + 1] || '')) {
      const m = /^[^\s/>]+/.exec(src.slice(i + 1));
      const tag = m[0].toLowerCase();
      const { attrs, fim, autoFecha } = leAtributos(src, i + 1 + m[0].length);
      const el = { t: 'el', tag, attrs, filhos: [], pai: atual, cond: estado.prof > 0, idx: todos.length };
      atual.filhos.push(el);
      todos.push(el);
      if (!autoFecha && !VOID.has(tag)) atual = el;
      i = fim;
      continue;
    }
    const prox = src.indexOf('<', i + 1);
    const fim = prox < 0 ? src.length : prox;
    const visivel = processaTexto(src.slice(i, fim), estado);
    if (visivel.trim()) atual.filhos.push({ t: 'tx', v: visivel });
    i = fim;
  }
  return { raiz, todos };
}

// Visible text of an element, whitespace collapsed.
export function textoDe(el) {
  const partes = [];
  const anda = (n) => { for (const f of n.filhos || []) f.t === 'tx' ? partes.push(f.v) : anda(f); };
  anda(el);
  return partes.join(' ').replace(/\s+/g, ' ').trim();
}

export const classes = (el) => String(el?.attrs?.class || '').split(/\s+/).filter(Boolean);

export function desce(el, fn) {
  for (const f of el.filhos || []) if (f.t === 'el') { fn(f); desce(f, fn); }
}

export function ancestral(el, pred) {
  for (let n = el?.pai; n && n.tag !== '#raiz'; n = n.pai) if (pred(n)) return n;
  return null;
}
