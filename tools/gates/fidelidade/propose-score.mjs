// fidelidade/propose-score: scores a drafted pairing against a pairing a person already wrote for the same screen.
// A pair counts as right when the prototype selector maps to the same code key.
const chaveDe = (codigo) => (typeof codigo === 'object' ? codigo.chave : codigo);

export function comparaComExistente(propostos, existentes) {
  const porProto = new Map(propostos.map((c) => [c.proto, chaveDe(c.codigo)]));
  const apelidos = new Map(propostos.map((c) => [c.proto, c.chaves || [chaveDe(c.codigo)]]));
  const existentesPorProto = new Map(existentes.map((c) => [c.proto, chaveDe(c.codigo)]));
  const trocados = [];
  const perdidos = [];
  let acertos = 0;
  for (const [proto, codigo] of existentesPorProto) {
    if (!porProto.has(proto)) { perdidos.push(`${proto} (existente: ${codigo})`); continue; }
    if (apelidos.get(proto).includes(codigo)) acertos++;
    else trocados.push(`${proto}: proposto ${porProto.get(proto)}, existente ${codigo}`);
  }
  const extras = [...porProto.keys()].filter((p) => !existentesPorProto.has(p));
  const total = existentesPorProto.size;
  return { acertos, total, pct: total ? Math.round((acertos / total) * 100) : 0, trocados, perdidos, extras };
}
