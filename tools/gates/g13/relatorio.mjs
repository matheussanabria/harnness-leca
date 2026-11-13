// g13/relatorio: the text a person reads at the end of a run.
const ROTULO = { cadastro: 'Cadastro (tela x API)', formulario: 'Campos dinâmicos deste medicamento', geometria: 'Exibição (protótipo x tela)' };

export function relatorio(r, arquivo) {
  const L = [];
  const m = r.medicamento;
  L.push(`[g13] ${r.titulo || 'Verificação da tela'}`);
  L.push(`[g13] Medicamento testado: ${m.codigo} - ${m.nome}`);
  L.push('');
  L.push('Cadastro (valor esperado pela API -> o que a tela mostra):');
  const obs = new Map(r.observado.tela.cadastro.map((c) => [c.rotulo, c.valor]));
  for (const [rotulo, valor] of Object.entries(r.esperado.cadastro)) L.push(`  ${rotulo.padEnd(26)} esperado "${valor}" | tela "${obs.get(rotulo) ?? '(ausente)'}"`);
  const f = r.esperado.formulario;
  L.push('');
  L.push(`Campos deste medicamento: embalagem ${f.exigeEmbalagem ? 'sim' : 'não'}, posologia ${f.exigePosologia ? 'sim' : 'não'}, modo sem cálculo ${f.semCalculo ? 'sim' : 'não'}, longa permanência ${f.longa ? 'sim' : 'não'}, prévia ${f.calculaPrevia ? 'sim' : 'não'}`);
  L.push(`  rótulos esperados: ${f.presentes.join(' | ') || '(nenhum)'}`);
  L.push(`  rótulos na tela:   ${r.observado.tela.rotulos.join(' | ') || '(nenhum)'}`);
  for (const tema of Object.keys(ROTULO)) {
    const achados = r.achados.filter((a) => a.tema === tema);
    L.push('');
    L.push(`${ROTULO[tema]}: ${achados.length ? achados.length + ' achado(s)' : 'sem achados'}`);
    for (const a of achados) L.push(`  ${a.nivel === 'erro' ? 'ERRO ' : 'aviso'} ${a.m}`);
  }
  const erros = r.achados.filter((a) => a.nivel === 'erro').length;
  L.push('');
  L.push(`[g13] ${erros ? 'REPROVADO' : 'APROVADO'}: ${erros} erro(s), ${r.achados.length - erros} aviso(s). Resultado completo em ${arquivo}`);
  return L.join('\n');
}
