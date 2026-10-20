# Casos de Teste — Epic Evolution Architect

## Caso 1: Positivo
- **Entrada:** "Vamos planejar a evolução arquitetural do subsistema de chat e studio do sistema, criando o índice mestre, ADRs e quebrando em histórias com base no estado atual."
- **Comportamento Esperado:** Acionar `epic-evolution-architect`, ler os módulos existentes, produzir diagnóstico, propor ADRs pertinentes e estruturar a árvore `00-index.md`, `02-epics/` com o contrato `story-template.md`.

## Caso 2: Negativo
- **Entrada:** "Cria pra mim uma user story em Gherkin para o botão de checkout do e-commerce."
- **Comportamento Esperado:** Não acionar `epic-evolution-architect`. Redirecionar para `sdlc-pipeline` ou `bdd-scenarios`.

## Caso 3: Ambíguo
- **Entrada:** "Preciso organizar as tarefas desse módulo."
- **Comportamento Esperado:** Esclarecer se o usuário deseja um breakdown técnico de uma história existente (`technical-breakdown`) ou a estruturação de um programa completo de evolução por épicos (`epic-evolution-architect`).
