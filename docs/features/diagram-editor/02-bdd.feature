# language: pt
# Historia: EP-21.04 (Ilha de diagramas Mermaid no Design)
# Convencao: cada cenario @auto tem o identificador CP-nn no titulo de um teste em tests/*.test.js.
# Cenarios @manual sao conferidos em navegador real e anotados no dossie.
Funcionalidade: Editor de diagramas Mermaid

  @auto
  Cenario: CP-01 Preview ao vivo com texto valido
    Dado um diagrama aberto com texto Mermaid valido
    Quando altero o texto e espero o debounce
    Entao o preview mostra o novo desenho e a faixa diz "Sintaxe valida"

  @auto
  Cenario: CP-02 Erro de sintaxe marca a linha e mantem a ultima versao valida
    Dado um diagrama ER valido ja renderizado
    Quando escrevo "contem" com acento e sem aspas na linha 3
    Entao a linha 3 fica marcada, a mensagem diz o trecho e o que era esperado
    E o preview continua com o ER anterior, esmaecido e com o aviso de ultima versao valida

  @auto
  Cenario: CP-03 Renderizacao antiga nunca sobrescreve a nova
    Dado duas renderizacoes em andamento onde a mais antiga termina por ultimo
    Quando a antiga termina
    Entao o preview e a mensagem de erro continuam os da renderizacao mais nova

  @auto
  Cenario: CP-04 Trocar de diagrama nao mostra o preview do anterior
    Dado dois diagramas de tipos diferentes
    Quando abro o segundo e o primeiro ainda esta no preview
    Entao o preview e limpo antes de renderizar o segundo

  @auto
  Cenario: CP-05 Autosave com rev
    Dado um diagrama aberto
    Quando edito o texto
    Entao aparece "Alteracoes nao salvas", depois "Salvando" e "Salvo", e o servidor recebe o texto com o rev lido

  @auto
  Cenario: CP-06 Conflito entre abas
    Dado o mesmo diagrama aberto em duas abas e salvo em uma delas
    Quando a outra tenta salvar com o rev antigo
    Entao aparece o banner com "Carregar a versao salva" e "Manter a minha"
    E nada e sobrescrito sem a escolha da pessoa

  @auto
  Cenario: CP-07 Novo diagrama por modelo
    Dado o catalogo de diagramas
    Quando escolho um dos 6 tipos no menu "Novo"
    Entao um diagrama com o modelo desse tipo e criado, selecionado e renderizado sem erro

  @auto
  Cenario: CP-08 Exportar
    Dado um diagrama valido
    Quando exporto SVG, PNG, .mmd ou "Copiar Markdown"
    Entao cada saida usa os exportadores da 21.03 e o nome do arquivo vem do titulo

  @auto
  Cenario: CP-09 Exportar com erro de sintaxe
    Dado um diagrama com erro
    Quando exporto SVG ou PNG
    Entao a pessoa e avisada que a exportacao usa a ultima versao valida, e .mmd exporta o texto atual

  @auto
  Cenario: CP-10 Tema segue o shell
    Dado o shell em tema claro ou escuro
    Quando troco o tema
    Entao o diagrama e redesenhado com o tema correspondente

  @auto
  Cenario: CP-11 Mermaid so baixa ao abrir a ilha
    Dado o build da ilha
    Quando abro o Design sem entrar na aba Diagramas
    Entao o chunk do mermaid nao e carregado

  @auto
  Cenario: CP-12 Aba Diagramas no Design
    Dado o Design aberto
    Quando clico em "Diagramas"
    Entao a ilha monta com o catalogo de kind diagram, e quadro e mapa mental seguem iguais

  @manual
  Cenario: CP-13 Fluxo completo em navegador real
    Dado o Harness aberto
    Quando crio, edito com erro e corrijo, recarrego a pagina e exporto SVG e PNG
    Entao o texto persiste, as exportacoes abrem e o conflito em duas abas funciona
