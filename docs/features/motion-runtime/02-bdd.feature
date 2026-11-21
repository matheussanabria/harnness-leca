# language: pt
# Historia: EP-24.02 (Runtime da timeline no iframe)
# Convencao: cada cenario @auto tem o identificador CP-nn no titulo de um teste em tests/*.test.js.
Funcionalidade: Runtime de motion no iframe

  @auto
  Cenario: CP-05 Seek posiciona o quadro exato
    Dado uma tela com faixa de opacidade de 0 a 1 entre 0 e 1000 ms, linear
    Quando envio HARNESS_MOTION_SEEK com 500
    Entao a opacidade calculada do elemento e 0.5
    E recebo HARNESS_MOTION_SEEKED com 500

  @auto
  Cenario: CP-06 Tela sem timeline nao muda
    Dado uma tela sem arquivo .motion.json
    Quando renderizo a tela
    Entao o HTML nao contem o script de motion

  @auto
  Cenario: CP-07 Faixa orfa nao quebra o runtime
    Dado uma timeline com faixa para um data-pid inexistente
    Quando o runtime carrega
    Entao ele envia HARNESS_MOTION_READY normalmente
