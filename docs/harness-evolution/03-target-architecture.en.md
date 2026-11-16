# Target Architecture and Contracts

[Leia em português](03-target-architecture.md).

> Historical planning note: this document describes the architecture proposed in the source. This translation preserves the source's status and dates; it is not a new verification of the implementation.

## Principles

- Evolve existing facades and maintain compatibility one vertical at a time.
- Separate domain, persistence, HTTP, and presentation.
- Isolate data by `projectSlug` and authorize on the server.
- Use versioned contracts and projections, without duplicated state.
- Keep authored files below 300 lines.

| Module | Responsibility | Existing reuse |
|---|---|---|
| `chat/core` | Sessions, messages, streaming, attachments, and errors | `chat-send`, `chat-persist`, `chat-store` |
| `chat/context` | Authorized references to entities | `prototype-chat-bridge`; `design-board` |
| `chat/ui` | Header, list, composer, menus, and accessibility | `chat-render`; `chat-ui-interaction` |
| `chat/layouts` | fullscreen, embedded, floating, minimized | dialog, Studio, miniwidget |
| `workflow/domain` | Board, lane, transition, blocker, history | New layer over current stories |
| `traceability` | UI, rule, API, data, test, and legacy code | `design-layers`; `project-audit` |
| `automation` | Policies by project/lane | event engine and adapters |

## Conceptual contracts

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

These are proposals, not approved APIs. Create schemas/validators before coding.

## Alternatives

1. Versioned JSON: smallest change and simple rollback; limited concurrency/querying. Recommended first.
2. SQLite: transactions and queryable history; adds a dependency and migration. Evaluate after contracts.
3. Remote database: multi-user collaboration; outside the first evolution.

Keeping native ES Modules avoids a toolchain. A split/drag library should be added only if Pointer Events + ARIA do not meet the tests.

Flow: `UI -> commands -> domain -> repository/adapters`; `engines -> events -> event engine -> projections -> UI`. The domain does not depend on DOM, CSS, or CLI.
