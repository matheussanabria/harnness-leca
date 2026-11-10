// rastreio/adapters: registry of stack adapters. An adapter exports { campos, obrigatorios, normaliza, indexa, existe, formata }
// and, when it can list tests (for G6), indexa() also returns `testes`. To support a new stack, add a file here and register it.
import * as junit from './junit.mjs';
import * as karma from './karma.mjs';
import * as pytest from './pytest.mjs';
import { join } from 'node:path';

export const ADAPTERS = { junit, karma, pytest };

// [{ cfg, adapter, idx }] in the order of config.stacks
export const criaStacks = (cfg) => cfg.stacks.map((s) => ({ cfg: s, adapter: ADAPTERS[s.tipo], idx: ADAPTERS[s.tipo].indexa(s) }));

// A code reference "web:foo.ts" belongs to the stack with that prefix; one without prefix goes to the first stack that has none.
export function resolveCodigo(cfg, ref) {
  const comPrefixo = cfg.stacks.find((s) => s.prefixo && ref.startsWith(s.prefixo));
  if (comPrefixo) return join(comPrefixo.raizCodigo, ref.slice(comPrefixo.prefixo.length));
  const padrao = cfg.stacks.find((s) => !s.prefixo);
  return join((padrao || cfg.stacks[0]).raizCodigo, ref);
}
