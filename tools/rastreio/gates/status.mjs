// rastreio/gates/status: checks on the feature's _status.md. G8 (warning) numbers in the "Rastreabilidade (piloto)"
// line that differ from the measurement; G5 placeholder id left in the header.
import { join } from 'node:path';
import { cabecalho, lerSeExiste } from '../util.mjs';

export function gateG8(ctx, f) {
  const stTxt = lerSeExiste(join(f.dir, ctx.cfg.arquivos.status)) || '';
  const linha = stTxt.split(/\r?\n/).find((l) => /Rastreabilidade \(piloto\)/.test(l));
  if (!linha) return;
  const nReg = Object.keys(f.regras).length, nEnt = f.entradas.length;
  const mReg = linha.match(/\((\d+) (?:regras|contratos)[^)]*\)/), mEnt = linha.match(/(\d+) entradas/);
  if (mReg && Number(mReg[1]) !== nReg) f.A('G8', `${ctx.cfg.arquivos.status} diz ${mReg[1]} regras, o YAML tem ${nReg}`);
  if (mEnt && Number(mEnt[1]) !== nEnt) f.A('G8', `${ctx.cfg.arquivos.status} diz ${mEnt[1]} entradas, o YAML tem ${nEnt}`);
}

// Returns the parsed header (also used by G6) or null.
export function lerCabecalho(ctx, dir) {
  const txt = lerSeExiste(join(dir, ctx.cfg.arquivos.status));
  return txt === null ? null : cabecalho(txt);
}

export function gateG5(ctx, f, h) {
  const { placeholder } = ctx.cfg.ids;
  const re = new RegExp(`${placeholder}[A-Z]+`);
  for (const campo of ['historias', 'prefixo']) {
    const v = [].concat(h?.[campo] || []).join(' ');
    if (v.includes(placeholder)) f.E('G5', `${ctx.cfg.arquivos.status}: \`${campo}\` ainda usa o placeholder ${v.match(re)[0]} (ver _historias.md)`);
  }
}
