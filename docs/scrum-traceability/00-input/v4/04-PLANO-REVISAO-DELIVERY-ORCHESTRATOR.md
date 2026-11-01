# Harness Leca — Plano de revisão técnica do Delivery Orchestrator

> Execução autorizada nesta etapa: **somente leitura, diagnóstico e planejamento**.
> Complementar a `PLANO-REVISAO-SCRUM-TRACEABILITY.md`. Não substituir o plano anterior.

## Objetivo da revisão

Validar no código real a viabilidade do ciclo **demanda → backlog rascunho → investigação/refinamento → sprint → trilhas especializadas → validação → conclusão**, com rastreabilidade transversal e baixo custo de execução.

## Fase 0 — Inventário e leitura de código (obrigatória)

1. Localizar modelos, rotas, bancos, migrations e UI do Scrum.
2. Enumerar e caracterizar as 12 raias, `lanesRevision`, regras de transição e histórico.
3. Encontrar implementação de backlog, sprints, itens, subtarefas e auditoria (ou registrar ausência).
4. Localizar mecanismo de agentes, skills, workflows, adapters, shells e telemetria.
5. Mapear Git hooks, eventos, sessões, `state.json`, JSONL, `MAPA.md` e memória.
6. Levantar testes, CI, ferramentas e convenções existentes.
7. Fazer quadro `Existe / Parcial / Ausente / Não verificado` com referências a arquivos e linhas.

## Fase 1 — Gap analysis

Para cada requisito: recurso já implementado, incompatibilidade, risco, custo aproximado, dependências, mudança mínima e alternativa mais simples. Separar *requisito confirmado pelo produto* de *hipótese arquitetural*.

Questões mínimas:
- Precisa de uma nova entidade Demand ou basta status de rascunho no modelo atual?
- Quais estados são persistidos e quais podem ser derivados?
- Como planejar sprint sem forçar movimentação prematura?
- Como especialistas assinam artefatos e os entregam ao próximo estágio?
- Como detectar duplicatas sem impedir o registro de novas demandas?
- Como tratar alteração de escopo, bloqueio, reabertura e urgência?
- Que gates são determinísticos e quais dependem de avaliação humana?

## Fase 2 — Proposta técnica detalhada

Entregar:

1. Diagrama de componentes (as-is / to-be).
2. Sequências: demanda nova, bug, refinamento, selecionar sprint, trilha design, trilha dev, falha e rollback.
3. Esquema de entidades, cardinalidades, índices e migração compatível.
4. Máquina de estados existente versus proposta, com tabela de transições e responsáveis.
5. Contratos versionados para agentes, eventos, Quality Gates e evidências.
6. Interfaces de adapter para motores (não acoplar a Claude/Codex/Gemini/OpenCode).
7. Estratégia de autorização, auditoria append-only, redaction e isolamento por projeto.
8. Estratégia de idempotência, tratamento de erro, reconciliação e observabilidade.
9. Estimativa relativa de esforço, dependências e roteiro de rollback por fase.

## Fase 3 — Backlog incremental sugerido (não executar)

| ID provisório | História | Critério mínimo de entrega |
|---|---|---|
| DO-01 | Capturar demanda como rascunho | Origem, projeto, tipo e histórico registrados |
| DO-02 | Resolver vínculo ou duplicidade | Nova/existente/pendente de decisão rastreável |
| DO-03 | Refinar com especialista | Spec estruturada, referências e versionamento |
| DO-04 | Avaliar Definition of Ready | Gate reproduzível e evidências consultáveis |
| DO-05 | Planejar sprint explicitamente | Alocação auditada sem mutação indevida de estado |
| DO-06 | Executar stage por especialista | Entrada, saída, executor e resultado registrados |
| DO-07 | Rastrear Git, testes e sessão | Timeline correlacionada e idempotente |
| DO-08 | Habilitar trilhas Design/Dev | Transições condicionais e contratos de passagem |
| DO-09 | Revisão e aceite controlados | DoD e aprovações protegidos |
| DO-10 | Relatórios e métricas | Tempo de ciclo, retrabalho, falhas e custo por etapa |

**MVP recomendado:** DO-01 + DO-02 + ligação com um primeiro especialista de refinamento e eventos de rastreabilidade já propostos anteriormente. Evitar implementar um motor genérico de workflow sem validação da necessidade real.

## Fase 4 — Matriz de validação

- Intake simples, duplicado e incompleto.
- Bug criado por chat e tarefa criada por CLI fora do Scrum.
- Rascunho não refinado tentando entrar na sprint.
- Histórias sem Design e histórias com Design + Dev.
- Dois agentes atualizando a mesma história (revisão/concorrência).
- Ferramenta envia o mesmo evento duas vezes.
- Agente reporta teste aprovado sem evidência confiável.
- Mudança de escopo após início de execução.
- Falha de motor, cancelamento, retomada e reprocessamento.
- Reabertura, bloqueio, urgência, carry-over e rollback.
- Permissões por projeto/usuário; segredos redigidos nos logs.

Comandos, frameworks e suites de teste devem ser extraídos do repositório, **não inventados**.

## Fase 5 — Entregáveis para revisão humana

- `DIAGNOSTICO-ATUAL.md`: inventário com links/paths/linhas.
- `ARQUITETURA-PROPOSTA.md`: alternativas, decisões e tradeoffs.
- `MODELO-DADOS-E-EVENTOS.md`: contratos e migrações propostas.
- `MATRIZ-ESTADOS-E-GATES.md`: estados, permissões e evidências.
- `BACKLOG-IMPLEMENTACAO.md`: histórias pequenas, dependências e aceites.
- `COMPARATIVO-DAI.md`: somente depois de identificar e ler o repositório correto.

## Prompt pronto para o agente

> Leia primeiro os documentos `CONTEXTO-SCRUM-TRACEABILITY.md`, `PLANO-REVISAO-SCRUM-TRACEABILITY.md`, `03-CONTEXTO-DELIVERY-ORCHESTRATOR.md`, `04-PLANO-REVISAO-DELIVERY-ORCHESTRATOR.md` e `05-ROTEIRO-ANALISE-DAI.md`. Investigue o workspace real, contraste cada hipótese com arquivos/código, não presuma entidades ou endpoints existentes e proponha a menor arquitetura compatível. Não altere arquivos, branches, banco, sprints ou histórias nesta fase. Produza os seis entregáveis acima e identifique divergências com o repositório DAI apenas após confirmar owner/URL e acesso.


---

## Adendo v3 — integração DAI (31/10/2026)

**Status:** evidências documentais consultadas na branch padrão `dev` de `matheussanabria/harness-dai`; comportamento de runtime ainda NÃO auditado. Este adendo prevalece sobre propostas anteriores que pressupunham inexistência de pipelines e especialistas.

- Fonte: `README.md`: `.agents/` é origem dos 17 agentes; `skills/` é origem das competências; exportação para Claude Code via `scripts/export_claude_code.py`; `harness/cli.py` é caminho legado.
- Fonte: `skills/orquestracao/sdlc-pipeline/SKILL.md`: skill executa o workflow `feature-delivery`, com execução por estágio, dossiê `docs/features/<slug>/`, `_status.md`, gates e variantes `domain-creation`, `domain-change`, `composition`, `hotfix`.
- Fonte: `docs/SDLC_PIPELINE_DESIGN.md`: estágios `story`, `bdd`, `prototype`, `modeling`, `dev`, `tests`, `review`, `commit-pr`, `deploy`; mapeamento de especialistas; confirmação explícita para commit/PR e deploy.
- Fonte: `workflows/product-delivery/WORKFLOW.md`: macrofluxo de produto com estados discovery → requirements → design → architecture → engineering → features → quality → deploy; documento marcado `draft` e informa ausência de adaptador ponta a ponta.

**Implicações para Scrum:**
1. Não criar um segundo pipeline SDLC concorrente: avaliar adaptador para contratos e artefatos existentes no DAI.
2. Separar `demand maturity`, `sprint allocation`, `workflow stage` e `execution status` (dimensões diferentes, sem forçar novas raias).
3. Refinamento preferencialmente antes da seleção para sprint; permitir exceções com autorização e registro.
4. Usar `storyId` e `workflowRunId` como vínculo, sem tratar `_status.md` como única fonte transacional de auditoria.
5. Os dados de Scrum, histórico e `lanesRevision` existentes devem ser preservados; investigar modelos reais antes de desenhar migrações.
6. Garantir operação multi-motor através de adaptadores; a skill documentada é Claude Code-first.
7. Verificar a localização efetiva de `workflows/feature-delivery/manifest.yaml` e a cópia exportada antes de assumir resolução de caminhos.

**Decisão pendente:** autorizar somente Discovery e plano técnico nesta rodada; não editar repositórios, não mover histórias e não executar workflows, commits ou deploy.

Leia também `06-INTEGRACAO-SCRUM-DAI.md` e `07-PROMPT-REVISAO-CRUZADA.md` nesta pasta.
