# Harness Evolution — Phase 0

[Leia em português](README.md).

> Historical planning note: this documentation describes the diagnosis and plan recorded on the date indicated by the source. This translation preserves that status and those dates; it is not a new verification of the implementation.

> The epic-based implementation program (EP-00 through EP-11) is in the [master index](00-index.md). This README and documents `01` through `08` are the diagnosis that serves as its source.

This package records the diagnosis and reviewable plan requested on 2026-10-19. No functional changes, migrations, or production configuration are part of this deliverable.

## Recommended decision

Evolve the existing architecture incrementally. The repository already contains reusable modules for chat, Studio, Scrum, Layer Map, components, audit, and orchestration; creating parallel subsystems would increase divergence.

First vertical after approval: the main chat, Studio, and miniwidget sharing the same presentation contract and commands, with tests for menus, resizing, and conversation preservation.

## Documents

1. [Current-state audit](01-current-state-audit.en.md)
2. [Requirements and gaps](02-requirements-and-gaps.en.md)
3. [Target architecture](03-target-architecture.en.md)
4. [Chat, Studio, and Design System](04-chat-studio-design-system.en.md)
5. [Product domains](05-product-domains.en.md)
6. [Data, security, and tests](06-data-security-tests.en.md)
7. [Roadmap, risks, and acceptance](07-roadmap-risks-acceptance.en.md)
8. [Prioritized backlog](08-prioritized-backlog.en.md)

## Checkpoint

Before implementation, confirm: the first vertical's scope; `scrum.json` compatibility; visual references for the Layer Map; and whether Codex is officially included in the multi-engine requirement, since the current code already catalogs it in addition to the three engines cited in the plan.
