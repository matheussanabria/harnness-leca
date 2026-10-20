# Workflow F1 - Arquitetura e contratos

1. Partir do `01-current-state-audit.md` aprovado; nao refazer a auditoria.
2. Definir contratos de `Task`, `Execution`, `Tool` e `Model` (HIA-004) como JSON Schema em `schemas/`, seguindo o padrao existente.
3. Especificar cada modulo conceitual (ver `references/03-fases-e-backlog.md`) adaptando nomes e pastas ao repositorio.
4. Registrar decisoes e tradeoffs em ADRs, reaproveitando o formato de `docs/harness-evolution/03-decisions/`.
5. Montar a matriz existente, reutilizavel e nova; justificar qualquer dependencia nova.
6. Escrever o backlog priorizado com dependencias e tarefas paralelizaveis.
7. Pedir revisao independente pontual (outro motor) somente sobre o plano consolidado.
8. Entregar para aprovacao. Sem aprovacao, nao iniciar a F2.
