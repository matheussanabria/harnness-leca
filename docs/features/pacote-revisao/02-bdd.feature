# language: pt
# Historia: pacote de revisao autonomo (quadro de historias e mapa em camadas) com conferencia de defasagem
# Convencao: cada cenario @auto tem o identificador CP-nn no titulo de um teste em tests/*.test.js.
Funcionalidade: Pacote de revisao que nao fica defasado

  @auto
  Cenario: CP-01 Configuracao valida e carregada
    Dado uma configuracao com historias, colunas e ajustes com data e motivo
    Quando a ferramenta le a configuracao
    Entao as historias e as colunas ficam disponiveis

  @auto
  Cenario: CP-02 Ajuste manual sem data e motivo e recusado
    Dado um status forcado sem "motivo"
    Quando a ferramenta le a configuracao
    Entao ela recusa e diz qual ajuste esta incompleto

  @auto
  Cenario: CP-03 Correcao do mapa entra depois do item indicado
    Dado uma tela com tres diferencas e uma correcao "depoisDe" a primeira
    Quando a correcao e aplicada
    Entao a nova diferenca fica na segunda posicao e o texto do campo recebe o acrescimo

  @auto
  Cenario: CP-04 Correcao que a fonte ja tem e absorvida e nao duplica
    Dado uma tela cuja fonte ja tem a diferenca da correcao
    Quando a correcao e aplicada
    Entao a correcao e devolvida como absorvida e a lista de diferencas nao cresce

  @auto
  Cenario: CP-05 Correcao sem tela ou campo alvo e erro
    Dado uma correcao para um campo que nao existe
    Quando a conferencia roda
    Entao ela acusa erro CORRECAO_SEM_ALVO

  @auto
  Cenario: CP-06 Status informado que o snapshot ja alcancou e aviso
    Dado um status forcado igual ao status do snapshot
    Quando a conferencia roda
    Entao ela avisa STATUS_ABSORVIDO e pede para remover o ajuste

  @auto
  Cenario: CP-07 Trecho escondido e seletor de pino que sumiram do prototipo sao avisos
    Dado um prototipo sem o elemento que a configuracao esconde e sem o elemento de um pino
    Quando a conferencia roda
    Entao ela avisa ESCONDER_ORFAO e SELETOR_ORFAO

  @auto
  Cenario: CP-08 Seletor com atributo, pseudo-classe e alternativas e resolvido
    Dado um HTML com id, classes e data-component
    Quando o seletor e avaliado
    Entao ele acha o que existe e recusa o que nao existe

  @auto
  Cenario: CP-09 Pacote defasado e apontado por grupo de fonte
    Dado um pacote gerado e depois uma fonte alterada
    Quando a conferencia roda
    Entao ela avisa PACOTE_DEFASADO com o nome do grupo que mudou

  @auto
  Cenario: CP-10 Quadro escapa o fechamento de script e traz as colunas da configuracao
    Dado uma historia cujo titulo contem o fechamento de script
    Quando o quadro e montado
    Entao o HTML nao tem o fechamento solto e traz as colunas configuradas

  @auto
  Cenario: CP-11 Uso incorreto da ferramenta devolve mensagem
    Dado o comando sem o projeto
    Quando a ferramenta roda
    Entao ela sai com erro e explica que --project e obrigatorio

  @manual
  Cenario: CP-12 Build real gera quadro, mapa e zip que abrem sem o Harness
    Dado o projeto saude-dispensacao com a configuracao pronta
    Quando rodo "node tools/pacote-revisao.js build --project saude-dispensacao --zip"
    Entao quadro-historias.html e mapa-camadas.html abrem pelo duplo clique e o botao de voltar leva ao quadro
