# language: pt
# Historia: US-1794180293134 (Adicionar area de transferencia no chat)
# Convencao: cada cenario @auto tem o identificador CP-nn no titulo de um teste em tests/*.test.js.
# Cenarios @manual dependem do navegador e ficam registrados ate existir teste de interface.
Funcionalidade: Anexar arquivos ao chat por colar e arrastar

  @auto
  Cenario: CP-01 Soltar um arquivo em uma area do chat anexa o arquivo
    Dado que arrasto um arquivo para o compositor ou o historico do chat
    Quando solto o arquivo
    Entao o arquivo e enviado como anexo, igual ao botao de anexar

  @auto
  Cenario: CP-02 A area mostra o destaque tracejado durante o arraste
    Dado que arrasto um arquivo sobre uma area do chat
    Quando o ponteiro esta sobre a area
    Entao a area recebe o destaque de soltar
    E o destaque some ao sair da area ou ao soltar

  @auto
  Cenario: CP-03 Mover o ponteiro entre elementos da mesma area mantem o destaque
    Dado que arrasto um arquivo sobre uma area do chat
    Quando o ponteiro passa para um elemento interno da mesma area
    Entao o destaque continua visivel

  @auto
  Cenario: CP-04 Soltar texto selecionado nao faz nada
    Dado que arrasto um texto selecionado para uma area do chat
    Quando solto o texto
    Entao nenhum anexo e criado
    E o comportamento padrao do navegador nao e bloqueado

  @auto
  Cenario: CP-05 Soltar fora de uma area do chat e ignorado
    Dado que arrasto um arquivo para fora das areas do chat
    Quando solto o arquivo
    Entao nenhum anexo e criado

  @auto
  Cenario: CP-06 Print colado recebe um nome proprio
    Dado que copiei um print e ele chega com o nome generico "image.png"
    Quando colo no campo do chat
    Entao o anexo recebe um nome unico no formato "colado-<instante>-<posicao>.<extensao>"

  @auto
  Cenario: CP-07 Arquivo colado com nome real mantem o nome
    Dado que colo um arquivo cujo nome nao e generico
    Quando o anexo e criado
    Entao o nome original e preservado

  @auto
  Cenario: CP-08 Arquivo solto sem nome ganha um nome
    Dado que solto um arquivo sem nome
    Quando o anexo e criado
    Entao ele recebe um nome gerado

  @auto
  Cenario: CP-09 Navegador que nao preenche a lista de arquivos usa os itens da transferencia
    Dado que a transferencia tem a lista de arquivos vazia e itens do tipo arquivo
    Quando leio os arquivos da transferencia
    Entao os arquivos vem dos itens

  @manual
  Cenario: CP-10 Soltar e colar funcionam no chat principal, no Studio e no mini
    Dado que estou no chat principal, no Studio ou no mini
    Quando solto uma imagem ou colo um print com Ctrl+V
    Entao o chip do anexo aparece na bandeja do compositor

  @manual
  Cenario: CP-11 Anexo solto ou colado segue as regras do botao de anexar
    Dado que nao ha projeto aberto, ou o envio falha, ou removo o chip
    Quando anexo por colar ou arrastar
    Entao o comportamento e o mesmo do botao de anexar
