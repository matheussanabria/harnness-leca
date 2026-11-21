# language: pt
# Historia: EP-24.04 (Tools do agente para criar e ajustar a timeline)
# Convencao: cada cenario @auto tem o identificador CP-nn no titulo de um teste em tests/*.test.js.
Funcionalidade: Agente edita a timeline

  @auto
  Cenario: CP-12 Agente cria a timeline
    Dado uma tela com cards p-3, p-4 e p-5 e sem timeline
    Quando o modelo responde com motion_write_timeline valido
    Entao o arquivo .motion.json e gravado

  @auto
  Cenario: CP-13 Erro volta ao modelo
    Quando o modelo chama motion_set_keys com a prop "top"
    Entao nada e gravado
    E o resultado da tool lista o erro de prop nao permitida

  @auto
  Cenario: CP-14 Resumo respeita o orcamento
    Dado uma timeline com 200 faixas
    Quando monto o contexto do agente
    Entao o resumo tem ate 200 tokens e indica as faixas omitidas

  @manual
  Cenario: CP-15 Pedido em linguagem natural com modelo real
    Dado o Atelier com uma tela de cards
    Quando peco "entrada em cascata dos cards, 1,2 s, ease-out"
    Entao os cards entram um apos o outro e a animacao termina em cerca de 1,2 s
