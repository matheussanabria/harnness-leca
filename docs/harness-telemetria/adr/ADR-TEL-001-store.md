---
id: ADR-TEL-001
titulo: "Telemetry store: extend the EP-09 SQLite event log"
status: proposta   # proposed, awaiting user review
data: 2026-10-24
historias: [T01, T1.2, T1.3, T1.4]
tags: [harness-telemetria, adr]
---

# ADR-TEL-001: Telemetry store - extend the EP-09 SQLite event log

Evidence labels: verified (read in code), documented (external or project doc), assumption.

## Context

- EP-09 already provides a working event log: SQLite via `node:sqlite` per project at `projects/<slug>/coordination/events.sqlite`, monotonic `seq` cursor, `id TEXT UNIQUE` dedup, three projections, SSE stream (A1 section 1 and section 3 P1; `event-store.js:13,61,65-66,120-123`). Verified.
- It carries no usage, cost, call, skill or engine-adapter data; the only producer is `session.discovered` (A1 section 1, `session-registry-orchestrator.service.js:17-34`). Verified.
- The legacy telemetry JSONL files are not reusable: absent numbers become 0 on write and read, the schema is orphaned, the two files cannot be joined, readers re-parse the whole file per request (A2 section 3, 4, 5; `runtime/telemetry.js:51-56,86-87`, `hia/telemetry.js:59-60`). Verified.
- The office reads a second, in-memory event system (1000 events, lost on restart) that does not write to `events.sqlite` (A1 section 1, A4 section 0 item 1; `event-engine.js:14,112`). Verified.
- Count-based retention (20000 events per project, delete-oldest on every insert) would evict usage evidence (A1 section 3 P5; `event-store.js:14,149-154`). Verified.
- No `user_version` or migration mechanism exists (`CREATE TABLE IF NOT EXISTS` only) (A1 section 4). Verified.
- Ownership: user decision 1 of 2026-10-23, "extend EP-09 additively" (plan section 2). The Central read contract freezes the envelope field set; additive change needs notice to the 09.02 and 09.03 owners (A1 section 5, `10-contrato:80-92,100-108`). Documented.
- ADR-005 (local persistent log, SQLite + SSE) is assumed to hold; its text was not read (A1 section 8 question 3). Assumption.

## Decision

1. The EP-09 SQLite event log is the single canonical store for telemetry. No second store is created.
2. Usage evidence (`usage.observed`) lives in the same database file, with a separate retention class: the 20000-event count cap applies to operational events only; `usage.observed` is retained by time and size policy defined in T5.x, and compaction must preserve per-`callId` final values.
3. Schema evolution is additive: new nullable columns and payload-envelope fields (see plan section 3), no rename or removal of existing fields, versioned through SQLite `PRAGMA user_version` with idempotent forward migrations.
4. The in-memory orchestration `eventEngine` is bridged into the store (ADR-TEL-002) and later retired as a feed; it may stay as a live cache.
5. Legacy JSONL (`hia-executions`, `runtime-shadow`) is imported once by an idempotent importer, marked `origin=legacy`, quality unknown (ADR-TEL-006). Nothing is deleted without explicit user confirmation.
6. `events.sqlite` must be confirmed git-ignored before any usage data is written to it (open check, see Verification).

## Alternatives considered

| Alternative | Pros | Why rejected |
|---|---|---|
| Second dedicated telemetry store (new SQLite or JSONL) | Isolation, no coupling to the frozen Central contract | Two sources of truth for sessions and runs; the office and Central would need joins across stores; contradicts user decision 1 |
| Unify with the EP-08.04 `event-contract.js` and its in-memory store | One vocabulary (`correlationId`, `parentExecutionId`) | In-memory, 1000 events, lost on restart; no persistence or cursor; would require building persistence there, duplicating EP-09 |
| Full observability platform (OTel collector + Prometheus/Tempo/Loki or similar) | Mature tooling, dashboards | Cost in RAM, disk and operations for a local single-user harness; the plan lists resource budget as a constraint (plan section 6, T5.x); new daemon and dependency supply-chain surface |
| Reuse legacy JSONL files | No new code | Zero-for-missing coercion, no join key, full-file parse per request (A2 section 4-5) |
| Separate table for usage in a different DB file | Retention isolation without schema work in the log | Breaks atomic replay and single backup unit; same DB with a retention class achieves the isolation |

## Consequences

- Easier: one cursor, one replay, one SSE channel, one backup unit; usage and sessions are joinable by id.
- Harder: the store becomes a hot shared contract; schema edits need a single owner and no parallel edits (plan section 7, wave 2). Migrations must be written and tested.
- Migration: add `user_version` handling, new columns, importer for legacy logs, retention class split. Notice to 09.02 and 09.03 owners before envelope change.
- Risk: SQLite single-writer under heavy per-call usage events; mitigated by batching in adapters (to be measured in T5.x, assumption).
- Risk: SELECT-then-INSERT dedup can throw on UNIQUE when two processes write (A1 section 3 P1); fixed in T1.2 with `INSERT ... ON CONFLICT` semantics.

## Verification

- Migration test: open a DB created by the current code, run the migration, assert existing events are readable and `user_version` is set; run it twice (idempotent).
- Retention test: insert more than the operational cap of other events and assert `usage.observed` rows survive.
- Importer test: run twice over a fixture of both legacy files, assert row count unchanged on the second run and every imported row has `origin=legacy`.
- Check `git check-ignore projects/<slug>/coordination/events.sqlite` before T3.1 ships.
- Baseline CPU, RAM and disk with telemetry on and off (plan section 8) before T5.

## Evidence references

- A1 `event-store.js:13,61,65-66,120-123,149-154`; `session-registry-orchestrator.service.js:17-34` - verified.
- A2 `runtime/telemetry.js:51-56,86-87`; `hia/telemetry.js:59-60` - verified.
- A4 `event-engine.js:14,112`; `event-stream.js:92` - verified.
- A1 section 5 contract freeze (`10-contrato:80-92,100-108`) - documented.
- ADR-005 holds - assumption.
