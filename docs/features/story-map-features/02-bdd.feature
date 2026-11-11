# language: pt
# Historia: US-1794413189807-28200 (Funcionalidades no mapa dentro da historia mae)
# Convencao: cada cenario @auto tem o identificador CP-nn no titulo de um teste em tests/*.test.js.
Funcionalidade: Ligar a historia as funcionalidades e telas do Mapa em Camadas

  @auto
  Cenario: CP-01 Historia lista as funcionalidades de que e dona
    Dado que uma funcionalidade tem a historia DIS-443 como principal no _status.md
    Quando consulto as funcionalidades da historia DIS-443
    Entao a funcionalidade aparece em "dona"

  @auto
  Cenario: CP-02 Historia secundaria ou guarda-chuva aparece como relacionada
    Dado que uma funcionalidade tem a historia DIS-443 como guarda-chuva
    Quando consulto as funcionalidades da historia DIS-443
    Entao a funcionalidade aparece em "relacionada" com o papel informado

  @auto
  Cenario: CP-03 Funcionalidade informa as outras historias que a tocam
    Dado que uma funcionalidade tem as historias DIS-443 e DIS-454
    Quando consulto a historia DIS-443
    Entao a funcionalidade traz DIS-454 em "outras"

  @auto
  Cenario: CP-04 Funcionalidade com tela no mapa traz o id da tela
    Dado que a funcionalidade tem mapa-camadas.json com uma tela
    Quando consulto a historia dona
    Entao a funcionalidade traz o id da tela no mapa

  @auto
  Cenario: CP-05 Funcionalidade sem mapa nao traz telas
    Dado que a funcionalidade nao tem mapa-camadas.json
    Quando consulto a historia dona
    Entao a lista de telas da funcionalidade e vazia

  @auto
  Cenario: CP-06 Mapa em Camadas inclui as telas das funcionalidades
    Dado que o repositorio tem um canvas com telas e funcionalidades com mapa-camadas.json
    Quando monto a lista de telas do projeto
    Entao as telas das funcionalidades sao acrescentadas depois das do canvas

  @auto
  Cenario: CP-07 Tela da funcionalidade com a mesma rota do canvas nao duplica
    Dado que uma tela da funcionalidade tem a mesma rota de uma tela do canvas
    Quando monto a lista de telas do projeto
    Entao a tela aparece uma vez e o Ver no mapa aponta para a do canvas

  @auto
  Cenario: CP-08 Historia sem funcionalidades responde vazio
    Dado que nenhuma funcionalidade cita a historia DIS-999
    Quando consulto a historia DIS-999
    Entao as listas dona e relacionada vem vazias

  @manual
  Cenario: CP-09 Ver no mapa abre a tela no Mapa em Camadas
    Dado que o painel da historia DIS-443 esta aberto no Scrum
    Quando clico em Ver no mapa de Entregas liberadas
    Entao o Mapa em Camadas abre na tela Entregas liberadas
