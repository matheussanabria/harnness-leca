// fidelidade/adapter-prototipo: builds the normalized inventory of one prototype screen (DIS prototype HTML:
// label.ds-field__label[for], input#id, .ds-input-wrap, .ds-field__row, data-component="dis.*"). Read-only.
// Selectors: "#id" | "texto:<exact text>" | "legend:<text>". The source HTML is never changed.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ancestral, classes, desce, parse, textoDe } from './html-parse.mjs';
import { iconeDeClasses, larguraPx, normTexto } from './util.mjs';

const CAMPOS = new Set(['input', 'select', 'textarea']);
const TEXTUAIS = new Set(['label', 'button', 'a', 'h1', 'h2', 'h3', 'h4', 'legend', 'span']);

function primeiroIcone(el) {
  let achado = null;
  desce(el, (n) => { if (!achado && n.tag === 'i') achado = iconeDeClasses(classes(n)); });
  return achado;
}

function campo(el, todos) {
  const id = el.attrs.id;
  const label = id ? todos.find((n) => n.tag === 'label' && n.attrs.for === id) : null;
  let marcaObrigatorio = false;
  if (label) desce(label, (n) => { if (classes(n).includes('ds-req')) marcaObrigatorio = true; });
  const wrap = ancestral(el, (n) => classes(n).includes('ds-input-wrap'));
  const linha = ancestral(el, (n) => classes(n).includes('ds-field__row'));
  let acao = null;
  if (linha) {
    const btn = linha.filhos.find((n) => n.t === 'el' && n.tag === 'button');
    if (btn) acao = { rotulo: normTexto(textoDe(btn)), icone: primeiroIcone(btn) };
  }
  return {
    rotulo: label ? normTexto(textoDe(label)) : null,
    placeholder: el.attrs.placeholder ?? null,
    obrigatorio: 'required' in el.attrs || el.attrs['aria-required'] === 'true' || marcaObrigatorio,
    desabilitado: 'disabled' in el.attrs || 'readonly' in el.attrs,
    // The icon inside the input wrap belongs to the field; an icon in the neighbouring action button does not.
    icone: wrap ? primeiroIcone(wrap) : null,
    largura: larguraPx(el.attrs.style) ?? larguraPx(wrap?.attrs.style),
    acao,
  };
}

function botao(el) {
  return { rotulo: normTexto(textoDe(el)), icone: primeiroIcone(el), desabilitado: 'disabled' in el.attrs };
}

function porTexto(todos, texto) {
  const alvo = normTexto(texto);
  return todos.find((n) => TEXTUAIS.has(n.tag) && normTexto(textoDe(n)) === alvo);
}

function item(todos, seletor) {
  let el = null;
  if (seletor.startsWith('#')) el = todos.find((n) => n.attrs.id === seletor.slice(1));
  else if (seletor.startsWith('legend:')) el = todos.find((n) => n.tag === 'legend' && normTexto(textoDe(n)) === normTexto(seletor.slice(7)));
  else if (seletor.startsWith('texto:')) el = porTexto(todos, seletor.slice(6));
  if (!el) return null;
  if (CAMPOS.has(el.tag)) return campo(el, todos);
  if (el.tag === 'button') return botao(el);
  if (el.tag === 'legend') {
    let req = false;
    desce(el, (n) => { if (classes(n).includes('ds-req')) req = true; });
    return { rotulo: normTexto(textoDe(el)), obrigatorio: req };
  }
  const input = el.tag === 'label' ? el.filhos.find((n) => n.t === 'el' && n.tag === 'input') : null;
  return { rotulo: normTexto(textoDe(el)), desabilitado: input ? 'disabled' in input.attrs : false };
}

// Loads one prototype screen. `protoDir` holds proto.json and screens/. Returns { item(seletor), ids() } or { erro }.
export function carregaPrototipo(protoDir, telaId) {
  const manifesto = join(protoDir, 'proto.json');
  if (!existsSync(manifesto)) return { erro: `proto.json não encontrado em ${protoDir}` };
  const tela = (JSON.parse(readFileSync(manifesto, 'utf8').replace(/^﻿/, '')).screens || []).find((s) => s.id === telaId);
  if (!tela) return { erro: `tela "${telaId}" não existe em ${manifesto}` };
  const arquivo = join(protoDir, tela.file);
  if (!existsSync(arquivo)) return { erro: `arquivo da tela não encontrado: ${arquivo}` };
  const { todos } = parse(readFileSync(arquivo, 'utf8'));
  return {
    arquivo,
    item: (seletor) => item(todos, seletor),
    ids: () => todos.filter((n) => n.attrs.id && (CAMPOS.has(n.tag) || n.tag === 'button')).map((n) => n.attrs.id),
  };
}
