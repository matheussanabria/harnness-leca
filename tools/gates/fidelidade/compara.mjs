// fidelidade/compara: G10 core. Compares one prototype item with one code item and decides each difference
// against the project's declared differences. Pure functions, no file access.
const ATRIBUTOS = ['rotulo', 'placeholder', 'obrigatorio', 'desabilitado', 'icone', 'largura', 'acao'];

const chaveAcao = (a) => (a ? `${a.rotulo ?? ''} | ${a.icone ?? 'sem ícone'}` : null);
const valor = (v, atributo) => (atributo === 'acao' ? chaveAcao(v) : v);

export function mostra(v) {
  if (v === undefined) return 'dinâmico';
  if (v === null) return 'nenhum';
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  return typeof v === 'number' ? `${v} px` : `"${v}"`;
}

// Differences between two items, as [{ atributo, proto, codigo, indeterminado }].
export function diferencas(proto, codigo) {
  const out = [];
  for (const atributo of ATRIBUTOS) {
    if (!(atributo in proto) && !(atributo in codigo)) continue;
    const p = valor(proto[atributo] ?? null, atributo);
    const c = atributo in codigo ? valor(codigo[atributo], atributo) : null;
    if (c === undefined) { out.push({ atributo, proto: p, codigo: undefined, indeterminado: true }); continue; }
    if (p === c) continue;
    // A field the prototype leaves without a fixed width and the code does too is equal; "false" equals "not set".
    if ((p === null || p === false) && (c === null || c === false)) continue;
    out.push({ atributo, proto: p, codigo: c, indeterminado: false });
  }
  return out;
}

// Decides one field. Returns [{ tipo, m }] with tipo in nao-declarada | declarada | defasada | nao-confere |
// indeterminada | presenca | pareamento.
export function decideCampo(campo, proto, codigo, declaradas) {
  const minhas = declaradas.filter((d) => d.campo === campo.id);
  if (!proto && !codigo) return [{ tipo: 'pareamento', m: `${campo.id}: não encontrado no protótipo (${campo.proto}) nem no código (${JSON.stringify(campo.codigo)})` }];
  if (!proto || !codigo) {
    const lado = proto ? 'so-prototipo' : 'so-codigo';
    const d = minhas.find((x) => x.atributo === 'presenca' && x.lado === lado);
    return [{ tipo: d ? 'declarada' : 'presenca', m: `${campo.id}: ${proto ? 'só no protótipo' : 'só no código'}${d ? ` (declarado: ${d.motivo || 'sem motivo'})` : ' (diferença não declarada)'}` }];
  }
  const out = [];
  const vistos = new Set();
  for (const dif of diferencas(proto, codigo)) {
    const d = minhas.find((x) => x.atributo === dif.atributo);
    const rotulo = `${campo.id}.${dif.atributo}`;
    if (d) vistos.add(d);
    if (dif.indeterminado) {
      out.push({ tipo: d ? 'declarada' : 'indeterminada', m: `${rotulo}: valor dinâmico no código; confira na tela` });
    } else if (!d) {
      out.push({ tipo: 'nao-declarada', m: `${rotulo}: protótipo ${mostra(dif.proto)}, código ${mostra(dif.codigo)} (diferença não declarada)` });
    } else if (d.codigoValor !== undefined && String(d.codigoValor) !== String(dif.codigo ?? '')) {
      out.push({ tipo: 'nao-confere', m: `${rotulo}: a declaração espera ${mostra(d.codigoValor)} no código, mas ele tem ${mostra(dif.codigo)}` });
    } else {
      out.push({ tipo: 'declarada', m: `${rotulo}: ${d.motivo || 'diferença declarada'}` });
    }
  }
  for (const d of minhas) {
    if (vistos.has(d) || d.atributo === 'presenca') continue;
    out.push({ tipo: 'defasada', m: `${campo.id}.${d.atributo}: declarada como diferença, mas o código já coincide com o protótipo (declaração defasada)` });
  }
  for (const d of minhas.filter((x) => x.atributo === 'presenca')) {
    out.push({ tipo: 'defasada', m: `${campo.id}: declarado como "${d.lado}", mas o campo existe nos dois lados (declaração defasada)` });
  }
  return out;
}
