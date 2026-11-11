# language: pt
# Historia: US-1794416611222-7738 (Vinculos historia-campo no painel e prototipo real nas telas do mapa)
# Convencao: cada cenario @auto tem o identificador CP-nn no titulo de um teste em tests/*.test.js.
Funcionalidade: Historia ligada a telas e campos e tela do mapa com o prototipo real

  @auto
  Cenario: CP-01 Historia dona de um vinculo com tela e campo
    Dado que o arquivo de vinculos tem a DIS-443 como principal de s2 e periodo
    Quando consulto a historia DIS-443
    Entao o vinculo aparece em "campos.dona" com tela s2 e campo periodo

  @auto
  Cenario: CP-02 Historia relacionada aparece como relacionada
    Dado que o vinculo cita a DIS-461 em relacionadas
    Quando consulto a historia DIS-461
    Entao o vinculo aparece em "campos.relacionada"

  @auto
  Cenario: CP-03 Vinculo sem tela fica sem mapa ainda
    Dado que o vinculo nao tem tela
    Quando consulto a historia dona
    Entao o vinculo vem sem screenId

  @auto
  Cenario: CP-04 Rotulos da tela e do campo vem do mapa
    Dado que a tela s2 tem o campo periodo com rotulo Periodo da posologia
    Quando consulto a historia
    Entao o vinculo traz o titulo da tela e o rotulo do campo

  @auto
  Cenario: CP-05 Sem o arquivo de vinculos o painel usa so as funcionalidades
    Dado que o repositorio nao tem o arquivo de vinculos
    Quando consulto a historia
    Entao campos vem vazio e as funcionalidades continuam

  @auto
  Cenario: CP-06 Painel mostra Ver no mapa com campo
    Dado que um vinculo tem screenId e fieldId
    Quando o painel e desenhado
    Entao o botao carrega a tela e o campo

  @auto
  Cenario: CP-07 Tela com protótipo ligado recebe o protótipo
    Dado que o arquivo de protótipos liga entregas-liberadas-s1 a entregas-liberadas
    Quando monto a lista de telas
    Entao a tela traz prototype com id e tela

  @auto
  Cenario: CP-08 Tela com protótipo mostra o protótipo e sem protótipo mostra a replica
    Dado uma tela com prototype e outra sem
    Quando a replica e desenhada
    Entao a primeira usa o iframe do protótipo e a segunda a replica atual

  @manual
  Cenario: CP-09 Ver no mapa da DIS-461 abre Medicamentos e calculo com o campo em foco
    Dado que o painel da DIS-461 esta aberto
    Quando clico em Ver no mapa de Periodo da posologia
    Entao o Mapa em Camadas abre na tela 2 com o campo Periodo da posologia em foco
