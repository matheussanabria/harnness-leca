// rastreio/gates/entradas: per-entry checks. G1 entry without proof, G3 broken links (cobertos_por, cited rule),
// G4 test/request that does not exist. Returns `citadas` (rule -> number of entries WITH proof that cite it).
// Test references are checked by whichever stack adapter owns the field (junit, it, karma, pytest, ...).
export function gateEntradas(ctx, f) {
  const { entradas, regras, E } = f;
  const citadas = new Map();
  for (const [id, e] of entradas) {
    const pm = e.postman || [], cob = e.cobertos_por || [], lac = e.lacunas || [];
    const temProva = ctx.stacks.some((s) => s.adapter.campos.some((c) => (e[c] || []).length)) || pm.length || cob.length;
    if (!temProva && !lac.length) {
      const campos = [...new Set(ctx.stacks.flatMap((s) => s.adapter.campos))];
      E('G1', `${id}: sem prova (${campos.join(', ')}, postman ou cobertos_por) e sem lacuna declarada`);
    }
    for (const s of ctx.stacks) {
      for (const campo of s.adapter.campos) {
        for (const ref of e[campo] || []) { const r = s.adapter.existe(s.idx, ref); if (r) E('G4', s.adapter.formata(id, ref, r)); }
      }
    }
    for (const c of cob) {
      const m = String(c).match(/^([a-z0-9-]+)\/([A-Za-z0-9-]+)$/);   // reference to another feature
      if (!m) continue;
      const ids = ctx.idsDe(m[1]);
      if (!ids) E('G3', `${id}: cobertos_por cita ${c}, mas ${m[1]} não tem ${ctx.cfg.arquivos.rastreio}`);
      else if (!ids.has(m[2])) E('G3', `${id}: cobertos_por cita ${c}, que não existe em ${m[1]}/${ctx.cfg.arquivos.rastreio}`);
    }
    for (const l of lac) if (!l?.motivo) E('G1', `${id}: lacuna sem motivo`);
    for (const p of pm) if (!ctx.requests.has(p)) E('G4', `${id}: request do Postman inexistente: ${String(p).slice(0, 90)}`);
    for (const r of e.regras || []) {
      if (!regras[r]) E('G3', `${id}: cita ${r}, que não está definida em \`regras:\``);
      else if (temProva) citadas.set(r, (citadas.get(r) || 0) + 1);
    }
  }
  return citadas;
}
