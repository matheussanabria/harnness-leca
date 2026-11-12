#!/usr/bin/env node
// fidelidade/propose: drafts a pareamento.json screen by matching the prototype inventory with the code inventory
// (ADR-016). Static and read-only: it writes a draft for a person to review, never the real pairing file.
//
//   node propose.mjs --config <harness-gates.json> --prototipo <id> --tela <prototype screen id>
//        --templates <a.html,b.html> [--root <dir>] [--id <id da tela no mapa>] [--saida <draft.json>]
//        [--comparar <pareamento.json>]   score the draft against an existing pairing of the same screen
//
// Matching, in order: same label and same placeholder (alta), same label (media), same placeholder (media),
// similar key (baixa). Fields and buttons never match each other. Code fields whose label is bound at run time
// stay unmatched and are listed apart: only the rendered screen can confirm them.
// Exit: 0 ok, 2 bad usage or unreadable input.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { carregaAngular } from './adapter-angular.mjs';
import { carregaPrototipo } from './adapter-prototipo.mjs';
import { candidatosCodigo, candidatosPrototipo } from './candidatos.mjs';
import { comparaComExistente } from './propose-score.mjs';

const json = (f) => JSON.parse(readFileSync(f, 'utf8').replace(/^﻿/, ''));
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (s) => norm(s).replace(/ /g, '-') || 'campo';

export function casa(protoCands, codeCands, itemP, itemC) {
  const P = protoCands.map((c) => ({ ...c, info: itemP(c.sel) || {} }));
  const C = codeCands.map((c) => ({ ...c, info: itemC(c.sel) || {} }));
  const pares = [];
  const usaP = new Set();
  const usaC = new Set();
  const passo = (confianca, motivo, igual) => {
    for (const p of P) {
      if (usaP.has(p.sel)) continue;
      const c = C.find((x) => !usaC.has(x.sel) && x.tipo === p.tipo && igual(p, x));
      if (!c) continue;
      usaP.add(p.sel); usaC.add(c.sel);
      pares.push({ p, c, confianca, motivo });
    }
  };
  const rot = (x) => (typeof x.info.rotulo === 'string' ? norm(x.info.rotulo) : null);
  const ph = (x) => norm(x.info.placeholder);
  passo('alta', 'mesmo rótulo e mesmo placeholder', (p, c) => rot(p) && rot(p) === rot(c) && ph(p) === ph(c));
  passo('media', 'mesmo rótulo', (p, c) => rot(p) && rot(p) === rot(c));
  passo('media', 'mesmo placeholder', (p, c) => ph(p) && ph(p) === ph(c));
  passo('baixa', 'chave parecida', (p, c) => {
    const a = norm(p.chave).replace(/ /g, '');
    const b = norm(c.chave).replace(/ /g, '');
    return a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a));
  });
  return {
    pares,
    semParPrototipo: P.filter((p) => !usaP.has(p.sel)).map((p) => p.sel),
    semParCodigo: C.filter((c) => !usaC.has(c.sel) && typeof c.info.rotulo === 'string').map((c) => c.sel),
    dinamicos: C.filter((c) => !usaC.has(c.sel) && c.info.rotulo === undefined).map((c) => c.sel),
  };
}

export function rascunho({ protoDir, telaProto, protoId, templates, estilos = [], componentes = {}, idTela = 's1' }) {
  const proto = carregaPrototipo(protoDir, telaProto);
  if (proto.erro) return { erro: proto.erro };
  const codigo = carregaAngular(templates, estilos, componentes);
  const r = casa(candidatosPrototipo(proto.todos), candidatosCodigo(codigo.todos), proto.item, codigo.item);
  const campos = r.pares.map(({ p, c, confianca, motivo }) => ({
    id: slug(p.info.rotulo || p.chave), proto: p.sel, codigo: c.sel, confianca, motivo, ...(c.chaves ? { chaves: c.chaves } : {}),
  }));
  return { r, tela: { id: idTela, prototipo: { id: protoId, tela: telaProto }, codigo: { templates }, campos } };
}

export function roda(argv, cwd = process.cwd()) {
  const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  const cfgArq = opt('--config') && resolve(cwd, opt('--config'));
  if (!cfgArq || !existsSync(cfgArq) || !opt('--prototipo') || !opt('--tela') || !opt('--templates')) {
    console.error('uso: node propose.mjs --config <harness-gates.json> --prototipo <id> --tela <tela do protótipo> --templates <a.html,b.html> [--root <dir>] [--id s1] [--saida <arquivo>] [--comparar <pareamento.json>]');
    return 2;
  }
  const cfg = json(cfgArq).fidelidade || {};
  const root = resolve(cwd, opt('--root') || dirname(cfgArq));
  const protoDir = cfg.prototipos?.[opt('--prototipo')];
  if (!protoDir) { console.error(`[propor] protótipo "${opt('--prototipo')}" não está em fidelidade.prototipos`); return 2; }
  const templates = opt('--templates').split(',').map((s) => s.trim()).filter(Boolean);
  const faltando = templates.filter((t) => !existsSync(resolve(root, t)));
  if (faltando.length) { console.error(`[propor] template inexistente: ${faltando.join(', ')}`); return 2; }
  const out = rascunho({
    protoDir: resolve(root, protoDir), telaProto: opt('--tela'), protoId: opt('--prototipo'),
    templates: templates.map((t) => resolve(root, t)), componentes: cfg.componentes || {}, idTela: opt('--id') || 's1',
  });
  if (out.erro) { console.error(`[propor] ${out.erro}`); return 2; }
  out.tela.codigo.templates = templates; // keep the repo-relative paths in the draft
  const { r, tela } = out;
  const cont = (c) => tela.campos.filter((x) => x.confianca === c).length;
  console.log(`[propor] ${tela.campos.length} pares (alta ${cont('alta')}, media ${cont('media')}, baixa ${cont('baixa')}); sem par no protótipo ${r.semParPrototipo.length}, sem par no código ${r.semParCodigo.length}, rótulo dinâmico no código ${r.dinamicos.length}`);
  for (const [t, l] of [['sem par no protótipo', r.semParPrototipo], ['sem par no código', r.semParCodigo], ['dinâmicos (conferir na tela)', r.dinamicos]]) if (l.length) console.log(`    ${t}: ${l.join(', ')}`);
  if (opt('--saida')) { writeFileSync(resolve(cwd, opt('--saida')), JSON.stringify({ schema: 1, telas: [tela], semPar: r }, null, 2) + '\n'); console.log(`[propor] rascunho gravado em ${opt('--saida')}`); }
  if (opt('--comparar')) {
    const ex = json(resolve(cwd, opt('--comparar'))).telas?.find((t) => t.id === (opt('--id') || 's1'));
    if (!ex) { console.error('[propor] --comparar: tela não encontrada no pareamento informado (use --id)'); return 2; }
    const s = comparaComExistente(tela.campos, ex.campos || []);
    console.log(`[propor] contra o pareamento existente: acertos ${s.acertos}/${s.total} (${s.pct}%), trocados ${s.trocados.length}, perdidos ${s.perdidos.length}, extras ${s.extras.length}`);
    for (const t of s.trocados) console.log(`    trocado: ${t}`);
    for (const t of s.perdidos) console.log(`    perdido: ${t}`);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(roda(process.argv.slice(2)));
