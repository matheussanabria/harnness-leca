# Casos de Teste — Multi-Agent Coordination

## Caso 1: Positivo
- **Entrada:** "Assuma a história EP-09.01 como codex, registre o início e depois faça o handoff para o gemini para revisar o contrato."
- **Comportamento Esperado:** Acionar `multi-agent-coordination`, rodar `node tools/coordination.js claim EP-09.01 --provider codex`, `node tools/coordination.js start EP-09.01 --provider codex` e finalmente `node tools/coordination.js handoff EP-09.01 --provider codex --to gemini --message "..."`.

## Caso 2: Negativo
- **Entrada:** "Crie o índice de épicos para o módulo de relatórios financeiros."
- **Comportamento Esperado:** Não acionar `multi-agent-coordination`. Encaminhar para `epic-evolution-architect`.

## Caso 3: Ambíguo
- **Entrada:** "Sincronize as tarefas do projeto."
- **Comportamento Esperado:** Esclarecer se a intenção é reconciliar o histórico de conversas e estado dos motores (`tools/sync.js`), sincronizar o progresso do índice mestre (`tools/coordination.js sync`) ou executar uma transição de posse de tarefa.
