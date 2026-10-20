---
id: EP-01-PILOTO
titulo: Piloto do Window Manager na Estação Gemini
epico: EP-01
historias: ["01.01", "01.02", "01.03", "01.04", "01.05", "01.06", "01.08"]
tags: [harness-evolution, piloto]
---

# Piloto: Estação Gemini

[Voltar ao EP-01](README.md)

A estação já existe e tem chat, telemetria, ações rápidas e conversas. Ela é a primeira integração vertical do Window Manager.

## Passos
1. Identificar o componente responsável pelo painel lateral Gemini (saída do 00.02).
2. Preservar chat, telemetria, ações rápidas e conversas existentes.
3. Substituir o controle local de abertura por comandos do Window Manager.
4. Adicionar minimizar, restaurar, expandir e alternar entre painel e janela flutuante.
5. Garantir que o chat continue funcionando durante as transições, inclusive com streaming em andamento.
6. Integrar o foco com o bloqueio e a liberação dos controles da câmera.
7. Adicionar testes de regressão e validar a restauração do layout.

## Critérios de aceite
- [ ] O usuário interage com a Estação Gemini e abre o painel existente.
- [ ] Pode transformar o painel em janela flutuante.
- [ ] Pode minimizar a janela e continuar navegando pelo escritório.
- [ ] Pode restaurá-la pela barra de tarefas.
- [ ] Pode redimensioná-la sem cortar o chat.
- [ ] Pode digitar sem ativar os controles de movimentação do personagem.
- [ ] Pode voltar ao modo de câmera sem perder a conversa.
- [ ] O estado da janela é restaurado após recarregar a página, quando a persistência estiver habilitada.
- [ ] O funcionamento da estação no modo 2.5D continua compatível.

## Riscos
- **Stream interrompido ao mover o DOM:** reparentar o container pode reiniciar listeners. Mover o elemento existente em vez de recriar e testar com resposta em andamento.
- **Foco preso:** se a janela perde foco sem liberar a câmera, o avatar fica travado. Liberar no `blur`, no `Escape` e ao minimizar.
- **Rollback:** manter o caminho de abertura antigo atrás de um flag até o aceite.
