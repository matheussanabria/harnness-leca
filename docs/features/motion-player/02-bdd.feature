# language: pt
# Historia: EP-24.03 (Player no Atelier: transporte, scrub e modo Motion)
# Convencao: cada cenario @auto tem o identificador CP-nn no titulo de um teste em tests/*.test.js.
Funcionalidade: Player de motion no Atelier

  @auto
  Cenario: CP-08 Botao aparece so com timeline
    Dado uma tela sem timeline
    Entao o botao Motion nao aparece
    Quando a tela ganha uma timeline
    Entao o botao Motion aparece

  @auto
  Cenario: CP-09 Avancar um quadro
    Dado uma timeline a 30 fps parada em 0 ms
    Quando pressiono seta para a direita
    Entao o player envia SEEK com 33 ms, arredondado ao quadro

  @auto
  Cenario: CP-10 Recarregar timeline mantem o tempo
    Dado o player parado em 1500 ms numa timeline de 4000 ms
    Quando o chat aplica uma timeline de 3000 ms
    Entao o player continua em 1500 ms
    Mas se a nova duracao for 1000 ms, o player vai para 1000 ms

  @manual
  Cenario: CP-11 Tocar e arrastar no navegador
    Dado uma tela com animacao de entrada
    Quando clico em play e depois arrasto o scrub
    Entao a animacao toca e o quadro acompanha o cursor sem atraso perceptivel
