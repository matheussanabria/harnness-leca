# language: pt
# Historia: US-1794414547521-42641 (Quadro da sprint: historias abertas de sprints anteriores e layout)
# Convencao: cada cenario @auto tem o identificador CP-nn no titulo de um teste em tests/*.test.js.
Funcionalidade: Historias abertas de sprints anteriores no quadro da sprint ativa

  @auto
  Cenario: CP-01 Historia aberta de sprint anterior aparece na sprint ativa
    Dado que a sprint ativa e a Sprint 43 e a DIS-443 esta aberta na Sprint 42 ainda ativa no Jira
    Quando o quadro mostra a sprint ativa
    Entao a DIS-443 aparece com o selo da Sprint 42

  @auto
  Cenario: CP-02 Historia concluida ou do backlog de outra sprint nao entra
    Dado que ha historias concluidas e do backlog em sprints anteriores
    Quando o quadro mostra a sprint ativa
    Entao essas historias nao aparecem

  @auto
  Cenario: CP-03 Sprint encerrada nao traz historias
    Dado que uma historia aberta pertence a uma sprint encerrada
    Quando o quadro mostra a sprint ativa
    Entao a historia nao aparece

  @auto
  Cenario: CP-04 Escolher uma sprint especifica mostra so ela
    Dado que o seletor esta em uma sprint especifica
    Quando o quadro e montado
    Entao so as historias dessa sprint aparecem, sem selo

  @auto
  Cenario: CP-05 Historia da propria sprint ativa nao ganha selo
    Dado que uma historia pertence a sprint ativa
    Quando o card e desenhado
    Entao nao ha selo de origem

  @manual
  Cenario: CP-06 Colunas sem rolagem horizontal propria e barras escuras
    Dado que o quadro tem raias com cards
    Quando abro o Kanban da sprint
    Entao nenhuma raia mostra barra horizontal propria e as barras seguem o tema escuro

  @auto
  Cenario: CP-07 Raia oculta com historias aparece no quadro marcada como oculta
    Dado que a raia Pronto para desenvolvimento esta oculta na configuracao e tem a DIS-443
    Quando o quadro da sprint e desenhado
    Entao a raia aparece com a DIS-443 e a marca Oculta

  @auto
  Cenario: CP-08 Raia oculta sem historias continua escondida
    Dado que uma raia oculta nao tem historias na sprint mostrada
    Quando o quadro da sprint e desenhado
    Entao a raia nao aparece
