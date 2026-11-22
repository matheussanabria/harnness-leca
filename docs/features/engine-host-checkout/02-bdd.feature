# language: pt
# Historia: EP-23.07 (Host de motores por checkout)
# Convencao: cada cenario @auto tem o identificador CP-nn no titulo de um teste em tests/*.test.js.
Funcionalidade: Host de motores por checkout

  @auto
  Cenario: CP-01 Host de outra pasta aparece nomeado no erro
    Dado um host de motores de outra pasta, com outro token, ocupando a porta
    Quando este servidor tenta usar o host
    Entao o erro diz a pasta e o pid do dono e como encerra-lo

  @auto
  Cenario: CP-02 Parar ou reiniciar do checkout errado nao finge sucesso
    Dado um host de outra pasta no ar
    Quando rodo --stop ou --restart na outra pasta
    Entao o comando sai com codigo 1, diz de quem e o host, nao imprime "stop requested" e o host continua no ar

  @auto
  Cenario: CP-03 Parar do dono encerra o host
    Dado um host no ar
    Quando rodo --stop na pasta dele
    Entao o host encerra

  @auto
  Cenario: CP-04 Identidade sem token e sem vazar nada
    Dado um host no ar
    Quando consulto /identity sem token
    Entao recebo so aplicativo, pasta, pid e hora de inicio, sem caminho nem token, e as outras rotas continuam exigindo token

  @auto
  Cenario: CP-05 Porta por checkout
    Dado o checkout principal e um worktree
    Quando o host calcula a porta
    Entao a main usa 4322, o worktree usa uma porta estavel entre 4400 e 4499 e HARNESS_ENGINE_HOST_PORT sempre vence
