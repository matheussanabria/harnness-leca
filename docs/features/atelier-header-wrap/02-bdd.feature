# language: pt
# Historia: correcao achada na EP-24.03 (cabecalho do Atelier transborda com o chat aberto)
# Convencao: cada cenario @auto tem o identificador CP-nn no titulo de um teste em tests/*.test.js.
Funcionalidade: Cabecalho do Atelier em coluna estreita

  @auto
  Cenario: CP-01 Botoes visiveis com o chat aberto
    Dado a coluna do preview com 592 px (janela de 1500 px e chat aberto)
    Quando o Atelier mostra o cabecalho
    Entao Canvas, Iniciar, Motion, Exportar e Recarregar ficam visiveis, quebrando para outra linha

  @auto
  Cenario: CP-02 Coluna larga continua em uma linha
    Dado a coluna do preview com 1280 px
    Quando o Atelier mostra o cabecalho
    Entao todos os botoes ficam numa unica linha
