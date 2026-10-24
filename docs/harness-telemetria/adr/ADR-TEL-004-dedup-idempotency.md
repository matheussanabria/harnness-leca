---
id: ADR-TEL-004
titulo: "Dedup and idempotency: idempotencyKey per event, callId per model call, streaming upsert"
status: proposta   # proposed, awaiting user review
data: 2026-10-24
historias: [T04, T1.2, T3.1]
tags: [harness-telemetria, adr]
---

# ADR-TEL-004: Dedup and idempotency

Evidence labels: verified, documented, assumption.

## Context

- Dedup exists only by event `id` (`id TEXT UNIQUE`; pre-check SELECT then INSERT, `event-store.js:66,120-123`; test `central-events.test.js:39-65`). Verified.
- `id` defaults to `crypto.randomUUID()` (`event-store.js:96`), so a replayed import without stable ids duplicates. Fact-level dedup (`source.fingerprint`, repeated-transition suppression) is documented but not implemented (`05-eventos-notificacoes.md:49,55-61`). Verified plus documented.
- The race between SELECT and INSERT is safe in one process (`DatabaseSync` is synchronous) but a second writer process could throw on UNIQUE, which is not handled (A1 section 3 P1). Verified code, multi-process risk is an assumption.
- `publishDiscovered` republishes all scanned sessions with random UUIDs when any one is new, so existing sessions get duplicate `session.discovered` events (`session-registry-orchestrator.service.js:18-23`). Verified.
- Legacy accounting has no call id; `exec-<Date.now()>` is not idempotent; no dedupe on append or read (A2 section 6, 9 rule 3). A Local-First chat can yield an HIA line and a shadow line with nothing linking them (A2 section 3). Verified; the double-count overlap is an assumption.
- Engines emit usage in different shapes: Claude `api_request` events and transcript `message.usage` (documented, observed), Codex rollout `token_count` entries (observed), cumulative or incremental depending on source (A5 section 2.1, 2.2).
- Resends and re-imports happen: transcripts are re-read, OTLP exporters retry, discovery rescans.

## Decision

1. Every event carries an `idempotencyKey`, stable per logical fact and derived deterministically from source identity, not from time of ingestion. The store enforces uniqueness on `(source, idempotencyKey)`. A replay is a no-op, not an error: `INSERT ... ON CONFLICT DO NOTHING` semantics, removing the SELECT-then-INSERT race.
2. When a caller supplies no key, the ingest function derives one from a documented tuple per event type (for example engine instance, native session id, native message or call id, event type, occurrence time). If no stable tuple exists, the event is accepted with `relation=unknown` and flagged `dedup=weak`; it is never silently randomised.
3. Each model call has a `callId`: the native request or message id when the engine provides one, otherwise a harness-derived id from the stable tuple. `usage.observed` events are unique per `callId` plus observation `semantics` (ADR-TEL-006).
4. Streaming updates upsert by `callId`: later `cumulative` observations of the same call replace earlier ones in the projection; a `final` observation closes the call and later non-final observations are ignored. `delta` observations are summed within a call only until a `final` or `cumulative` arrives for it.
5. All aggregations count unique `callId`; a parent run never adds its children's usage on top of their own events.
6. Legacy importer keys: `legacy:<file>:<executionId or correlationId>`; ids that are collision-prone (`exec-<Date.now()>`) combine file, id and line hash.
7. `publishDiscovered` is fixed to publish only newly inserted sessions with a key derived from the canonical session id.

## Alternatives considered

| Alternative | Pros | Why rejected |
|---|---|---|
| Keep event-`id` dedup only | Already works for same id | Does not cover re-observation without stable ids (A1 section 6) |
| Content hash of the full payload as key | No caller coordination | A streaming update with changed totals gets a new hash and duplicates; clock-dependent fields break replay |
| Dedup at read time (DISTINCT in queries) | Store stays simple | Costs every read, hides duplicates in raw data, retention and compaction see inflated rows |
| Application-level locking around SELECT-then-INSERT | Minimal change | Does not help multi-process writers; DB constraint is the correct place |
| Append every streaming snapshot and take the max | Simple writes | Max is wrong after resets or restarts of cumulative counters; volume grows |

## Consequences

- Easier: replays, re-imports and exporter retries are safe; usage totals are reproducible from the log.
- Harder: each adapter must define its stable tuple and test it; a wrong tuple either duplicates or drops real events. Weak-key events need a visible quality flag.
- Schema: new column plus unique index on `(source, idempotencyKey)`; migration must dedupe or tolerate existing rows (existing rows get a key from their `id`).
- Upsert semantics apply to projections and usage rollups, not to the append-only event log, which keeps every observation.

## Verification

- Replay test: ingest the same fixture twice, row count and projections unchanged.
- Streaming-then-final test: deltas then cumulative then final yield one call with the final totals, not the sum of all.
- Reset test: a cumulative counter that restarts lower is recorded as a new observation with a flag, not as a negative delta.
- Two-process write test (or simulated UNIQUE collision) does not throw.
- `session.discovered` test: one new session among five publishes one event.
- Legacy importer run twice is a no-op the second time.

## Evidence references

- A1 `event-store.js:66,96,120-123`; `session-registry-orchestrator.service.js:18-23`; `central-events.test.js:39-65` - verified.
- A1 `05-eventos-notificacoes.md:49,55-61` - documented (planned, not implemented).
- A2 section 3, 6, 9 - verified.
- Engine usage shape per source (A5 section 2.1, 2.2) - documented/observed; cumulative vs delta per engine - assumption to confirm per adapter fixture.
- Multi-process writer risk, HIA vs shadow double count - assumption.
