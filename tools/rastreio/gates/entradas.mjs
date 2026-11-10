// rastreio/gates/entradas: per-entry checks. G1 entry without proof, G3 broken links (cobertos_por, cited rule),
// G4 test/request that does not exist. Returns `citadas` (rule -> number of entries WITH proof that cite it).
import { existeTeste } from '../adapters/junit.mjs';
import { existeKarma } from '../adapters/karma.mjs';

export function gateEntradas(ctx, f) {
  const { entradas, regras, E } = f;
  const citadas = new Map();
  for (const [id, e] of entradas) {
    const junit = e.junit || [], it = e.it || [], pm = e.postman || [], cob = e.cobertos_por || [], lac = e.lacunas || [], kar = e.karma || [];
    const temProva = junit.length || it.length || pm.length || cob.length || kar.length;
    if (!temProva && !lac.length) E('G1', `${id}: sem prova (junit, it, karma, postman ou cobertos_por) e sem lacuna declarada`);
    for (const k of kar) { const r = existeKarma(ctx.specs, k); if (r) E('G4', `${id}: karma: ${r}`); }
    for (const c of cob) {
      const m = String(c).match(/^([a-z0-9-]+)\/([A-Za-z0-9-]+)$/);   // reference to another feature
      if (!m) continue;
      const ids = ctx.idsDe(m[1]);
      if (!ids) E('G3', `${id}: cobertos_por cita ${c}, mas ${m[1]} não tem ${ctx.cfg.arquivos.rastreio}`);
      else if (!ids.has(m[2])) E('G3', `${id}: cobertos_por cita ${c}, que não existe em ${m[1]}/${ctx.cfg.arquivos.rastreio}`);
    }
    for (const l of lac) if (!l?.motivo) E('G1', `${id}: lacuna sem motivo`);
    for (const t of [...junit, ...it]) { const r = existeTeste(ctx.junit, t); if (r) E('G4', `${id}: teste ${r === 'inexistente' ? 'inexistente' : r}: ${t}`); }
    for (const p of pm) if (!ctx.requests.has(p)) E('G4', `${id}: request do Postman inexistente: ${String(p).slice(0, 90)}`);
    for (const r of e.regras || []) {
      if (!regras[r]) E('G3', `${id}: cita ${r}, que não está definida em \`regras:\``);
      else if (temProva) citadas.set(r, (citadas.get(r) || 0) + 1);
    }
  }
  return citadas;
}
