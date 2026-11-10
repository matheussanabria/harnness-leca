// rastreio/gates/g6: (warning) tests inside the feature's `fontes_api` globs that no entry links to.
// Applies to every stack whose adapter lists tests (junit, pytest). Returns the number of orphan tests for the summary.
import { casa } from '../util.mjs';

export function gateG6(ctx, f, h) {
  let total = 0;
  for (const s of ctx.stacks) {
    if (!s.idx.testes) continue;
    const ref = new Set(), refPref = [];
    for (const [, e] of f.entradas) {
      for (const campo of s.adapter.campos) {
        for (const t of e[campo] || []) {
          const n = t.includes('#') ? t.split('#')[1] : t;
          if (n.endsWith('_*')) refPref.push(n.slice(0, -2)); else ref.add(n);
        }
      }
    }
    const globs = h?.[s.cfg.fontes] || [];
    const orfaos = globs.length
      ? s.idx.testes.filter((t) => casa(globs, s.cfg.raizes, t.arquivo) && !ref.has(t.nome) && !refPref.some((p) => t.nome.startsWith(p)))
      : [];
    if (orfaos.length) {
      const lista = orfaos.slice(0, 5).map((t) => `${t.classe}#${t.nome}`).join(', ') + (orfaos.length > 5 ? ' …' : '');
      f.A('G6', `${orfaos.length} teste(s) da funcionalidade sem elo no YAML: ${lista}`);
    }
    total += orfaos.length;
  }
  return total;
}
