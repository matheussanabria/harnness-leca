# language: pt
# Historia: EP-24.06 (Painel de timeline com faixas e keyframes editaveis)
# Convencao: cada cenario @auto tem o identificador CP-nn no titulo de um teste em tests/*.test.js.
Funcionalidade: Editar keyframes no painel

  @auto
  Cenario: CP-21 Snap ao quadro
    Dado uma timeline a 30 fps
    Quando arrasto um keyframe para 47 ms
    Entao ele vai para 33 ms, o quadro mais proximo

  @auto
  Cenario: CP-22 Nao ultrapassar keyframes vizinhos
    Dado keyframes em 0, 500 e 1000 ms
    Quando arrasto o do meio para 1200 ms
    Entao ele para no quadro anterior a 1000 ms

  @auto
  Cenario: CP-23 Desfazer edicao
    Dado que movi um keyframe de 500 para 700 ms
    Quando pressiono Ctrl+Z
    Entao o keyframe volta para 500 ms e a timeline gravada tambem

  @manual
  Cenario: CP-24 Editar easing e ver no player
    Quando troco o ease de um keyframe para ease-in-out
    Entao ao tocar a animacao o movimento acelera e desacelera
