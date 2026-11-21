# language: pt
# Historia: EP-24.05 (Exportacao de video: WebM, MP4, GIF)
# Convencao: cada cenario @auto tem o identificador CP-nn no titulo de um teste em tests/*.test.js.
Funcionalidade: Exportar animacao como video

  @auto
  Cenario: CP-16 Exportar WebM
    Dado uma timeline de 1000 ms a 24 fps
    Quando exporto em webm
    Entao o job termina com 24 quadros
    E o arquivo baixado e um WebM com duracao de 1 s

  @auto
  Cenario: CP-17 MP4 indisponivel sem suporte
    Dado um encoder que nao aceita H.264
    Quando peco as opcoes de exportacao
    Entao mp4 nao aparece entre os formatos

  @auto
  Cenario: CP-18 Cancelar exportacao
    Dado um job em andamento
    Quando cancelo o job
    Entao o status vira cancelled e nenhum arquivo fica em exports/

  @auto
  Cenario: CP-19 Fila por projeto
    Dado um job em andamento no projeto
    Quando crio outro job
    Entao ele fica com status queued ate o primeiro terminar

  @manual
  Cenario: CP-20 Exportar pela interface
    Quando clico em Exportar, escolho GIF e confirmo
    Entao vejo o progresso por quadro e baixo um GIF que toca a animacao
