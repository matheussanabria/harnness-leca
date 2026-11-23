# language: pt
# Historia: EP-25.05 (Launcher com seletor de projeto e "Sem projeto")
# Convencao: cada cenario @auto tem o identificador CP-nn no titulo de um teste em tests/*.test.js.
# Cenarios @manual sao conferidos em navegador real e anotados no dossie.
Funcionalidade: Launcher das funcionalidades

  @auto
  Cenario: CP-01 Funcionalidades agrupadas por escopo
    Dado o manifesto com funcionalidades de escopo opcional, de projeto e global
    Quando abro o launcher
    Entao vejo tres grupos e cada funcionalidade esta no grupo do seu escopo
    E o grupo de criacao tem Chat, Atelie, mapa mental, quadro livre e diagramas

  @auto
  Cenario: CP-02 Sem projeto, funcionalidade de projeto fica desabilitada com a razao
    Dado que a opcao "Sem projeto" esta selecionada
    Quando olho o cartao do Scrum
    Entao ele esta desabilitado e diz "Escolha um projeto para usar esta funcionalidade"

  @auto
  Cenario: CP-03 Sem projeto, cada funcionalidade de criacao abre em ate 3 cliques
    Dado que a opcao "Sem projeto" esta selecionada
    Quando abro o launcher e clico no cartao de Chat, Atelie, mapa mental, quadro livre ou diagramas
    Entao a janela correspondente abre com o escopo pessoal e o que eu criar fica no espaco pessoal

  @auto
  Cenario: CP-04 Escolher um projeto habilita as funcionalidades de projeto
    Dado que a opcao "Sem projeto" esta selecionada
    Quando escolho o projeto "meus-treinos" no seletor
    Entao todos os cartoes ficam habilitados e as chamadas levam o projeto no cabecalho

  @auto
  Cenario: CP-05 Seletor pesquisavel por teclado
    Dado o seletor aberto com Ctrl+K
    Quando digito parte do nome, uso as setas e Enter
    Entao o projeto destacado e escolhido e o foco volta ao botao do seletor

  @auto
  Cenario: CP-06 Estados de carregando, erro e vazio
    Dado que o manifesto demora, falha ou nao ha projetos criados
    Quando abro o launcher
    Entao vejo o esqueleto, a mensagem de erro com "Tentar de novo" ou o convite para criar um projeto

  @manual
  Cenario: CP-07 Layout responsivo em 1440, 768 e 390 pixels
    Dado o launcher aberto
    Quando redimensiono a janela para cada largura
    Entao os cartoes se reorganizam sem rolagem horizontal e o seletor vira folha em 390 pixels

  @manual
  Cenario: CP-08 Leitor de tela e contraste
    Dado o launcher aberto com um leitor de tela
    Quando navego por grupos, cartoes e pelo seletor
    Entao cada grupo, cartao desabilitado e opcao e anunciado com nome, estado e razao, e o contraste cumpre WCAG 2.1 AA
