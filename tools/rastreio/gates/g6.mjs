// rastreio/gates/g6: (warning) tests inside the feature's `fontes_api` globs that no entry links to.
// Returns the number of orphan tests for the summary.
import { casa } from '../util.mjs';

export function gateG6(ctx, f, h) {
  const ref = new Set(), refPref = [];
  for (const [, e] of f.entradas) {
    for (const t of [...(e.junit || []), ...(e.it || [])]) {
      const n = t.includes('#') ? t.split('#')[1] : t;
      if (n.endsWith('_*')) refPref.push(n.slice(0, -2)); else ref.add(n);
    }
  }
  const globs = h?.fontes_api || [];
  const raizes = ctx.cfg.stacks.junit.raizes;
  const orfaos = globs.length
    ? ctx.junit.testesPorArquivo.filter((t) => casa(globs, raizes, t.arquivo) && !ref.has(t.nome) && !refPref.some((p) => t.nome.startsWith(p)))
    : [];
  if (orfaos.length) {
    const lista = orfaos.slice(0, 5).map((t) => `${t.classe}#${t.nome}`).join(', ') + (orfaos.length > 5 ? ' …' : '');
    f.A('G6', `${orfaos.length} teste(s) da funcionalidade sem elo no YAML: ${lista}`);
  }
  return orfaos.length;
}
