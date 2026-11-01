# Harness Leca — Plano para revisão do agente integrado

> Status: **Discovery / Plan only** — não editar código, migrations, stories ou dados de produção antes de aprovação.
> Documento complementar: `CONTEXTO-SCRUM-TRACEABILITY.md`.
> Data: 2026-10-31.

## Missão do agente

Confrontar o contexto proposto com o **repositório real** do Harness Leca. Produzir plano incremental, riscos, contratos e critérios de aceite fundamentados em arquivos e testes existentes. Não supor implementações, endpoints ou schemas.

## Fase 0 — Inventário e diagnóstico (obrigatório)

1. Ler `README`, `MAPA.md`, decisões arquiteturais e instruções do repositório (quando presentes).
2. Localizar UI, serviços, regras, persistência, transições, permissões e testes do Scrum/Kanban.
3. Confirmar se `lanesRevision`, histórico de raia, `state.json`, JSONL e ADR-007 realmente existem, indicando arquivo/linha ou corrigindo premissas.
4. Identificar onde chats, sessões, agentes, motores, workflows, telemetria e hooks são administrados.
5. Mapear integração Git, geração de commits, worktrees, eventos de arquivo e testes.
6. Examinar tratamento atual de concorrência, falhas, auditoria, atualização do `MAPA.md` e isolamento de projetos.
7. Produzir matriz **Existente / Parcial / Ausente / Desconhecido**, com evidência de cada conclusão.

**Gate:** não propor alteração estrutural sem mapa de componentes e fontes de verdade.

## Fase 1 — Contratos e fonte de verdade

Definir IDs (`storyId`, `implementationId`, `executionId`, `correlationId`), relações, estados, esquema versionado de eventos, origem/proveniência, timestamp e idempotency key. Propor migrations somente em plano, com rollback. Identificar se o armazenamento atual é suficiente; comparar:

- **A.** Reutilizar banco e serviços atuais (preferência caso atendam aos requisitos).
- **B.** Log append-only + projeções em armazenamento existente.
- **C.** Módulo de auditoria independente com integração transacional/outbox.

Registrar tradeoffs: simplicidade, integridade, leitura, replay, manutenção e migração.

**Gate:** fonte de verdade única para cada tipo de dado, política de replay e política de erros explícitas.

## Fase 2 — MVP de rastreabilidade

Implementar posteriormente, mediante aprovação, a fatia vertical mínima:

1. Vincular uma implementação a uma história existente (manual/assistido primeiro).
2. Criar `correlationId` e registrar início/término da execução.
3. Detectar/anexar ao menos um commit por SHA verificado (sem afirmar que hash cobre toda a alteração).
4. Exibir timeline na UI da história.
5. Registrar e resolver pendências quando a implementação não tiver história.
6. Testar reprocessamento duplicado, concorrência, perda/replay e permissão por projeto.

**Gate de aceite:** executar teste end-to-end com evidências verificáveis e links funcionais; sem duplicação após replay.

## Fase 3 — Integrações dos executores e Git

- Priorizar adaptadores com captura observável de sessão/comandos/artefatos.
- Correlacionar worktree/branch/commit/execução; considerar cherry-pick, rebase, merge, alterações manuais e commits mistos.
- Nunca atribuir automaticamente a um agente uma alteração que não possa ser provada.
- Tratar ausência de hook, crash e importação retroativa de eventos.
- Definir tratamento de alterações sem commit e artefatos gerados.

**Gate:** reconciliação demonstrada após interrupção e eventos fora de ordem.

## Fase 4 — Story Resolver e automação segura

- Definir identificação de intenção: planejamento, exploração, implementação, bugfix, documentação e testes.
- Evitar duplicação por ID/correlação determinística; usar matching semântico só como sugestão, não como decisão irreversível.
- Respeitar `lanesRevision`, permissões, histórico e transições vigentes (se confirmados).
- Criar política configurável: assistido, híbrido e automático, com ações críticas protegidas.
- Não concluir por texto do agente; exigir critérios de aceite e evidências.

**Gate:** testar corrida de duas sessões criando a mesma história, revisão humana e bloqueio de transições inválidas.

## Fase 5 — Memória, MAPA.md, telemetria, Jira (opcionais)

- Criar sínteses controladas por escopo para múltiplos motores; não copiar conteúdo sensível indiscriminadamente.
- Integrar atualização e validação do `MAPA.md` quando a arquitetura exigir.
- Associar métricas de tempo, tokens e custos com fonte e grau de cobertura.
- Estudar Jira por integração opcional, explicitando autoridade de estados e regras de conflito.

## Fase 6 — UX de auditoria

A história deve oferecer, conforme dados disponíveis: Visão geral, Implementações, Sessões/Agentes, Arquivos, Commits, Testes e Auditoria. Exibir diferença entre:

- **Declarado pelo agente**;
- **Observado pelo sistema**;
- **Validado por testes/aprovação**.

Não simular evidências ausentes. Permitir filtros por execução, agente, evento e período.

## Matriz mínima de testes

| Cenário | Resultado esperado |
|---|---|
| Reenvio do mesmo evento | Uma ocorrência lógica; sem história duplicada |
| Duas sessões concorrentes | Vínculo correto e consistência de versões |
| Commit vindo de fora do Harness | Evidência encontrada ou pendência explícita |
| Teste alegado sem execução | Não marcar teste como validado |
| Falha entre persistência e projeção | Reprocessamento consistente |
| Sessão órfã | Pendência rastreável, sem perda de evento |
| Mudança não autorizada de raia | Negada e auditada |
| Story de outro projeto | Não vinculada nem exposta |
| Rebase/cherry-pick | Identificadores e proveniência preservados quando possível |
| Rollback/reversão | Registro de compensação sem apagar histórico |
| Payload sensível | Redação/bloqueio conforme política |
| Projeção reconstruída | Visão equivalente a partir de eventos canônicos |

## Artefatos que o agente deverá devolver

1. `DIAGNOSTICO-AS-IS.md` com evidências de caminhos/linhas reais.
2. `ARQUITETURA-TO-BE.md` com diagramas C4/fluxo, cardinalidades e sequência.
3. `DECISOES-E-TRADEOFFS.md` com 2–3 alternativas e recomendação.
4. `CONTRATOS-EVENTOS.md` com schema de eventos, segurança e idempotência.
5. `BACKLOG-IMPLEMENTACAO.md` com épico, histórias, subtarefas, dependências, estimativas e critérios verificáveis.
6. `PLANO-TESTES-ROLLBACK.md` com comandos locais confirmados no repo e rollback por fase.
7. Relatório de lacunas e perguntas bloqueantes, sem inventar respostas.

Os nomes são sugestões de entregáveis; **na etapa de discovery, gravar documentação somente no local autorizado pelo fluxo de planejamento do repositório**.

## Critérios para aprovar a implementação

- Referências ao código real, sem conjecturas apresentadas como fatos.
- Reutilização da máquina de estados e da persistência existentes onde viável.
- Plano de compatibilidade e migração reversível.
- Estratégia de permissão, retenção e proteção de dados.
- Testes idempotentes e de concorrência definidos.
- MVP pequeno com demonstração ponta a ponta.
- Nenhuma alteração executada sem autorização.

## Prompt para agente integrado

> Leia primeiro `CONTEXTO-SCRUM-TRACEABILITY.md` e `PLANO-REVISAO-SCRUM-TRACEABILITY.md`. Analise o repositório atual do Harness Leca e confronte cada premissa com evidências concretas em arquivos e testes. Identifique reutilização de componentes, lacunas, riscos e alternativas. Execute somente investigação não destrutiva e planejamento, sem implementar, criar histórias reais, movimentar raias, migrar dados ou fazer commits. Entregue diagnóstico AS-IS, desenho TO-BE, contratos, backlog e estratégia de testes/rollback. Distinga explicitamente fatos confirmados, hipóteses e decisões pendentes. Recomende um MVP de rastreabilidade história → execução → commit → evidência → timeline para aprovação.


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
