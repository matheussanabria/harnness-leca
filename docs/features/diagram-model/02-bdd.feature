# language: pt
# Historia: EP-21.03 (Modelo puro do diagrama Mermaid)
# Convencao: cada cenario @auto tem o identificador CP-nn no titulo de um teste em tests/*.test.js.
Funcionalidade: Modelo do diagrama Mermaid

  @auto
  Cenario: CP-01 Detectar o tipo pelo cabecalho
    Dado um texto que comeca com flowchart, sequenceDiagram, classDiagram, stateDiagram, erDiagram ou gantt
    Quando detecto o tipo
    Entao recebo o tipo aceito pelo editor

  @auto
  Cenario: CP-02 Ignorar o que vem antes do cabecalho
    Dado um texto com front matter, linhas em branco, comentarios %% ou diretivas antes do cabecalho
    Quando detecto o tipo
    Entao o cabecalho e achado normalmente

  @auto
  Cenario: CP-03 Recusar mapa mental e familias nao suportadas
    Dado um texto que comeca com mindmap, pie ou outra familia fora da lista
    Quando valido
    Entao a mensagem diz que o tipo nao e aceito e quais sao os aceitos

  @auto
  Cenario: CP-04 Erro de sintaxe com a linha do texto digitado
    Dado um diagrama com erro na linha 6, depois de um front matter de 3 linhas
    Quando valido com o Mermaid real
    Entao a mensagem diz "Linha 6", o trecho e o que era esperado

  @auto
  Cenario: CP-05 Limite de 64 KB
    Dado um texto de exatamente 64 KB e outro com 1 byte a mais
    Quando valido
    Entao o primeiro e aceito e o segundo e recusado antes de carregar o Mermaid

  @auto
  Cenario: CP-06 Nomes de arquivo de exportacao
    Dado um titulo com espacos, barras e acentos
    Quando monto o nome de svg, png, mmd e md
    Entao o nome e seguro para download e leva a extensao do formato

  @auto
  Cenario: CP-07 Mermaid so e importado em dois arquivos
    Dado o codigo de ui/web/src
    Quando procuro importacoes do pacote mermaid
    Entao so validate.ts e render.ts importam

  @auto
  Cenario: CP-08 SVG sanitizado e sem lixo depois de falha
    Dado um diagrama com script, onerror e link javascript nos rotulos
    Quando renderizo com o Mermaid real
    Entao o SVG nao tem nada executavel e uma falha nao deixa elemento temporario
