# language: pt
# Historia: us-1794419496755-60064 (Protótipo no mapa: interativo e com destaque do campo escolhido)
# Convencao: cada cenario @auto tem o identificador CP-nn no titulo de um teste em tests/*.test.js.
Funcionalidade: Protótipo interativo com destaque do campo no Mapa em Camadas

  @auto
  Cenario: CP-01 Seletores da tela vem do arquivo de protótipos
    Dado que o _prototipos.json tem seletores para a tela historico-medicamentos-s1
    Quando monto a lista de telas
    Entao a tela traz prototype.selectors com os seletores por campo

  @auto
  Cenario: CP-02 Seletor invalido e ignorado
    Dado que um seletor nao e texto ou e longo demais
    Quando monto a lista de telas
    Entao esse campo fica sem seletor

  @auto
  Cenario: CP-03 Quadro carrega os seletores
    Dado uma tela com seletores
    Quando o quadro e desenhado
    Entao o quadro traz os seletores em data-selectors

  @auto
  Cenario: CP-04 Campo com seletor gera a ordem de destaque
    Dado que o campo busca tem seletor
    Quando escolho o campo busca
    Entao a mensagem pede o destaque desse seletor

  @auto
  Cenario: CP-05 Campo sem seletor limpa o destaque
    Dado que o campo estados nao tem seletor
    Quando escolho o campo estados
    Entao a mensagem pede para limpar o destaque

  @auto
  Cenario: CP-06 Ponte entende a ordem de destaque por seletor
    Dado o script da ponte do protótipo
    Quando leio as ordens aceitas
    Entao a ordem de destaque por seletor e o modo play existem

  @auto
  Cenario: CP-07 Escolher campo atualiza so as camadas e nao recarrega o quadro
    Dado que o quadro do protótipo esta aberto
    Quando escolho um campo
    Entao a barra de camadas e a coluna direita sao refeitas e o quadro permanece

  @manual
  Cenario: CP-08 Acordeao abre e o campo escolhido fica destacado
    Dado que o Histórico de prescricoes esta aberto no mapa
    Quando clico na seta do medicamento e depois escolho Situacao
    Entao a linha continua aberta e a coluna Situacao fica destacada
