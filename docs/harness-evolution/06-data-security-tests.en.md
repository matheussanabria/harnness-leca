# Data, Migration, Security, and Tests

Português: [Dados, migração, segurança e testes](06-data-security-tests.md).

> This translation preserves the document's historical and planned claims as written; they have not been revalidated.

## Proposed migration

1. Versioned backup of `scrum.json`.
2. `schemaVersion` and a compatible reader.
3. Proposal: `todo -> pronto-para-dev`, `in_progress -> em-desenvolvimento`, `review -> em-revisao`, `done -> concluido`; Product must confirm.
4. Generate the board/lanes and initial migration history.
5. Compare counts, points, Sprint, epic, and IDs.
6. Atomic write using a temporary file + rename.
7. Keep the old reader for one version.

Rollback: stop writes, export subsequent events, restore the backup and old reader. No migration has been run.

## Security

Preserve origin/JSON, confinement/`realpath`, redaction, permissions, sanitization, and clean public errors. Review authorization by project; attachment limits/retention; Markdown/HTML; prompt injection; secrets in events/logs/backups; sensitive approval; removal of `frame-ancestors` in preview; CSRF/replay and concurrency.

## Tests

- Unit: schemas, commands, transitions, blockers, projections, sanitization.
- Contract: engines, SSE, events, APIs, and versions.
- Integration: atomic writes, migration/rollback, isolation, and permissions.
- UI DOM: menus, focus, keyboard, composer, and multiple instances.
- E2E: three layouts, Studio, Kanban, and context across modules.
- Visual: Map/Studio at six widths.
- Security: XSS, traversal, origin, upload, prompt injection, and logs.

Gates: `npm run check`, `npm run types`, `npm test`. Add coverage only after a dependency decision. A generated test remains “not run” until there is a verifiable result.

## Harness evolution program

[Program overview](README.en.md) · [01 Current-state audit](01-current-state-audit.en.md) · [02 Requirements and gaps](02-requirements-and-gaps.en.md) · [03 Target architecture](03-target-architecture.en.md) · [04 Chat, Studio, and Design System](04-chat-studio-design-system.en.md) · [05 Product domains](05-product-domains.en.md) · [06 Data, security, and tests](06-data-security-tests.en.md) · [07 Roadmap, risks, and acceptance](07-roadmap-risks-acceptance.en.md) · [08 Prioritized backlog](08-prioritized-backlog.en.md)
