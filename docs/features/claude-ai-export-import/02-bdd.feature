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
