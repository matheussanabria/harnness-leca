// rastreio/gates/regras: rules checked against code, proof and regras.md. G2 rule without code/proof,
// G3 YAML <-> regras.md mismatch, G4 code file that does not exist, G2 warning for obsolete `sem_prova`.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { lerSeExiste } from '../util.mjs';

export function gateRegras(ctx, f) {
  const { cfg } = ctx;
  const { regras, citadas, E, A } = f;
  const md = lerSeExiste(join(f.dir, cfg.arquivos.regras));
  if (md === null && Object.keys(regras).length) E('G3', `há \`regras:\` no YAML, mas falta o ${cfg.arquivos.regras}`);
  const reId = new RegExp(`\\|\\s*(${cfg.ids.regra}-[a-z0-9-]+-\\d{3})\\s*\\|`, 'g');
  const idsMd = new Set(md ? [...md.matchAll(reId)].map((m) => m[1]) : []);
  const { karma, junit } = cfg.stacks;
  for (const [r, v] of Object.entries(regras)) {
    const cod = v?.codigo || [];
    if (!cod.length) E('G2', `${r}: sem \`codigo\``);
    for (const c of cod) {
      const arq = c.startsWith(karma.prefixo) ? join(karma.raiz, c.slice(karma.prefixo.length)) : join(junit.main, c);
      if (!existsSync(arq)) E('G4', `${r}: arquivo de código inexistente: ${c}`);
    }
    if (!citadas.get(r) && !v?.sem_prova) E('G2', `${r}: nenhuma entrada com prova a cita e não há \`sem_prova\` com motivo`);
    if (citadas.get(r) && v?.sem_prova) A('G2', `${r}: \`sem_prova\` está obsoleto (há ${citadas.get(r)} entrada(s) com prova)`);
    if (md !== null && !idsMd.has(r)) E('G3', `${r}: está no YAML, mas não tem linha em ${cfg.arquivos.regras}`);
  }
  for (const r of idsMd) if (!regras[r]) E('G3', `${r}: está em ${cfg.arquivos.regras}, mas não em \`regras:\` do YAML`);
}
