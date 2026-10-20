# Arquitetura-alvo e contratos

## Princípios

- Evoluir fachadas existentes e manter compatibilidade por vertical.
- Separar domínio, persistência, HTTP e apresentação.
- Isolar dados por `projectSlug` e autorizar no servidor.
- Usar contratos versionados e projeções, sem estado duplicado.
- Manter arquivos autorais abaixo de 300 linhas.

| Módulo | Responsabilidade | Reuso atual |
|---|---|---|
| `chat/core` | sessões, mensagens, streaming, anexos e erros | `chat-send`, `chat-persist`, `chat-store` |
| `chat/context` | referências autorizadas a entidades | `prototype-chat-bridge`; `design-board` |
| `chat/ui` | header, lista, composer, menus e a11y | `chat-render`; `chat-ui-interaction` |
| `chat/layouts` | fullscreen, embedded, floating, minimized | dialog, Studio, miniwidget |
| `workflow/domain` | board, lane, transition, blocker, histórico | novo sobre histórias atuais |
| `traceability` | UI, regra, API, dados, teste e legado | `design-layers`; `project-audit` |
| `automation` | políticas por projeto/raia | event engine e adapters |

## Contratos conceituais

```text
ChatContextRef { kind, id, projectSlug, version? }
ChatPresentation { layout, containerId, capabilities }
ChatCommand { type, chatId, projectSlug, payload, idempotencyKey? }
KanbanBoard { id, projectSlug, version, lanes[] }
KanbanLane { id, name, order, color, description, enabled, hidden }
WorkflowTransition { fromLaneId, toLaneId, roles[], conditions[] }
StoryStatusHistory { storyId, fromLaneId, toLaneId, actor, at, reason? }
StoryBlocker { storyId, originLaneId, reason, owner, openedAt, closedAt? }
ComponentMilestones { prototype, extracted, designSystem, boilerplate, implemented, documented }
TestEvidence { ruleId, kind, artifactRef, executionId?, result?, approvedBy? }
LaneAutomationPolicy { projectSlug, laneId, agentId, skillIds[], trigger, approval }
```

São propostas, não APIs aprovadas. Criar schemas/validators antes de codificar.

## Alternativas

1. JSON versionado: menor mudança e rollback simples; concorrência/consulta limitadas. Recomendado primeiro.
2. SQLite: transações e histórico consultável; adiciona dependência e migration. Avaliar após contratos.
3. Banco remoto: colaboração multiusuário; fora da primeira evolução.

Manter ES Modules nativos evita toolchain. Biblioteca de split/drag só entra se Pointer Events + ARIA não atenderem aos testes.

Fluxo: `UI -> comandos -> domínio -> repositório/adapters`; `motores -> eventos -> event engine -> projeções -> UI`. Domínio não depende de DOM, CSS ou CLI.

