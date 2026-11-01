---
domain: planning
module: product
feature: scrum-traceability-plan
summary: Plan-only dossier for Scrum traceability and the Delivery Orchestrator: evidence, design, contracts, backlog.
paths: [docs/scrum-traceability/*.md, docs/scrum-traceability/00-input/*.md, docs/scrum-traceability/00-input/v4/*.md, docs/scrum-traceability/01-discovery/*.md]
keywords: [scrum, traceability, delivery orchestrator, DAI, events, audit, EP-18, ADR-014, story, evidence]
updated: 2026-11-01
---
# Scrum Traceability and Delivery Orchestrator Plan (planning only, no code)

| File | Responsibility |
|---|---|
| `docs/scrum-traceability/02-DIAGNOSTICO-ATUAL.md` | AS-IS of Harness and DAI with evidence, premise corrections and answers to the seven review questions. |
| `docs/scrum-traceability/03-COMPARATIVO-DAI.md` | Capability comparison and reuse/adapt/build/discard and responsibility matrices. |
| `docs/scrum-traceability/04-ARQUITETURA-PROPOSTA.md` | TO-BE components, sequences, entity model, state axes and adapter options. |
| `docs/scrum-traceability/05-DECISOES-E-TRADEOFFS.md` | Storage alternatives, ID, commit and actor decisions, draft ADR-014. |
| `docs/scrum-traceability/06-MODELO-DADOS-E-EVENTOS.md` | IDs, scrum.json changes, trace.* event contract, idempotency, replay, retention. |
| `docs/scrum-traceability/07-MATRIZ-ESTADOS-E-GATES.md` | State axes, transitions, DAI gate mapping, authorization and risk confirmation. |
| `docs/scrum-traceability/08-BACKLOG-IMPLEMENTACAO.md` | Epic EP-18 stories, MVP recommendation and read-only spikes. |
| `docs/scrum-traceability/09-PLANO-TESTES-E-ROLLBACK.md` | Test matrix with repo commands, rollback per phase, observability. |
| `docs/scrum-traceability/10-LACUNAS-E-PERGUNTAS.md` | Facts vs hypotheses, unknowns, blocking questions, flaws found and future PR instructions. |
| `docs/scrum-traceability/11-REALINHAMENTO-EP-17.md` | Realignment with EP-17: trace tables in harness.sqlite plus audit rows, story-by-story re-targeting, parallel track and requests to EP-17. |
| `docs/scrum-traceability/00-input/CONTEXTO-SCRUM-TRACEABILITY.md` | Original context document supplied by the user (unmodified copy). |
| `docs/scrum-traceability/00-input/PLANO-REVISAO-SCRUM-TRACEABILITY.md` | Original review plan supplied by the user (unmodified copy). |
| `docs/scrum-traceability/00-input/v4/` | The v4 review package (instructions, repository config, Delivery Orchestrator and DAI documents). |
| `docs/scrum-traceability/01-discovery/raw-scrum-core.md` | Verified evidence: Scrum persistence, lanes, transitions, API. |
| `docs/scrum-traceability/01-discovery/raw-agents-coordination.md` | Verified evidence: coordination ledger, sessions, telemetry, hooks. |
| `docs/scrum-traceability/01-discovery/raw-git-tests-memory-mapa.md` | Verified evidence: Git, tests, memory, map, Jira, conventions. |
| `docs/scrum-traceability/01-discovery/raw-harness-sprint-workflow.md` | Verified evidence: sprint model, orchestration engine, approvals, identity. |
| `docs/scrum-traceability/01-discovery/raw-dai-pipeline.md` | Verified evidence: DAI agents, pipeline, workflows, validators, rules. |
| `docs/scrum-traceability/01-discovery/raw-dai-stories-gates.md` | Verified evidence: DAI story templates, DoR, gates, export, Scrum overlap. |
