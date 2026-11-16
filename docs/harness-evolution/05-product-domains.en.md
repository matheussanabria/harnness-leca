# Kanban, Map, Components, and Audit

Português: [Kanban, Mapa, Componentes e Auditoria](05-product-domains.md).

> This translation preserves the document's historical and planned claims as written; they have not been revalidated.

## SDLC Kanban

Create a default board with twelve lanes and stable IDs separate from labels. Position is `order`; hiding does not delete; disabling prevents transitions. Blockers are cross-cutting; the lane is an optional projection.

- Every authorized move records history atomically.
- The backend validates transitions.
- Drag and drop and accessible buttons call the same command.
- Counts/points are projections; filters do not alter data.

## Layer Map

The six-tab architecture is reusable. Split CSS by shell, navigation, replica, details, and responsiveness. A stable key connects a field, behavior, rule, endpoint, service, controller, repository, DTO, entity, table/column, test, legacy element, and decision.

Without screenshots, only tokens and a harness can be prepared. Acceptance requires matching images, resolution, scale, content, and state.

## Components

Formalize the current checklist as `ComponentMilestones` and keep `stage` as a projection. Add identity, version, source, owner, and typed references. “In Chat” sends `ChatContextRef` without duplicating text.

## Audit

Separate registered rule, planned scenario, generated artifact, execution, and approval. A Postman collection without assertions is not automated coverage; generation without execution is not success. A legacy decision records its author, date, rationale, and reference.

## AI-First

Policies per lane point to agents/skills. Triggers start disabled. Execution receives an idempotency key, minimal context, inherited permissions, and state `requested/running/succeeded/failed/cancelled/awaiting_approval`.

## Harness evolution program

[Program overview](README.en.md) · [01 Current-state audit](01-current-state-audit.en.md) · [02 Requirements and gaps](02-requirements-and-gaps.en.md) · [03 Target architecture](03-target-architecture.en.md) · [04 Chat, Studio, and Design System](04-chat-studio-design-system.en.md) · [05 Product domains](05-product-domains.en.md) · [06 Data, security, and tests](06-data-security-tests.en.md) · [07 Roadmap, risks, and acceptance](07-roadmap-risks-acceptance.en.md) · [08 Prioritized backlog](08-prioritized-backlog.en.md)
