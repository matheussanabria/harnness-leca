---
domain: planning
module: product
feature: epics-workspaces-scrum-sessions
summary: Epic docs for EP-04 workspaces, EP-05 Scrum, EP-08 workflows UI, EP-09 sessions center and EP-12 prototype engine.
paths: [docs/harness-evolution/02-epics/EP-04-projetos-workspaces/*.md, docs/harness-evolution/02-epics/EP-05-scrum/*.md, docs/harness-evolution/02-epics/EP-09-observabilidade/*.md, docs/harness-evolution/02-epics/EP-12-prototype-engine/*.md]
keywords: [epic, EP-04, EP-05, EP-08, EP-09, EP-12, stories, ADR]
updated: 2026-10-30
---
# Evolution Epics: Workspaces, Scrum, Sessions, Prototype Engine

| File | Responsibility |
|---|---|
| `docs/harness-evolution/02-epics/EP-XX-*/README.md` | Objective, execution, delivery, acceptance and stories of each epic (EP-00 to EP-12). |
| `docs/harness-evolution/02-epics/EP-05-scrum/05-dev-notas.md` | Architecture of the real DIS sources, provenance decisions and validation evidence. |
| `docs/harness-evolution/02-epics/EP-05-scrum/05.01-migracao-compativel-status.md` | Contract and acceptance of the versioned status-to-lane migration. |
| `docs/harness-evolution/02-epics/EP-05-scrum/05.02-doze-raias-configuraveis.md` | Story, acceptance, architecture and evidence of the 12 configurable lanes. |
| `docs/harness-evolution/02-epics/EP-05-scrum/05.03-reordenacao-horizontal.md` | Story, acceptance and evidence of persisted lane order and optimistic concurrency. |
| `docs/harness-evolution/02-epics/EP-05-scrum/05.04-movimentacao-transicoes.md` | Contract, criteria and evidence of auditable story transitions. |
| `docs/harness-evolution/02-epics/EP-04-projetos-workspaces/05-dev-notas.md` | Decisions and evidence for workspace selection, persistence and templates. |
| `docs/harness-evolution/02-epics/EP-04-projetos-workspaces/04.02-layouts-nomeados.md` | Contract, acceptance and evidence of named layouts published by the Window Manager. |
| `docs/harness-evolution/02-epics/EP-04-projetos-workspaces/04.03-persistencia-contexto-workspace.md` | Contract and acceptance of the per-project snapshot of windows, filters and selected resources. |
| `docs/harness-evolution/02-epics/EP-04-projetos-workspaces/04.04-templates-workspace.md` | Contract and acceptance of the four canonical workspace templates. |
| `docs/harness-evolution/02-epics/EP-04-projetos-workspaces/04.05-protecao-alteracoes-nao-salvas.md` | Contract, acceptance and handoff of the shared unsaved-changes guard. |
| `docs/harness-evolution/02-epics/EP-08-agentes/08.06-ui-workflows.md` | Story of the Workflows tab: catalog, per-step plan, dry run, execution, advance/cancel (EP-08.06). |
| `docs/harness-evolution/02-epics/EP-09-observabilidade/` | Sessions Center dossier: diagnosis, reuse, capabilities, canonical model, workflow, events, UI, integration, roadmap. |
| `docs/harness-evolution/03-decisions/ADR-004-*.md` to `ADR-006-*.md` | Proposed decisions: canonical registry, SQLite persistence and orthogonal states. |
| `docs/harness-evolution/04-test-plans/TP-09-central-sessoes.md` | Acceptance criteria and test strategy of the Sessions Center and orchestration. |
| `docs/harness-evolution/02-epics/EP-12-prototype-engine/` | EP-12 Prototype Engine and multi-framework Design System: README, architecture, contracts, phases F0-F7, stories, F0 reports. |
| `docs/harness-evolution/02-epics/EP-12-prototype-engine/05-dev-notas.md` | EP-12 implementation notes: preserved decisions, M1-M3 milestone evidence, cross-cutting pending items. |
