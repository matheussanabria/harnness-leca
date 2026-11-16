// rastreio/gates/navega: links between screens declared in mapa-camadas.json (`telas[].navega`), reported as G9.
// Each item: { tipo?: "navegacao" | "chamada", para: "<slug>-<tela>", campo?, via?: "http" | "servico", como, evidencia? }.
// A missing `tipo` means navegacao (the first format had none).
// ERRORS: unknown `tipo`, missing `como`, `para` missing or not a screen of any feature map.
// Warnings: `campo` that is not a field of the source screen; `via` on a navigation; a call without `via`.
// A map without `navega` reports nothing, so projects that have not filled it keep their output unchanged.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BOM, lerTexto } from '../util.mjs';

const TIPOS = ['navegacao', 'chamada'];
const VIAS = ['http', 'servico'];

/** @type {WeakMap<object, Set<string>>} every "<slug>-<tela>" id of the project, read once per run */
const telasPorCtx = new WeakMap();

function lerMapa(arq) {
  try { return JSON.parse(lerTexto(arq).replace(BOM, '')); } catch { return null; }
}

function todasAsTelas(ctx) {
  if (telasPorCtx.has(ctx)) return telasPorCtx.get(ctx);
  const ids = new Set();
  const raiz = ctx.cfg.docs.features;
  let pastas = [];
  try { pastas = readdirSync(raiz, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { pastas = []; }
  for (const slug of pastas) {
    const arq = join(raiz, slug, ctx.cfg.arquivos.mapa);
    const mapa = existsSync(arq) ? lerMapa(arq) : null;
    for (const t of mapa?.telas || []) if (t?.id) ids.add(`${slug}-${t.id}`);
  }
  telasPorCtx.set(ctx, ids);
  return ids;
}

export function gateNavega(ctx, f) {
  const arq = join(f.dir, ctx.cfg.arquivos.mapa);
  if (!existsSync(arq)) return;
  const mapa = lerMapa(arq); // an invalid file is already a G9 error
  if (!mapa) return;
  const { E, A } = f;
  for (const t of mapa.telas || []) {
    const itens = Array.isArray(t?.navega) ? t.navega : [];
    if (!itens.length) continue;
    const campos = new Set((t.campos || []).map((c) => c?.id));
    itens.forEach((item, i) => {
      const onde = `mapa (${t.id}) navega[${i}]`;
      const l = { ...item, tipo: item?.tipo ?? 'navegacao' };
      if (!TIPOS.includes(l.tipo)) E('G9', `${onde}: tipo "${l.tipo}" inválido (use ${TIPOS.join(' ou ')})`);
      if (!l?.para) E('G9', `${onde}: sem \`para\``);
      else if (!todasAsTelas(ctx).has(l.para)) E('G9', `${onde}: para "${l.para}" não é tela de nenhum ${ctx.cfg.arquivos.mapa} (use <slug>-<tela>)`);
      if (!String(l?.como ?? '').trim()) E('G9', `${onde}: sem \`como\``);
      if (l?.campo && !campos.has(l.campo)) A('G9', `${onde}: campo "${l.campo}" não existe na tela ${t.id}`);
      if (l?.tipo === 'navegacao' && l.via) A('G9', `${onde}: \`via\` só vale em chamada`);
      if (l?.tipo === 'chamada' && !VIAS.includes(l.via)) A('G9', `${onde}: chamada sem \`via\` (${VIAS.join(' ou ')})`);
    });
  }
}
