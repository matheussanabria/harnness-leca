# Roadmap, risks and acceptance

Português: [Roadmap, riscos e aceite](07-roadmap-risks-acceptance.md).

> Note: the historical and planning claims in this document have not been revalidated as part of the translation.

Language navigation: [README](README.en.md) | [01](01-current-state-audit.en.md) | [02](02-requirements-and-gaps.en.md) | [03](03-target-architecture.en.md) | [04](04-chat-studio-design-system.en.md) | [05](05-product-domains.en.md) | [06](06-data-security-tests.en.md) | [07](07-roadmap-risks-acceptance.en.md) | [08](08-prioritized-backlog.en.md)

| Phase | Deliverable | Dependency | Complexity / uncertainty |
|---|---|---|---|
| 0 | Audit and plan | none | M / missing screenshots |
| 1 | Tokens, schemas and characterization | F0 | M |
| 2 | Modal chat/Studio/widget | F1 | XL / concurrency |
| 3 | SplitPanel and responsive Studio | F2 | L |
| 4 | Workflow JSON and migration rehearsal | F1 | XL / Product |
| 5 | Kanban and backlog | F4 | XL |
| 6 | Faithful/traceable Map | F1 + references | L |
| 7 | Components/audit | F1 | L |
| 8 | Agents/skills | F4 + orchestration | XL / security |
| 9 | Hardening/rollout | previous phases | L |

F1 may prepare contracts in parallel; parallel implementation only begins after the contracts are approved.

| Risk | Mitigation | Rollback |
|---|---|---|
| Lost conversation | characterization and adapter | flag by layout |
| Scrum breakage | versioning, backup, atomic write | backup/old reader |
| Duplicate execution | idempotency and states | disable triggers |
| Permission escalation | backend and approval | block by policy |
| Visual regression | baseline by state | previous stylesheet |
| Global CSS | tokens/modules | previous import |
| JSON concurrency | review/ETag or lock | reject conflict |

## Global acceptance criteria

- No second chat system.
- Mutating operations validate project, permission, and version.
- State/history remain consistent after failure and reload.
- Essential flows work with keyboard and screen reader.
- Six viewport widths have no critical clipping.
- Migration is idempotent and rollback has been rehearsed.
- Tests distinguish planned, generated, executed, and approved.
- No unauthorized secrets/PII in logs and artifacts.
- Gates and demonstration are reproducible by phase.

The first implementation may proceed only after chat contracts, layout baselines, and the concurrency decision are in place. Screenshots are required for the Map; Kanban is excluded from the first vertical slice.
