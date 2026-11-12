# language: pt
# Historia: botao para gerar o pacote de revisao a partir da aba Scrum
# Convencao: cada cenario @auto tem o identificador CP-nn no titulo de um teste em tests/*.test.js.
Funcionalidade: Gerar o pacote de revisao com um clique

  @auto
  Cenario: CP-01 Projeto sem configuracao de pacote nao mostra o botao
    Dado um projeto sem pacote-revisao.json
    Quando a aba Scrum consulta o estado do pacote
    Entao o servidor responde configured false

  @auto
  Cenario: CP-02 Estado do pacote diz quando foi gerado e o que ficou defasado
    Dado um pacote gerado e depois uma fonte alterada
    Quando a aba Scrum consulta o estado do pacote
    Entao a resposta traz a data da geracao e o grupo de fonte defasado

  @auto
  Cenario: CP-03 Pacote nunca gerado aparece como pendente
    Dado uma configuracao valida e uma pasta de saida vazia
    Quando o estado do pacote e calculado
    Entao geradoEm e nulo e nenhum grupo e apontado

  @auto
  Cenario: CP-04 Geracao simultanea e recusada
    Dado uma geracao em andamento
    Quando outra geracao e pedida
    Entao o servidor responde 409

  @auto
  Cenario: CP-05 Falha da ferramenta chega como erro legivel
    Dado uma ferramenta que termina com erro
    Quando a geracao e pedida
    Entao o servidor responde 500 com a ultima linha do erro

  @auto
  Cenario: CP-06 Texto do botao e dos avisos reflete o estado
    Dado os estados nunca gerado, em dia, defasado e com erro
    Quando o texto de ajuda e montado
    Entao cada estado tem uma mensagem propria e a de conclusao cita historias, telas e zip

  @manual
  Cenario: CP-07 Clique no botao gera quadro, mapa e zip
    Dado o Harness aberto no projeto saude-dispensacao na aba Scrum
    Quando clico em "Gerar pacote de revisão"
    Entao aparece o aviso com a pasta e o zip e o ponto de defasado some
