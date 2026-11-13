#!/usr/bin/env node
// fidelidade/cli: prototype x code fidelity gates (ADR-016). G10 compares the prototype inventory with the code
// inventory; G11 asks for a new review when a cited code file changed. Read-only unless --registrar-revisao.
//
//   node tools/gates/fidelidade/cli.mjs --config <harness-gates.json> [--root <dir>] [--features a,b] [--json]
//                                       [--registrar-revisao] [--data AAAA-MM-DD]
//
// Config block (harness-gates.json): "fidelidade": { "features": "doc/sistema/features",
//   "prototipos": { "<id>": "<dir with proto.json>" }, "severidade": { "G10": "aviso|erro", "G11": "aviso|erro" },
//   "componentes": { "busca-typeahead": { "icone": "magnifying-glass" } } }
// Pairing file per feature: <features>/<slug>/pareamento.json (see docs/harness-gates/02-pareamento.md).
// Exit: 0 ok, 1 gate errors, 2 invalid config or pairing.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { carregaAngular } from './adapter-angular.mjs';
import { carregaPrototipo } from './adapter-prototipo.mjs';
import { decideCampo } from './compara.mjs';
import { derivaStatus, conferirG12 } from './g12.mjs';
import { conferePorHash, registraRevisao } from './g11.mjs';

const json = (f) => JSON.parse(readFileSync(f, 'utf8').replace(/^﻿/, ''));

// G10/G11 start as warnings (ADR-016); a project promotes a gate with severidade.<gate> = "erro".
const nivelDe = (cfg, g) => (cfg.severidade?.[g] === 'erro' ? 'erro' : 'aviso');

function conferirTela(root, cfg, tela) {
  const achados = [];
  const dirProto = cfg.prototipos?.[tela.prototipo?.id];
  if (!dirProto) return { achados: [{ g: 'G10', nivel: 'erro', m: `protótipo "${tela.prototipo?.id}" não está em fidelidade.prototipos da config` }], campos: 0, declaradas: 0 };
  const proto = carregaPrototipo(resolve(root, dirProto), tela.prototipo?.tela);
  if (proto.erro) return { achados: [{ g: 'G10', nivel: 'erro', m: proto.erro }], campos: 0, declaradas: 0 };
  const codigo = carregaAngular((tela.codigo?.templates || []).map((t) => resolve(root, t)), (tela.codigo?.estilos || []).map((t) => resolve(root, t)), cfg.componentes || {});
  const declaradas = tela.declaradas || [];
  let nDeclaradas = 0;
  const diverge = {};
  for (const campo of tela.campos || []) {
    const resultado = decideCampo(campo, proto.item(campo.proto), codigo.item(campo.codigo), declaradas, tela.confirmadas || []);
    diverge[campo.id] = resultado.some((r) => r.tipo !== 'indeterminada' && r.tipo !== 'confirmada');
    for (const r of resultado) {
      if (r.tipo === 'confirmada') continue;
      if (r.tipo === 'declarada') { nDeclaradas++; continue; }
      const duro = r.tipo === 'pareamento' || r.tipo === 'nao-confere';
      achados.push({ g: 'G10', nivel: duro ? 'erro' : r.tipo === 'indeterminada' ? 'aviso' : nivelDe(cfg, 'G10'), m: r.m });
    }
  }
  const pareados = new Set((tela.campos || []).map((c) => String(c.proto || '').replace(/^#/, '')));
  const soltos = proto.ids().filter((id) => !pareados.has(id) && !(tela.ignorarPrototipo || []).includes(id));
  if (soltos.length) achados.push({ g: 'G10', nivel: 'aviso', m: `elementos do protótipo sem pareamento: ${soltos.join(', ')}` });
  return { achados, campos: (tela.campos || []).length, declaradas: nDeclaradas, derivado: derivaStatus(tela.campos || [], diverge) };
}

export function roda(argv, cwd = process.cwd()) {
  const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  const flag = (n) => argv.includes(n);
  const arquivoCfg = opt('--config') && resolve(cwd, opt('--config'));
  if (!arquivoCfg || !existsSync(arquivoCfg)) { console.error('[fidelidade] informe --config <harness-gates.json> (arquivo existente)'); return 2; }
  let cfg;
  try { cfg = json(arquivoCfg).fidelidade; } catch (e) { console.error(`[fidelidade] config inválido (JSON): ${e.message}`); return 2; }
  if (!cfg) { console.error('[fidelidade] a config não tem o bloco "fidelidade"'); return 2; }
  const root = resolve(cwd, opt('--root') || dirname(arquivoCfg));
  const dirFeatures = resolve(root, cfg.features || 'doc/sistema/features');
  if (!existsSync(dirFeatures)) { console.error(`[fidelidade] pasta de funcionalidades inexistente: ${dirFeatures}`); return 2; }

  const pedidas = opt('--features') ? opt('--features').split(',').map((s) => s.trim()).filter(Boolean) : null;
  const slugs = (pedidas || readdirSync(dirFeatures).filter((n) => statSync(join(dirFeatures, n)).isDirectory())).sort()
    .filter((s) => existsSync(join(dirFeatures, s, 'pareamento.json')));
  const resultados = [];
  for (const slug of slugs) {
    const arq = join(dirFeatures, slug, 'pareamento.json');
    let par;
    try { par = json(arq); } catch (e) { resultados.push({ slug, achados: [{ g: 'G10', nivel: 'erro', m: `pareamento.json inválido: ${e.message}` }], campos: 0, declaradas: 0 }); continue; }
    if (flag('--registrar-revisao')) {
      par.revisao = registraRevisao(root, par.telas || [], opt('--data') || new Date().toISOString().slice(0, 10));
      writeFileSync(arq, JSON.stringify(par, null, 2) + '\n');
    }
    const agg = { slug, achados: [], campos: 0, declaradas: 0 };
    const arqMapa = join(dirFeatures, slug, 'mapa-camadas.json');
    const mapa = existsSync(arqMapa) ? json(arqMapa) : null;
    const derivadoFeature = {};
    for (const tela of par.telas || []) {
      const r = conferirTela(root, cfg, tela);
      derivadoFeature[tela.id] = r.derivado;
      const telaMapa = (mapa?.telas || []).find((t) => t.id === tela.id);
      if (telaMapa) agg.achados.push(...conferirG12(telaMapa, r.derivado, opt('--hoje') || new Date().toISOString().slice(0, 10)).map((a) => ({ ...a, nivel: nivelDe(cfg, 'G12') })));
      agg.achados.push(...r.achados.map((a) => ({ ...a, m: `${tela.id}: ${a.m}` })));
      agg.campos += r.campos;
      agg.declaradas += r.declaradas;
    }
    if (flag('--derivar')) writeFileSync(join(dirFeatures, slug, 'status-derivado.json'), JSON.stringify({ schema: 1, telas: derivadoFeature }, null, 2) + '\n');
    for (const h of conferePorHash(root, par.telas || [], par.revisao)) agg.achados.push({ g: 'G11', nivel: nivelDe(cfg, 'G11'), m: h.m });
    resultados.push(agg);
  }

  const falhou = resultados.some((r) => r.achados.some((a) => a.nivel === 'erro'));
  if (flag('--json')) { console.log(JSON.stringify(resultados, null, 1)); return falhou ? 1 : 0; }
  for (const r of resultados) {
    const erros = r.achados.filter((a) => a.nivel === 'erro');
    console.log(`[fidelidade] ${erros.length ? '✗' : '✓'} ${r.slug} — ${r.campos} campos, ${r.declaradas} diferenças declaradas`);
    for (const a of r.achados) console.log(`    ${a.nivel === 'erro' ? 'ERRO ' : 'aviso'} ${a.g}  ${a.m}`);
  }
  if (!resultados.length) console.log('[fidelidade] nenhuma funcionalidade com pareamento.json para conferir.');
  return falhou ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(roda(process.argv.slice(2)));
