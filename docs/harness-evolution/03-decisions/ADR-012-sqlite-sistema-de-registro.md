---
id: ADR-012
titulo: SQLite as the system of record for application state
status: proposta
data: 2026-11-01
historias: [17.01, 17.02, 17.03, 17.07, 17.08, 17.09, 17.10, 17.11, 17.12, 17.13]
tags: [harness-evolution, adr, sqlite, persistencia]
---

# ADR-012: SQLite as the system of record for application state

## Context

State is spread over about 15 `localStorage` keys, dozens of JSON/JSONL files with mostly non-atomic writes and no locking, markdown chat transcripts, and one SQLite event log (see [inventory](../01-architecture/sqlite-migration-inventory.md)). On 2026-11-01 a Ctrl+F5 lost the OpenCode session binding because the engine session id lived only in the browser. EP-14 already moved screen state to server files and noted that "if scale demands it, the file is swapped for SQLite without changing the HTTP contract".

Facts that make the move low-risk: Node 24 ships `node:sqlite` (no npm package, preserves the "no runtime dependency" profile), the harness already uses it for events (ADR-005, ADR-TEL-001), and the product is local single-host.

Two new requirements need transactional storage: role-based access control (ADR-013) and an action audit trail.

## Decision

1. One global database file, `data/harness.sqlite` (path overridable by `HARNESS_DB_PATH`), WAL mode, `busy_timeout`, `foreign_keys=ON`, forward-only migrations recorded by name in a `schema_migrations` table (`user_version` mirrors the highest), so migrations authored in parallel worktrees can merge in any order. Data is scoped by a `project_id` column, not by a file per project.
2. A single `ui/server/db/` module owns the connection. Services never open the file themselves; they receive repositories. This keeps transactions short and gives one place for the single-writer discipline.
3. Migrate by vertical slices, each behind the existing HTTP contract, with a one-time idempotent importer from the old files and a rollback flag. Order: chat sessions and messages first (it fixes the F5 incident), then screen state, then domain stores, then telemetry and events.
4. Stay on disk, on purpose: curated memory (`memory/**`, ADR-009), `instructions.md`, `context/`, Atelier source files (`screens/*.html`, `styles/*.css`), `docs/`, and the multi-agent ledger (ADR-007) until story 17.13 re-evaluates it. These are agent-readable, diffable in git, and edited by CLIs outside the server.
5. Markdown transcripts become an export generated from the database (17.11), not a source of truth. The importer and `redact` pipeline keep working on the export.
6. The browser keeps only device preferences and a cache. `localStorage` is never the sole holder of anything the server needs to resume work.
7. `data/` is git-ignored. Backups use `VACUUM INTO` plus an integrity check (17.12). Personal data redaction applies on write for chat content, as it does for imports today.
8. Audit and RBAC tables live in the same file but are exempt from every retention sweep (ADR-013).

## Alternatives considered

| Alternative | Pros | Cons |
|---|---|---|
| Keep files, fix atomicity and locks | No migration | Re-implements transactions badly; no queries, no audit, no RBAC joins; the F5 class of bug remains |
| One SQLite file per project (like `events.sqlite`) | Isolation, easy per-project delete | Cross-project users, roles and audit need joins across files; many connections; retention bug already seen |
| Embedded library (`better-sqlite3`) | Faster, richer API | New native dependency and supply-chain surface; breaks "no dependencies" |
| External database (Postgres) | Scale, concurrency | Infrastructure out of proportion for a local single-user harness; breaks autonomous mode |
| Migrate everything, memory and Atelier source included | One store | Loses git diff and CLI/agent editing; high regression risk for little gain |

## Consequences

Positive: atomic writes and one transaction per action; the F5 incident class disappears; queries over chats, scrum and telemetry; a foundation for RBAC and audit; one backup unit.

Trade-offs: schema and migrations need tests; the file is binary and not human-diffable (mitigated by markdown export and `.dump`); concurrent writers must use short transactions; `node:sqlite` is still marked experimental in some Node versions, so the Node floor is pinned and a smoke test runs in CI.

Migration: every story ships an importer and a rollback flag. Nothing is deleted from the old stores without explicit user confirmation, per the global destructive-action rule.

## Review

Revisit if the harness becomes multi-host or multi-user over a network (then reconsider Postgres), or if `node:sqlite` changes its API.
