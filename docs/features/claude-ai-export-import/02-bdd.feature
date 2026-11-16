# language: pt
# Historia: botao na interface para importar conversas de um novo export de dados do claude.ai
# Convencao: cada cenario @auto tem o identificador CP-nn no titulo de um teste em tests/*.test.js.
Funcionalidade: Importar conversas do export do claude.ai pela interface

  @auto
  Cenario: CP-01 Leitor de zip extrai entradas e bloqueia caminhos fora da pasta
    Dado um zip com uma entrada valida e uma entrada "../evil.txt"
    Quando o zip e extraido
    Entao so a entrada valida e gravada dentro da pasta de destino

  @auto
  Cenario: CP-02 O export e aceito como zips, como um dos zips ou ja extraido
    Dado uma pasta com conversations-000.zip e design_chats-000.zip
    Quando o usuario informa a pasta, um dos zips ou a pasta extraida
    Entao conversations.json e design_chats sao localizados

  @auto
  Cenario: CP-03 A lista mostra as conversas e marca as ja importadas
    Dado um export com uma conversa e um chat do Claude Design
    Quando a conversa e importada no projeto demo e a lista e lida de novo
    Entao a conversa aparece como ja importada em demo e o chat de design nao

  @auto
  Cenario: CP-04 So as conversas marcadas entram no projeto escolhido
    Dado o mesmo export
    Quando o usuario importa apenas o chat de design no projeto outro
    Entao so ele e gravado em projects/outro/chats e reimportar informa sem mudanca

  @auto
  Cenario: CP-05 Erros voltam com mensagem legivel
    Dado uma pasta sem export, uma selecao vazia, um id invalido ou um projeto inexistente
    Quando o usuario lista ou importa
    Entao o servidor responde 400 ou 404 com a mensagem do motivo

  @manual
  Cenario: CP-06 Botao e dialogo na tela do projeto
    Dado o projeto ativo aberto no navegador
    Quando o usuario clica em "Importar claude.ai", informa a pasta dos zips e importa conversas marcadas
    Entao a lista de atividade do projeto recarrega com as conversas novas

  @auto
  Cenario: CP-07 O manifest baixa so os zips de conversas e de Design, uma vez
    Dado um manifest do export com memories, conversations e design_chats
    Quando o servidor prepara o export duas vezes
    Entao so conversations-000.zip e design_chats-000.zip sao baixados e nenhum link e usado de novo

  @auto
  Cenario: CP-08 O dialogo aceita o caminho do manifest
    Dado o caminho do manifest-*.json, com ou sem aspas
    Quando o usuario le o export e importa uma conversa
    Entao a lista mostra as conversas do export e a importacao grava a conversa no projeto

  @auto
  Cenario: CP-09 O zip que embrulha o manifest tambem e aceito
    Dado o manifest-*.zip que contem o manifest-*.json
    Quando o servidor prepara o export
    Entao os zips de conversas e de Design sao baixados

  @auto
  Cenario: CP-10 Link recusado, expirado, que nao e zip ou fora do claude.ai falha com mensagem
    Dado um link que responde 403, uma pagina HTML, um conteudo que nao e zip ou um host fora do claude.ai
    Quando o servidor tenta baixar
    Entao o erro explica o motivo, sugere gerar um export novo quando passou de 24 h e nenhum arquivo parcial fica no cache
