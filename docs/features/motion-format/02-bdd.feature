# language: pt
# Historia: EP-24.01 (Formato motion@1, validador e armazenamento)
# Convencao: cada cenario @auto tem o identificador CP-nn no titulo de um teste em tests/*.test.js.
Funcionalidade: Timeline motion@1

  @auto
  Cenario: CP-01 Gravar uma timeline valida
    Dado uma tela com os elementos p-1 e p-2
    Quando gravo uma timeline motion@1 com faixas para p-1 e p-2
    Entao o arquivo screens/<tela>.motion.json e criado
    E a resposta traz o novo rev

  @auto
  Cenario: CP-02 Recusar prop fora da lista permitida
    Quando gravo uma faixa com a prop "left"
    Entao a resposta e 422
    E o erro aponta a faixa, o keyframe e a prop "left"

  @auto
  Cenario: CP-03 Faixa orfa vira aviso
    Dado uma timeline com faixa para p-9, que nao existe na tela
    Quando valido a timeline
    Entao ela e aceita com o aviso orphan_track para p-9

  @auto
  Cenario: CP-04 Conflito de rev
    Dado que outra gravacao mudou a timeline
    Quando gravo com o rev antigo
    Entao a resposta e 409 e o arquivo nao muda
