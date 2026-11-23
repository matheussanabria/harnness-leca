---
id: ADR-019
titulo: Feature scopes, explicit context and artifact ownership
status: proposta
data: 2026-11-23
historias: [25.01, 25.02, 25.03, 25.04, 25.05, 25.06, 25.07]
tags: [harness-evolution, adr, escopos, artefatos, projetos]
---

# ADR-019: Feature scopes, explicit context and artifact ownership

## Context

The active project is an implicit global (`projects/.active`) read directly by about 20 services (`project-selection.service.js`, `project-scrum-*`, `prototype-*`, `usage-ingest`, `external-presence` and others). No feature can work without a project, and no artifact can change owner because the owner is encoded in the folder it lives in. ADR-012 already stores state in one database scoped by `project_id`, and ADR-017 treats project config as a pointer, not a copy.

## Decision

1. **Three scopes**, declared per feature in a manifest: `project` (needs one: Scrum, layer map, coverage, deploy), `optional` (works alone, improves with one: chat, Atelier, Canvas, mind map, diary) and `global` (never needs one: consumption, catalog, office).
2. **Explicit context.** Every request and window carries `scope = { projectSlug | null }`. Services receive it and stop reading `.active`. `.active` stays only as "last used project", the selector default. Migration is per feature, optional scope first; `project` features may keep reading `.active` until their turn.
3. **Personal workspace.** `projects/_pessoal/` is a reserved pseudo-project that holds artifacts without a project, in the same format as any project. Storage code gets no `if (!project)` branch. Only global memory applies there.
4. **Artifact registry.** Each artifact has a stable id (`art_<ulid>`), a type, an owner (`project_slug`, with `_pessoal` as the personal owner) and an ownership history. Features register what they create. References and links use the id, never the path.
5. **Reassign and copy.** `reassign(id, newOwner)` is one atomic server operation: validate, list broken references, ask for confirmation, move files, update the row, record `moved_from`. `copy(id, newOwner)` creates a new id with `derived_from`. Neither overwrites at the destination (name collision gets a suffix or a question). A shared read-only link between projects is deferred.
6. Authorization uses ADR-013 permissions (`artifact:reassign`) once 17.06 exists. Until then the local single user is the only actor and the audit record is still written.

## Alternatives considered

| Alternative | Pros | Cons |
|---|---|---|
| Keep `.active` and add a "no project" value | Small change | Hides the coupling; two windows cannot hold different projects |
| Owner derived from the folder path | No registry | Moving changes identity and breaks every reference |
| One database per project | Isolation | Rejected in ADR-012; cross-project move becomes a copy between databases |
| Shared link first, move later | No data move | Creates cross-project dependency and an editing-rights question too early |

## Consequences

- Features become usable alone, which is the entry point for students and short exercises.
- The registry is the single place that knows what exists and who owns it, and it feeds the launcher and the executive report.
- Prototype reassignment is the riskiest case (traceability and exporter services read the project) and ships last (25.07).
- Cost: each migrated service takes a context parameter. This is done in small slices with the HTTP contract unchanged.
