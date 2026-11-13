// g13/oraculo: what the DIS "etapa 2" screen must show for one medicamento, derived from the registry record
// (MedicamentoLookupDto, the answer of GET /api/medicamentos). Pure functions, no browser, no file access.
// It restates the display rules of the screen on purpose: if the screen and this file disagree, a person looks.

const maiuscula = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const pluralizar = (n, singular, plural) => (Math.abs(n) === 1 ? `${n} ${singular}` : `${n} ${plural}`);

// A record without unidadeMedida falls back to the bare unit: no packaging, no invented "comprimidos/blisteres".
export function unidadeDe(m) {
  if (m.unidadeMedida) return m.unidadeMedida;
  const sigla = m.unidade ?? '';
  return { sigla, singular: sigla, plural: sigla, embalagemSingular: '', embalagemPlural: '', unidadeCalculo: sigla, tipo: 'UNITARIO', calculaPorEmbalagem: false };
}

// Order matters: a controlled continuous-use drug is "Controlado".
export function classificacao(m) {
  if (m.controlado) return 'Controlado';
  if (m.antimicrobiano) return 'Antibiótico';
  if (m.usoContinuo) return 'Uso contínuo';
  if (m.longaPermanencia) return 'Longa permanência';
  return 'Comum';
}

export function rotuloPorEmbalagem(u) {
  const medida = u.unidadeCalculo || u.plural;
  const inicio = medida === medida.toLowerCase() ? maiuscula(medida) : medida;
  return `${inicio} por ${u.embalagemSingular}`;
}

// Registry cells of the info grid, as { rotulo: valor }. Estoque comes from another endpoint and is not asserted.
export function cadastroEsperado(m) {
  const u = unidadeDe(m);
  return {
    'Disp. máx. mensal': m.quantidadeMaximaDispensacao != null ? pluralizar(m.quantidadeMaximaDispensacao, u.singular, u.plural) : 'Não informada',
    'Validade máx.': m.validadeMaximaDias ? `${m.validadeMaximaDias} dias` : 'Não informada',
    'Modo de entrega': classificacao(m),
    'Intervalo entre retiradas': m.intervaloEntreRetiradasDias ? pluralizar(m.intervaloEntreRetiradasDias, 'dia', 'dias') : 'Não informado',
  };
}

// Which calculation fields appear and with which label, for the default period "dia".
export function formularioEsperado(m) {
  const u = unidadeDe(m);
  const longa = !!m.longaPermanencia;
  const semCalculo = !!m.modoSemCalculo;
  const exigeEmbalagem = !longa && !!u.calculaPorEmbalagem;
  const exigePosologia = !longa && !semCalculo;
  const plural = maiuscula(u.plural) || 'Comprimidos';
  const semIntervalo = !(Number(m.intervaloEntreRetiradasDias) > 0);
  const presentes = [];
  const ausentes = [];
  const marca = (rotulo, aparece) => (aparece ? presentes : ausentes).push(rotulo);
  marca(rotuloPorEmbalagem(u), exigeEmbalagem);
  marca(`${plural} por`, exigePosologia);
  marca(`${plural} por dia`, exigePosologia);
  marca('Unidades por dia (opcional)', !longa && semCalculo);
  marca('Quantidade prescrita (Mensal)', !longa && semCalculo);
  marca('Tratamento/validade', !longa);
  const avisos = [];
  if (semIntervalo) avisos.push('não tem intervalo entre retiradas cadastrado');
  if (longa) avisos.push('Medicamento de longa permanência');
  return { longa, semCalculo, exigeEmbalagem, exigePosologia, semIntervalo, presentes, ausentes, avisos, calculaPrevia: !semIntervalo };
}
