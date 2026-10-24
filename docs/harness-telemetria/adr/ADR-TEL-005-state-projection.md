---
id: ADR-TEL-005
titulo: "State projection: rebuildable from the log, separate presence/activity/phase, ordering by occurrence time"
status: proposta   # proposed, awaiting user review
data: 2026-10-24
historias: [T05, T1.3, T2.3]
tags: [harness-telemetria, adr]
---

# ADR-TEL-005: State projection

Evidence labels: verified, reproduced, documented, assumption.

## Context

- The office overwrites engine state per chat event: `activeCount = working ? 1 : 0` per engine key; reproduced in Node: A finishes while B streams, the office shows idle and `activeCount` 0; an error in one chat masks the other (A3 F1, F2; `office-agent-telemetry.js:62-66,94-99`). Reproduced.
- The projector folds in arrival order (`seq`) with last-wins and no guard; a late `execution.started` after `execution.succeeded` regresses to `running`; `lastEventAt` is overwritten by an older event (`event-projector.js:34,57`) (A1 section 3 P2). Verified.
- Projections read `limit 5000` while the store keeps 20000, so once the log exceeds 5000 recent events are silently ignored (`event-projector.js:67,100,141`) (A1 section 4). Verified.
- SSE defects: every event in a polled batch is emitted with the batch's last cursor as `id`; `Last-Event-ID` is not read; a pruned cursor returns survivors without a reset signal (`event-stream.js:57-58`) (A1 section 4). Verified.
- Route `GET /sessions/stream` is registered after `GET /sessions/([^/]+)` in a first-match router, so it may be shadowed; unit tests call the controller directly (`router.js:136-137,232-236`) (A1 section 3 P2). Verified in static reading, runtime not executed.
- Presence (online/offline) and fine activity are only specified in story 09.06 (status planejada); the session model has three orthogonal states: execution, workflow, attention (ADR-006) (`session-model.js:8-10`) (A1 section 3 P2). Verified plus documented.
- The office reads `/api/orchestration/stream` (in-memory) and the chat state is a module-level Map; chat and office run in different documents, so chat state likely never reaches the office (A3 F4; `chat-execution-store.js:9-11`, `office-state.js:71`). Verified plus assumption on runtime tabs.
- Server activity for Claude is forced to at least 1 (`agent-activity.service.js:115`) (A3 F5). Verified.
- User decision: chat and office run simultaneously, so the server projection with cross-tab and restart safety is required (plan section 2 item 3).

## Decision

1. Projections are pure functions of the event log: dropping every projection table or cache and replaying yields identical state. No state is stored that cannot be rebuilt. Incremental materialisation is allowed only as a cache keyed by cursor and invalidated by schema version.
2. Presence, activity and workflow phase are separate fields with separate timestamps: `presence` (online/offline/unknown, `lastPresenceAt`), `activity` (idle/working/waiting_approval/error, `lastActivityAt`), `phase` (workflow stage state). One event updates one dimension; none overwrites another. Engine-level aggregates (`activeCount`, counts by status) are derived from per-run state, never set directly.
3. Ordering is by occurrence time `at`, with `seq` as a tie-break, plus terminal precedence: once a run reaches a terminal state (`succeeded`, `failed`, `cancelled`), an older non-terminal event does not regress it; a terminal event with an older `at` still applies if no terminal state exists yet. A genuinely newer `started` for the same `runId` after a terminal opens a new `attemptId`, not a regression.
4. `lastEventAt` is the max `at` seen, never the last applied.
5. Projections page through the whole retained log or maintain incremental state; no silent truncation at 5000.
6. SSE: per-event `id`, honour `Last-Event-ID`, send a `reset` signal when the cursor was pruned so the client reloads the projection.
7. Router-level test proves `/sessions/stream` is reachable; fix ordering if it is shadowed.
8. The office consumes the server projection and SSE, not module state. T0.1 remains an interim fix and the regression test that gates T2.3.
9. Rules for stale state: an activity with no event within a configurable TTL is shown as `unknown`, not `idle`; the TTL value is an open parameter.

## Alternatives considered

| Alternative | Pros | Why rejected |
|---|---|---|
| Fix only the office bridge (per-engine counting map, T0.1) | Small, isolated | Does not survive tab close or restart; chat and office are separate documents (A3 F4); kept as interim only |
| BroadcastChannel between chat and office tabs | No backend change | State lost when the chat tab closes; unverified browser behaviour (A3 option C); not durable |
| Mutable state tables updated by events (no replay) | Fast reads | Cannot be audited or rebuilt; a bug corrupts state permanently |
| Order by arrival (`seq`) only | Already implemented | Late events regress state (verified) |
| Single combined status field | Simple UI | Mixes presence with activity and phase; the cause of override bugs |
| Vector clocks or per-aggregate versions | Strong ordering | Overkill for a single-host log; occurrence time plus terminal precedence solves the reproduced cases |

## Consequences

- Easier: restart, multi-tab and multi-device consistent; debugging by replaying the log; engine aggregates are always consistent with sessions.
- Harder: clock skew between sources affects ordering; `at` from engines (transcripts, OTLP) must be trusted within bounds and clamped against `ingestedAt` for absurd values. Projection code must be tested against ordered and reordered fixtures.
- Cost: full replay or paging touches more rows; incremental caching and retention policy (T5.x) are needed. Resource cost is unmeasured (assumption).
- The `Math.max(..., 1)` in `agent-activity.service.js:115` must be reconciled or removed; whether it is intentional is an open question (A3 section 6).
- Two read models for sessions (JSON registry and event projection) must converge; registry becomes reconciliation input (A1 section 3 P2).

## Verification

- Regression test from the reproduced scenario: two chats on one engine, one finishes, engine stays active with correct count (T0.1 now, then against the projection in T2.3).
- Out-of-order test: `started` arriving after `succeeded` does not regress.
- Replay test: rebuild from the log equals the live projection.
- Paging test: a log of more than 5000 events includes the newest events.
- SSE tests: reconnect mid-batch with `Last-Event-ID` loses no event; pruned cursor yields a reset.
- Router-level test for `/sessions/stream`.
- Restart test: stop and start the server; office state is identical from projection.

## Evidence references

- A3 F1, F2, F4, F5 (`office-agent-telemetry.js:62-66,94-99`, `agent-activity.service.js:115`) - reproduced/verified.
- A1 section 3 P2, section 4 (`event-projector.js:34,57,67,100,141`, `event-stream.js:57-58`, `router.js:136-137,232-236`) - verified (route shadowing: static only).
- A1 `session-model.js:8-10` and 09.06 spec - verified/documented.
- Cross-tab runtime behaviour, clock skew bounds, TTL value - assumption.
