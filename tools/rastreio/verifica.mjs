// rastreio/verifica: runs every gate over one feature, in the same order as the legacy script
// (the order of reported errors and warnings is part of the frozen baseline).
import { join } from 'node:path';
import { carregaYaml } from './carrega.mjs';
import { gateEntradas } from './gates/entradas.mjs';
import { gateRegras } from './gates/regras.mjs';
import { gateG7 } from './gates/g7.mjs';
import { gateG8, gateG5, lerCabecalho } from './gates/status.mjs';
import { gateG9 } from './gates/g9.mjs';
import { gateNavega } from './gates/navega.mjs';
import { gateG6 } from './gates/g6.mjs';

export function verifica(ctx, slug, arquivoYml) {
  const dir = join(ctx.cfg.docs.features, slug);
  const erros = [], avisos = [];
  const E = (g, m) => erros.push({ g, m }), A = (g, m) => avisos.push({ g, m });
  let d;
  try { d = carregaYaml(arquivoYml); } catch (e) { return { slug, erros: [{ g: 'G3', m: `YAML inválido: ${e.message.split('\n')[0]}` }], avisos, resumo: null }; }
  const grupos = { cenarios: d.cenarios || {}, requisitos: d.requisitos || {}, derivados: d.derivados || {} };
  const regras = d.regras || {};
  const entradas = Object.entries(grupos).flatMap(([g, o]) => Object.entries(o).map(([id, e]) => [id, e || {}, g]));
  const f = { slug, dir, d, regras, entradas, erros, avisos, E, A, citadas: null };

  f.citadas = gateEntradas(ctx, f);
  gateRegras(ctx, f);
  gateG7(ctx, f);
  gateG8(ctx, f);
  gateG9(ctx, f);
  gateNavega(ctx, f);
  const h = lerCabecalho(ctx, dir);
  gateG5(ctx, f, h);
  const testesSemElo = gateG6(ctx, f, h);

  return { slug, erros, avisos, resumo: { entradas: entradas.length, regras: Object.keys(regras).length, semProva: Object.values(regras).filter((v) => v?.sem_prova).length, testesSemElo } };
}
