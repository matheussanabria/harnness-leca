// g13/confere: compares what the rendered screen shows with what the oracle expects and with the prototype.
// Pure functions. A finding is { nivel: 'erro' | 'aviso' | 'info', tema: 'cadastro' | 'formulario' | 'geometria', m }.
const lim = (s) => String(s ?? '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();

// Registry cells: strict text comparison (accents and case count).
export function conferirCadastro(esperado, observado) {
  const achados = [];
  const porRotulo = new Map(observado.map((c) => [lim(c.rotulo), lim(c.valor)]));
  for (const [rotulo, valor] of Object.entries(esperado)) {
    if (!porRotulo.has(rotulo)) { achados.push({ nivel: 'erro', tema: 'cadastro', m: `"${rotulo}" não aparece na tela (cadastro espera "${valor}")` }); continue; }
    if (porRotulo.get(rotulo) !== valor) achados.push({ nivel: 'erro', tema: 'cadastro', m: `"${rotulo}": a tela mostra "${porRotulo.get(rotulo)}", o cadastro dá "${valor}"` });
  }
  return achados;
}

// Dynamic fields: the labels that must exist, the ones that must not, and the notices.
export function conferirFormulario(esperado, observado) {
  const achados = [];
  const rotulos = new Set(observado.rotulos.map(lim));
  for (const r of esperado.presentes) if (!rotulos.has(r)) achados.push({ nivel: 'erro', tema: 'formulario', m: `deveria mostrar o campo "${r}" para este medicamento e não mostra` });
  for (const r of esperado.ausentes) if (rotulos.has(r)) achados.push({ nivel: 'erro', tema: 'formulario', m: `mostra o campo "${r}", que não se aplica a este medicamento` });
  const textos = observado.avisos.map((a) => lim(a).toLowerCase());
  for (const a of esperado.avisos) if (!textos.some((t) => t.includes(a.toLowerCase()))) achados.push({ nivel: 'erro', tema: 'formulario', m: `deveria exibir o aviso "${a}" e não exibe` });
  if (esperado.calculaPrevia && !observado.temPrevia) achados.push({ nivel: 'aviso', tema: 'formulario', m: 'a prévia de cálculo não apareceu (resultado e "Entrega atual" ausentes)' });
  if (!esperado.calculaPrevia && observado.temPrevia) achados.push({ nivel: 'erro', tema: 'formulario', m: 'a prévia apareceu, mas o medicamento não tem intervalo entre retiradas cadastrado' });
  return achados;
}

// Geometry against the prototype, one viewport. `itens` = [{ id, quando? }]; an item is skipped when the oracle says it
// does not apply to this medicamento. Height tolerance in px; width tolerance as a ratio of the prototype width.
export function conferirGeometria(proto, codigo, { tolLargura = 0.12, tolAltura = 4, ignorar = [] } = {}) {
  const achados = [];
  for (const a of proto) {
    if (ignorar.includes(a.id)) continue;
    const b = codigo.find((x) => x.id === a.id);
    if (!a.achou) continue;
    if (!b || !b.achou) { achados.push({ nivel: 'erro', tema: 'geometria', m: `${a.id}: existe no protótipo e não foi achado na tela` }); continue; }
    const dif = [];
    if (a.visivel !== b.visivel) dif.push(`visível ${a.visivel ? 'sim' : 'não'} x ${b.visivel ? 'sim' : 'não'}`);
    if (Math.abs(a.largura - b.largura) > Math.max(8, a.largura * tolLargura)) dif.push(`largura ${a.largura} x ${b.largura} px`);
    if (Math.abs(a.altura - b.altura) > tolAltura) dif.push(`altura ${a.altura} x ${b.altura} px`);
    if (a.rotulo && b.rotulo && lim(a.rotulo) !== lim(b.rotulo)) dif.push(`rótulo "${a.rotulo}" x "${b.rotulo}"`);
    if (dif.length) achados.push({ nivel: 'aviso', tema: 'geometria', m: `${a.id}: ${dif.join('; ')} (protótipo x tela)` });
  }
  return achados;
}
