// rastreio/gates/g7: reused id. (a) an id listed in `descontinuados:` is used again; (b) a rule whose prefix
// belongs to another feature; (c) the same rule defined in two features.
export function gateG7(ctx, f) {
  const { slug, d, entradas, regras, E } = f;
  const rn = ctx.cfg.ids.regra;
  const descont = new Set(d.descontinuados || []);
  for (const [id] of entradas) if (descont.has(id)) E('G7', `${id}: está em \`descontinuados\` e voltou a ser usado como entrada`);
  for (const r of Object.keys(regras)) {
    if (descont.has(r)) E('G7', `${r}: está em \`descontinuados\` e voltou a ser definido em \`regras:\``);
    const pref = r.replace(new RegExp(`^${rn}-`), '').replace(/-\d{3}$/, '');
    if (pref !== slug) E('G7', `${r}: o prefixo deveria ser ${rn}-${slug}-nnn`);
    for (const [outro, ids] of ctx.rnPorSlug) if (outro !== slug && ids.has(r)) E('G7', `${r}: também está definida em ${outro}/${ctx.cfg.arquivos.rastreio}`);
  }
}
