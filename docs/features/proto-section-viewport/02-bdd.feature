# language: pt
# Historia: US-1794418610859-36456 (Protótipo no mapa: so a secao e largura pelo seletor)
# Convencao: cada cenario @auto tem o identificador CP-nn no titulo de um teste em tests/*.test.js.
Funcionalidade: Secao do protótipo no Mapa em Camadas com a largura do modo

  @auto
  Cenario: CP-01 Recorte traz so a area de conteudo
    Dado uma tela com cabecalho, menu lateral e area de conteudo
    Quando recorto a secao
    Entao o resultado tem o conteudo e nao tem cabecalho nem menu

  @auto
  Cenario: CP-02 Recorte mantem elementos aninhados da secao
    Dado que a area de conteudo contem outro elemento main
    Quando recorto a secao
    Entao o recorte termina no fechamento da area de conteudo

  @auto
  Cenario: CP-03 Tela sem area de conteudo volta inteira
    Dado uma tela sem area de conteudo
    Quando recorto a secao
    Entao o HTML devolvido e o original

  @auto
  Cenario: CP-04 Servidor devolve a secao com part content e a tela inteira sem o parametro
    Dado um protótipo com a tela historico
    Quando renderizo com e sem part content
    Entao so a versao com part content omite o cabecalho

  @auto
  Cenario: CP-05 Quadro usa a largura do modo
    Dado que o modo e tablet
    Quando a tela com protótipo e desenhada
    Entao o quadro tem 768 px e a URL pede a secao

  @auto
  Cenario: CP-06 Modo desconhecido usa desktop
    Dado que o modo guardado e invalido
    Quando a tela com protótipo e desenhada
    Entao o quadro tem a largura de desktop

  @manual
  Cenario: CP-07 Quadro reduzido para caber e troca de modo muda a largura
    Dado que a tela Histórico de prescricoes esta aberta no mapa
    Quando troco entre Desktop, Tablet e Mobile
    Entao o quadro muda de largura e nunca passa do painel
