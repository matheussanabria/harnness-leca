# language: pt
# Historias: EP-25.06 (Janelas de quadro livre, mapa mental e diagramas) e EP-25.10 (Atelie sem projeto)
# Convencao: cada cenario @auto tem o identificador CP-nn no titulo de um teste em tests/*.test.js.
# Cenarios @manual sao conferidos em navegador real e anotados no dossie.
Funcionalidade: Janelas de criacao sem projeto e mover ou copiar para um projeto

  @auto
  Cenario: CP-01 Cada funcionalidade tem rota e janela proprias
    Dado o launcher aberto sem projeto
    Quando abro Quadro livre, Mapa mental, Diagramas e Atelie
    Entao cada um abre na sua rota (/quadro-livre, /mapa-mental, /diagramas, /atelie) e o launcher deixa de mostrar "Em breve"

  @auto
  Cenario: CP-02 Sem projeto, o que eu crio fica no espaco pessoal
    Dado que o escopo e "Sem projeto"
    Quando crio um mapa mental
    Entao ele aparece na lista com o dono "Pessoal" e fica registrado com esse dono

  @auto
  Cenario: CP-03 A lista mostra o dono e filtra por escopo
    Dado itens no espaco pessoal e em dois projetos
    Quando escolho "Só o escopo atual" e depois "Todos"
    Entao vejo primeiro so os itens do escopo e depois todos, cada um com o seu dono

  @auto
  Cenario: CP-04 A previa mostra o que muda antes de mover
    Dado um quadro do projeto citado por outro quadro
    Quando escolho "Mover para projeto" e um destino
    Entao vejo os arquivos que mudam de lugar e os links que vao quebrar, e nada foi gravado

  @auto
  Cenario: CP-05 Mover exige confirmacao explicita
    Dado a previa de um movimento aberta
    Quando ainda nao marquei que entendo que o item sai da origem
    Entao o botao Mover esta desabilitado, e o servidor recusa o pedido sem confirmado verdadeiro

  @auto
  Cenario: CP-06 Colisao no destino impede o movimento
    Dado um item cujo arquivo ja existe no destino
    Quando escolho esse destino
    Entao a previa diz que nao e possivel continuar, nada e sobrescrito e o botao fica desabilitado

  @auto
  Cenario: CP-07 Desfazer devolve o item enquanto nada mudou
    Dado um item recem movido
    Quando clico em Desfazer
    Entao o item volta para a origem com seus arquivos, e se ele foi editado antes o desfazer e recusado

  @auto
  Cenario: CP-08 Copiar mantem o original e marca a copia
    Dado um item no espaco pessoal
    Quando escolho "Copiar para projeto"
    Entao o original continua onde esta e a copia aparece no destino marcada como "Cópia"

  @auto
  Cenario: CP-09 Falha no meio do movimento deixa tudo na origem
    Dado que o disco falha durante o movimento
    Quando confirmo mover
    Entao aparece "nao foi possivel mover; nada foi alterado" e o item continua inteiro na origem

  @auto
  Cenario: CP-10 Movimento de prototipo trata os vinculos de rastreabilidade (25.07)
    Dado um prototipo ligado a historias do Scrum do projeto de origem
    Quando escolho mover para outro projeto
    Entao a previa lista os vinculos e deixa escolher entre manter como texto e remover

  @auto
  Cenario: CP-11 Estados de carregando, erro e vazio
    Dado que a lista demora, falha ou nao tem itens
    Quando abro a janela
    Entao vejo o esqueleto, a mensagem com "Tentar de novo" ou o convite para criar o primeiro item

  @manual
  Cenario: CP-12 Layout responsivo, teclado e leitor de tela
    Dado uma janela aberta com o dialogo de mover
    Quando uso so o teclado, redimensiono para 390 pixels e navego com leitor de tela
    Entao o menu de acoes, o dialogo e o aviso de desfazer sao alcancaveis e anunciados, sem rolagem horizontal
