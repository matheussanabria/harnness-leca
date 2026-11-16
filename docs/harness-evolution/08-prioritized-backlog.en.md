# Prioritized backlog

Português: [Backlog priorizado](08-prioritized-backlog.md).

> Note: the historical and planning claims in this document have not been revalidated as part of the translation.

Language navigation: [README](README.en.md) | [01](01-current-state-audit.en.md) | [02](02-requirements-and-gaps.en.md) | [03](03-target-architecture.en.md) | [04](04-chat-studio-design-system.en.md) | [05](05-product-domains.en.md) | [06](06-data-security-tests.en.md) | [07](07-roadmap-risks-acceptance.en.md) | [08](08-prioritized-backlog.en.md)

Provisional IDs; complexity S/M/L/XL. Each item summarizes the problem/objective, scope, dependency, acceptance criteria, test, and risk.

## P0

- **HAR-001 — Audit (M):** establish an evidence-backed baseline. No dependency. Acceptance: matrix with evidence/validation. Tests: links/gates. Risk: code changes.
- **HAR-002 — Contracts and foundations (L):** schemas, commands, tokens, and layers. Depends on 001. Acceptance: version plus covered adapters. Tests: unit/contract. Risk: premature abstraction.
- **HAR-003 — Chat core/UI (XL):** remove layout-dependent divergence. Depends on 002. Acceptance: parity for SSE, errors, attachments, and history. Tests: integration. Risk: session handling.
- **HAR-004 — Menus/popovers (M):** accessible primitive. Depends on 003. Acceptance: focus, Escape, outside click/mobile. Tests: DOM. Risk: dialogs.
- **HAR-005 — Miniwidget (L):** floating/minimized adapter. Depends on 003/004. Acceptance: same session, no mixing. Tests: two instances. Risk: streams.
- **HAR-006 — Studio resizing (L):** mouse/touch/keyboard and stable preview. Depends on 003. Tests: E2E/visual. Risk: iframe.

## P1

- **HAR-007 — Composer capabilities (M):** equivalent attachments, skills, and actions. Depends on 003. Acceptance by layout. Risk: excessive context.
- **HAR-008 — Lanes/migration (XL):** 12 lanes, transitions, blockers, versioning. Depends on 002. Acceptance: compatibility/idempotency/rollback. Risk: mapping.
- **HAR-009 — Ordering/persistence (L):** edit, hide, disable, and handle concurrency. Depends on 008. Acceptance: order by project. Risk: overwrite.
- **HAR-010 — Transitions/blockers (L):** backend and history. Depends on 008. Acceptance: source preserved. Tests: matrix. Risk: incomplete rule.
- **HAR-011 — Backlog/filters/metrics (L):** single source of truth. Depends on 009/010. Acceptance: no divergence. Risk: performance.
- **HAR-012 — Map fidelity (L):** reproduce screenshots. Depends on references/002. Visual acceptance. Risk: missing assets.
- **HAR-013 — Traceability (L):** end-to-end key and navigation. Depends on 002. Acceptance: selection/links. Risk: incomplete data.
- **HAR-018 — Tests/visual (L):** harness and baselines. Depends on 002 and evolves across workstreams. Risk: fragility.
- **HAR-019 — Security/a11y (L):** threat model, auth, XSS, uploads, focus/ARIA. Cross-cutting. Acceptance: negative tests. Risk: false sense of security.

## P2

- **HAR-014 — Components (L):** independent milestones, references, and history. Depends on 002/013. Acceptance: multiple milestones and context by ID. Risk: inference.
- **HAR-015 — Audit (L):** evidence and four test states. Depends on 013. Acceptance: generated does not mean approved. Risk: backward compatibility.
- **HAR-016 — Agents/skills (XL):** policy by project/lane. Depends on 008/event engine. Acceptance: minimum context/permissions. Risk: privilege.
- **HAR-017 — Triggers/approvals (XL):** idempotent/auditable execution. Depends on 016. Acceptance: no duplication and approval for sensitive actions. Risk: destructive automation.
