# language: pt
# Historia: us-1794421608645-71141 (Telas do canvas com protótipo real e marcadores numerados clicaveis)
# Convencao: cada cenario @auto tem o identificador CP-nn no titulo de um teste em tests/*.test.js.
Funcionalidade: Marcadores numerados sobre o protótipo no Mapa em Camadas

  @auto
  Cenario: CP-01 Quadro monta os marcadores dos campos com seletor
    Dado uma tela com campos e seletores para alguns deles
    Quando o quadro e desenhado
    Entao data-markers traz so os campos com seletor, com id, numero e seletor

  @auto
  Cenario: CP-02 Mensagem de marcadores leva o campo ativo
    Dado os marcadores e o campo em foco
    Quando monto a mensagem para o protótipo
    Entao a mensagem traz os marcadores e o campo ativo

  @auto
  Cenario: CP-03 Clique no pino foca o campo
    Dado uma mensagem de clique em marcador vinda do quadro
    Quando o painel recebe a mensagem
    Entao o campo do pino e focado

  @auto
  Cenario: CP-04 Mensagem de outra origem e ignorada
    Dado uma mensagem de clique vinda de uma janela que nao e o quadro
    Quando o painel recebe a mensagem
    Entao nenhum campo e focado

  @auto
  Cenario: CP-05 Script dos marcadores esta na ponte
    Dado a lista de scripts da ponte
    Quando carrego a ponte
    Entao o script dos marcadores e o pino clicavel existem

  @auto
  Cenario: CP-06 As quatro telas do canvas estao ligadas ao protótipo com seletores
    Dado o _prototipos.json do dispensacao
    Quando leio as ligacoes de s1 a s4
    Entao cada tela tem protótipo e seletores validos

  @manual
  Cenario: CP-07 Pinos amarelos sobre os campos e clique foca o campo
    Dado que Medicamentos e calculo esta aberto no mapa
    Quando clico no pino 4 do protótipo
    Entao o campo Periodo da posologia fica em foco nas camadas
