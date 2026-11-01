# Integração Scrum × DAI — Documento de Arquitetura v3

> Estado: proposta para revisão; **nenhum código alterado**. Data: 2026-10-31.

## 1. Tese

- **Harness Leca**: governança de demandas, Product Backlog, Sprint Backlog, interface, sessões e rastreabilidade.
- **DAI**: catálogo de especialistas, skills, definição de workflows e critérios de validação.
- **Adaptador** (a validar): traduz eventos de um `WorkflowRun` e artefatos de um dossiê para projeções da história e Audit Trail, sem duplicar orquestração.

## 2. Evidências verificadas nos arquivos do DAI (`dev`)

| Caminho | Observação documentada | Limitação / pergunta de verificação |
|---|---|---|
| `README.md` | `.agents/` reúne 17 especialistas; skills e memória; exportação Claude Code | Verificar versões e manifests vigentes |
| `skills/orquestracao/sdlc-pipeline/SKILL.md` | Adapter para `feature-delivery`; estado por dossiê `_status.md`; gates e variantes | Testar contrato real e funcionamento em CLI |
| `docs/SDLC_PIPELINE_DESIGN.md` | 9 estágios, artefatos, mapa especialista/etapa | Documento de decisão de 27/05/2026; confrontar com código atual |
| `workflows/product-delivery/WORKFLOW.md` | Macrofluxo produto com stage gates | `draft`; sem adapter ponta a ponta segundo documento |

Links GitHub (privados; requerem acesso):
- https://github.com/matheussanabria/harness-dai/blob/dev/README.md
- https://github.com/matheussanabria/harness-dai/blob/dev/skills/orquestracao/sdlc-pipeline/SKILL.md
- https://github.com/matheussanabria/harness-dai/blob/dev/workflows/product-delivery/WORKFLOW.md
- https://github.com/matheussanabria/harness-dai/blob/dev/docs/SDLC_PIPELINE_DESIGN.md

## 3. Modelo de domínio proposto — não corresponde necessariamente ao schema existente

- `Demand`: ideia, bug, solicitação, origem, autor, classificação e estado de refinamento.
- `Story`: unidade de valor, RF/RNF/RN, GWT, critérios de aceite, anexos, revisões e aprovação.
- `SprintAssignment`: vinculação história–sprint, ordem e capacidade estimada; manter histórico de entradas e saídas.
- `WorkflowDefinition`: identificador, versão, estágios, variantes, especialistas e Quality Gates; apontar para DAI.
- `WorkflowRun`: execução imutavelmente identificada com `workflowDefinitionVersion`, `storyId`, `variant`, `startedAt`.
- `StageRun`: tentativa e resultado de uma etapa, especialista, entradas/saídas e aprovação.
- `Evidence`: `kind`, `uri/path`, hash, agente/origem, proveniência e retenção.
- `AuditEvent`: evento append-only com idempotency key, actor, timestamp, previous state e correlation ID.

**Cardinalidade alvo:** Demand 1:N Story (quando houver split); Story 0:N WorkflowRun; Story N:M Sprint via histórico de alocação (com uma sprint ativa conforme política); WorkflowRun 1:N StageRun; StageRun 0:N Evidence/AuditEvent. Confrontar cardinalidades e IDs com o modelo real.

## 4. Máquina de estados — separação de eixos

| Eixo | Exemplos (propostos) | Dono |
|---|---|---|
| Maturidade da demanda | draft, triage, refining, ready, rejected | Product Backlog |
| Planejamento | unassigned, selected, committed, removed | Sprint Planner |
| Etapa técnica | story, bdd, prototype, modeling, dev, tests, review, commit-pr, deploy | Workflow DAI |
| Execução | queued, running, blocked, waiting_approval, passed, failed | Runtime |
| Raia visual | preservar raia canônica existente, com política de projeção | Scrum existente |

Não sincronizar estados bidirecionalmente sem contrato explícito: exibir derivação no Kanban é diferente de permitir transições. `lanesRevision` e autorização permanecem no serviço Scrum.

## 5. Fluxos obrigatórios

**Fluxo A — ideia:** chat/manual → draft → dedupe → investigação PM/BA/QA → versão da especificação → validação DoR → aprovação PO → Product Backlog refinado → Sprint Planning → Sprint Backlog (`A fazer`) → seleção de variante / workflow.

**Fluxo B — bug urgente:** incidente → triagem → vinculada a história/bug existente ou draft emergencial → hotfix → testes/revisão → autorização explícita de ações de risco → pós-incidente; documentação de exceções e posterior refinamento.

**Fluxo C — design + desenvolvimento:** uma história pode ter subfluxos dependentes ou paralelos. Não assumir que toda story necessita de prototype/modeling; selecionar variante com justificativa.

**Fluxo D — sessão sem story:** registrar execução órfã com reconciliador e prazo, sem impedir desenvolvimento por padrão; modo enforce configurável após maturidade.

## 6. Contrato mínimo de integração (conceitual)

```ts
type WorkflowStart = {
  storyId: string;
  workflowId: string;
  workflowVersion: string;
  variant: string;
  idempotencyKey: string;
  requestedBy: string;
};

type StageEvidenceEvent = {
  eventId: string;
  correlationId: string;
  storyId: string;
  workflowRunId: string;
  stageId: string;
  stageAttempt: number;
  type: 'started' | 'artifact.produced' | 'gate.passed' | 'gate.failed' | 'approval.requested';
  occurredAt: string;
  actorId: string;
  evidenceRefs: readonly string[];
};
```

**Regras:** consumidores idempotentes; versionamento; checkpoint transacional; reconciliação após crash; eventos com provenance; nenhum `gate.passed` sem checks observáveis; aprovação de usuário com identidade e timestamp.

## 7. Quality Gates e proteção

DoR: requisitos, riscos, dependências, critério de aceite verificável, responsável e estimativa quando aplicável. DoD: testes realmente executados, evidências de revisão, doc atualizada e aceite. Commit/PR, push e deploy exigem confirmação explícita conforme regras do DAI, mesmo em automações. Não registrar segredos nem conversas completas por padrão.

## 8. Alternativas de integração (avaliar após inspeção)

1. **Adapter baseado em CLI/arquivos** — menor custo e menor acoplamento, mas precisa reconciliar `_status.md` e processo. Bom MVP.
2. **Adapter via runtime/eventos** — melhor observabilidade e multi-motor; exige evolução de contratos. Alvo recomendado para produção.
3. **Duplicar workflows no Harness** — evitar: risco de divergência de gates e especialistas.

## 9. Dúvidas para review

- Qual é a fonte de verdade das transições do Scrum? Qual schema persiste sprint e raia?
- O workflow `feature-delivery` e o `product-delivery` estão executáveis? Qual commit validado?
- Como exportar execução para Claude, Codex, Gemini e OpenCode sem perder contratos?
- Qual a política de retry e dedupe, e como manter logs contra adulteração?
- Onde registrar aceites humanos e como controlar RBAC?
- O `docs/features/<slug>/_status.md` pode referenciar IDs externos sem quebrar compatibilidade?
- Como evoluir com migração reversível e dupla leitura temporária?
