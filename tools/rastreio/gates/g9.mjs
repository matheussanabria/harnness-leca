// rastreio/gates/g9: mapa-camadas.json <-> rastreio. The link is the `rn: ["RN-..."]` field of each item in
// `telas[].regras`. ERROR when the map cites a rule that does not exist. Warnings: no map; map rule without `rn`;
// rule absent from the map; test status in the map that contradicts the proof recorded in the rastreio.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { BOM, lerTexto } from '../util.mjs';

// `sem_mapa: { motivo, em: [slug] }`: the feature has no screen of its own; its rules appear in another map.
// Each slug in `em` needs a map that cites at least one rule of this feature, otherwise the warning returns.
function semMapa(ctx, f) {
  const { slug, d, regras, A } = f;
  const { features } = ctx.cfg.docs;
  const sm = d.sem_mapa;
  if (!sm?.motivo) {
    if (Object.keys(regras).length) A('G9', `sem ${ctx.cfg.arquivos.mapa} (gere o mapa ou declare \`sem_mapa: { motivo, em: [slug] }\` no ${ctx.cfg.arquivos.rastreio})`);
    return;
  }
  for (const outro of sm.em || []) {
    const arq = join(features, outro, ctx.cfg.arquivos.mapa);
    const cita = existsSync(arq) && new RegExp(`${ctx.cfg.ids.regra}-${slug}-\\d{3}`).test(lerTexto(arq));
    if (!cita) A('G9', `sem_mapa aponta para ${outro}, mas o mapa dele não cita nenhuma ${ctx.cfg.ids.regra}-${slug}-nnn`);
  }
}

function comMapa(ctx, f, mapa) {
  const { slug, regras, citadas, E, A } = f;
  const rn = ctx.cfg.ids.regra;
  const rnDoTitulo = new Map(), noMapa = new Set();
  let semRn = 0;
  for (const t of mapa.telas || []) for (const r of t.regras || []) {
    const rns = r.rn || [];
    // gaps (not implemented, prototype only, to confirm, mock) do not describe a rule in force: they need no RN.
    // `sem_rn: "reason"` declares the item a fact (architecture, integration), not a business rule.
    if (!rns.length) { if (['implementado', 'diverge'].includes(r.st) && !r.sem_rn) semRn++; continue; }
    // `rn` may point to a rule of ANOTHER feature (the screen orchestrates rules that live in another module)
    for (const x of rns) {
      if (regras[x]) noMapa.add(x);
      else if (![...ctx.rnPorSlug.values()].some((s) => s.has(x))) E('G9', `mapa (${t.id}) cita ${x} em "${r.titulo}", que não existe em nenhum \`regras:\``);
    }
    rnDoTitulo.set(`${t.id}|${r.titulo}`, rns);
  }
  if (semRn) A('G9', `${semRn} regra(s) do mapa sem \`rn\` (o mapa ainda não está ligado ao rastreio nesses itens)`);
  const sobra = Object.keys(regras).filter((r) => !noMapa.has(r));
  if (sobra.length && sobra.length < Object.keys(regras).length) A('G9', `${sobra.length} RN sem regra no mapa: ${sobra.map((r) => r.replace(`${rn}-${slug}-`, '')).join(', ')}`);
  const tira = new RegExp(`${rn}-${slug}-`, 'g');
  for (const t of mapa.telas || []) for (const g of t.testes?.grupos || []) {
    const rns = (g.regras || []).flatMap((titulo) => rnDoTitulo.get(`${t.id}|${titulo}`) || []);
    if (!rns.length) continue;
    const comProva = rns.filter((r) => citadas.get(r));
    // only `sem-teste` contradicts the proof; `so-bdd` is compatible with a partly proven RN (the group's scenario may be the gap)
    if (g.st === 'sem-teste' && comProva.length) A('G9', `mapa (${t.id}) grupo "${g.endpoint}" está como ${g.st}, mas o rastreio tem prova para ${comProva.join(', ').replace(tira, '')}`);
    if (['teste-unitario', 'automatizado'].includes(g.st) && !comProva.length) A('G9', `mapa (${t.id}) grupo "${g.endpoint}" está como ${g.st}, mas nenhuma de suas RN tem prova no rastreio`);
  }
}

export function gateG9(ctx, f) {
  const arq = join(f.dir, ctx.cfg.arquivos.mapa);
  if (!existsSync(arq)) return semMapa(ctx, f);
  let mapa = null;
  try { mapa = JSON.parse(lerTexto(arq).replace(BOM, '')); } catch (e) { f.E('G9', `${ctx.cfg.arquivos.mapa} inválido: ${e.message.split('\n')[0]}`); }
  if (mapa) comMapa(ctx, f, mapa);
}
