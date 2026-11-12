// fidelidade/candidatos: lists what can be paired on each side, as { sel, tipo, chave }. `sel` is a selector the
// adapters already understand ("#id", "texto:...", "legend:..." on the prototype; key, "texto:..." in the code).
// tipo is "campo" or "botao"; fields and buttons are never matched against each other.
import { ancestral, classes, textoDe } from './html-parse.mjs';
import { normTexto } from './util.mjs';

const CAMPOS = new Set(['input', 'select', 'textarea']);
const TITULOS = new Set(['h1', 'h2', 'h3', 'h4']);
// Chrome of the prototype that is not part of the screen under test (header, side menu, accordions, close buttons).
const FORA = ['ds-header', 'dis-sidenav', 'ds-iconbtn', 'ds-accordion', 'ds-linkbtn', 'ds-alert'];
const fora = (n) => classes(n).some((c) => FORA.some((f) => c.startsWith(f))) || !!ancestral(n, (a) => classes(a).some((c) => FORA.some((f) => c.startsWith(f))));

export function candidatosPrototipo(todos) {
  const out = [];
  const vistos = new Set();
  const add = (c) => { if (!vistos.has(c.sel)) { vistos.add(c.sel); out.push(c); } };
  for (const n of todos) {
    if (fora(n)) continue;
    if (CAMPOS.has(n.tag)) {
      if (['radio', 'checkbox', 'hidden'].includes(n.attrs.type) || !n.attrs.id) continue;
      add({ sel: `#${n.attrs.id}`, tipo: 'campo', chave: n.attrs.id });
    } else if (n.tag === 'button') {
      const texto = normTexto(textoDe(n));
      if (n.attrs.id) add({ sel: `#${n.attrs.id}`, tipo: 'botao', chave: n.attrs.id });
      else if (texto && classes(n).includes('btn')) add({ sel: `texto:${texto}`, tipo: 'botao', chave: texto });
    } else if (n.tag === 'legend') {
      const texto = normTexto(textoDe(n));
      if (texto) add({ sel: `legend:${texto}`, tipo: 'campo', chave: texto });
    } else if (n.tag === 'label' && n.filhos.some((f) => f.t === 'el' && f.tag === 'input' && f.attrs.type === 'checkbox')) {
      const texto = normTexto(textoDe(n));
      if (texto) add({ sel: `texto:${texto}`, tipo: 'campo', chave: texto });
    } else if (TITULOS.has(n.tag)) {
      const texto = normTexto(textoDe(n));
      if (texto) add({ sel: `texto:${texto}`, tipo: 'titulo', chave: texto });
    }
  }
  return out;
}

const TAGS_CAMPO = (tag) => CAMPOS.has(tag) || tag.includes('-');
export function candidatosCodigo(todos) {
  const out = [];
  const chaves = new Set();
  const textos = new Set();
  for (const n of todos) {
    const chave = [n.attrs.formControlName, n.attrs.idExterno, n.attrs.id, n.attrs.name].find(Boolean);
    if (n.tag === 'button') {
      const texto = normTexto(textoDe(n));
      if (n.attrs.id && !chaves.has(n.attrs.id)) { chaves.add(n.attrs.id); out.push({ sel: n.attrs.id, tipo: 'botao', chave: n.attrs.id }); }
      else if (texto && !textos.has(texto)) { textos.add(texto); out.push({ sel: `texto:${texto}`, tipo: 'botao', chave: texto }); }
    } else if (TITULOS.has(n.tag)) {
      const texto = normTexto(textoDe(n));
      if (texto && !textos.has(`t:${texto}`)) { textos.add(`t:${texto}`); out.push({ sel: `titulo:${texto}`, tipo: 'titulo', chave: texto }); }
    } else if (chave && TAGS_CAMPO(n.tag) && !chaves.has(chave)) {
      chaves.add(chave); // a field repeated in two @if branches is listed once (the first)
      out.push({ sel: chave, tipo: 'campo', chave, chaves: [...new Set([n.attrs.formControlName, n.attrs.idExterno, n.attrs.id, n.attrs.name].filter(Boolean))] });
    } else if (n.tag === 'legend') {
      const texto = normTexto(textoDe(n));
      if (texto && !textos.has(`l:${texto}`)) { textos.add(`l:${texto}`); out.push({ sel: `legend:${texto}`, tipo: 'campo', chave: texto }); }
    }
  }
  return out;
}
