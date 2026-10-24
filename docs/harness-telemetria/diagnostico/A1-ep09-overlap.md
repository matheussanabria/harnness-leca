# A1 - Overlap between the telemetry pre-plan and the existing EP-09 observability

Commit analysed: `41d6cd58940d58211a48a3231f11846dcb721920` (branch `main`, matches `git log` head 41d6cd5). Resolved by reading `.git/HEAD` and `.git/refs/heads/main` because no shell was available; `git rev-parse HEAD` was not executed. Working tree has one untracked file (the pre-plan itself).
Mode: read-only. No test was executed; every "verified-in-code" label means static reading of the source.

Label legend: **V** = verified-in-code, **D** = documented (doc says so; code not checked or not present), **A** = assumption.
Status legend: EXISTS / PARTIAL / MISSING / CONFLICT.

## 1. What EP-09 actually is (scope of the baseline)

- Event store: `ui/server/services/events/event-store.js` - SQLite (`node:sqlite`) per project at `projects/<slug>/coordination/events.sqlite` (`event-store.js:13,61`). V
- Projector: `event-projector.js` - three projections: sessions, workflow executions, attention (`:66,:99,:140`). V
- Stream: `event-stream.js` - SSE polling the store every 1 s (`POLL_MS`, `:11,:53-65`). V
- API: `central-events.controller.js` + `central-events.routes.js` - `GET/POST /api/project/:slug/events`, `GET /projections`, `GET /sessions/stream`. V
- Canonical sessions (read model of "who a session is"): `canonical-sessions/session-model.js`, `session-registry.service.js` (JSON file `projects/<slug>/canonical-sessions.json`, `:10`), `session-reconciler.service.js`, discovery only for Markdown chats (`discovery/markdown-discovery.js`). V
- Only producer wired into the event log: `session-registry-orchestrator.service.js:17-34` publishes `session.discovered` (and only when `inserted > 0`, `:18`). 09.02 doc admits workflows/approvals do not publish yet (`09.02-event-log-sse.md:119`). V + D
- No usage, token, cost, tool, skill, call or engine-adapter data exists in EP-09. 09.06 (engine monitor) is status `planejada` (`09.06-...md:6`). D

Important: a SECOND, unrelated event system exists: `ui/server/services/orchestration/event-contract.js` (EP-08.04), with its own `HarnessEvent` (`timestamp`, `receivedAt`, `schemaVersion`, `taskId`, `agentId`, `parentExecutionId`, `correlationId`, `causationId`, `source.sourceEventId`, `:15-30`), served by `/api/orchestration/events|stream` (`router.js:142,145`). It does not write to `events.sqlite` (grep: only the canonical-sessions orchestrator requires `event-stream`). The Office subscribes to `/api/orchestration/stream` (`ui/public/js/office-state.js:71`), not to the EP-09 stream. V

## 2. Matrix by entity (pre-plan section 4)

| Entity | Pre-plan phase | Existing in EP-09 / repo | Status | Evidence | Label |
|---|---|---|---|---|---|
| Projeto / tarefa | P1 | `projectId` in envelope (`event-store.js:34,104`, defaults to slug). `taskId` only in orchestration contract (`event-contract.js:23`), not in EP-09 envelope; workflow `executionId` plays the task role | PARTIAL | `event-store.js:104`; `event-contract.js:23` | V |
| Motor / instancia | P1,P3 | `source.provider` string only (`event-store.js:99-102`). No `hostId`, no `engineInstanceId`. `engine.presence.changed` is only specified | MISSING (code); specified in 09.06 | `09.06:51` | V + D |
| Provedor / modelo | P3 | `primaryProvider` per session; `provider` per `ProviderSession`. No model field anywhere in EP-09 | MISSING (model), PARTIAL (provider) | `session-model.js:53,95-106` | V |
| Sessao | P1,P2 | Canonical `id` = fingerprint `provider|nativeSessionId|sourceKind` lowercased (`session-model.js:20-24`; reconciler uses it as id `:79,92,105`). `nativeSessionId` kept per provider session (`:97-106`). Context by engine instance is absent (no host/instance in fingerprint) | PARTIAL | as cited | V |
| Agente | P4 | No `agentId` in EP-09. Exists only in orchestration contract (`event-contract.js:25`) and Office agent keys (`AGENT_KEYS` = engines, not agents) | MISSING in EP-09; CONFLICT of concept (Office "agent" = engine) | `office-agent-telemetry.js:62-66` | V |
| Execucao | P1,P4 | `executionId` column + index (`event-store.js:74,79`); `execution.started/succeeded/failed/cancelled` projected (`event-projector.js:33-35,119-121`). No `runId`, `parentRunId`, `traceId`; `parentExecutionId`/`correlationId`/`causationId` exist only in the orchestration contract | PARTIAL / CONFLICT (two vocabularies) | as cited | V |
| Workflow / execucao | P4 | `workflow.transitioned/blocked/unblocked` projected into session and `projectWorkflows` (`event-projector.js:36-44,99-132`); `workflowId` taken from first event payload (`:110`). No definition versioning, no `workflowRunId` | PARTIAL | `event-projector.js:110` | V |
| Etapa / tentativa | P4 | `stageId` kept as last-wins scalar (`:123`); approvals appended (`:126-128`). No `stepRunId`, `attemptId`, retries, parallelism | MISSING (stage: PARTIAL) | `event-projector.js:122-128` | V |
| Skill / aplicacao | P4 | None. `skill.*` events absent from catalogs. Only "Ferramentas e Skills" comment with `tool.*` in orchestration catalog (`event-contract.js:56-59`) | MISSING | grep: no `skillApplication` anywhere in code | V |
| Chamada | P3 | None in EP-09. Separate legacy telemetry: `tools/lib/runtime/telemetry.js` (`correlationId` defaults to `"unknown"`, `:43`) | MISSING in EP-09 | `telemetry.js:43` | V |
| Observacao de uso | P3 | None in EP-09. Legacy aggregation uses `item.tokensPrompt \|\| 0` (zero-for-missing, `telemetry.js:100-102`) which contradicts pre-plan rule 6.1.5 | MISSING in EP-09; CONFLICT in legacy | `telemetry.js:100-102` | V |

## 3. Matrix by pre-plan phase

### P1 - Foundation (versioned contract, identities, relations, persistence, dedup)

| Item | Status | Evidence | Label |
|---|---|---|---|
| Persistent store with monotonic cursor | EXISTS | `seq INTEGER PRIMARY KEY AUTOINCREMENT` (`event-store.js:65`); cursor = `String(seq)` (`:141-143`) | V |
| Event idempotency by event id | EXISTS | `id TEXT UNIQUE` (`:66`); pre-check SELECT then INSERT (`:120-123`); test `central-events.test.js:39-65` | V |
| Race in dedup (SELECT-then-INSERT, UNIQUE violation not caught) | PARTIAL | `:120-141`; `DatabaseSync` is synchronous so single-process is safe; two processes could throw on UNIQUE (not handled). Doc admits cross-process order = commit order (`09.02:108`) | V (code) / A (multi-process risk) |
| Caller-supplied id required for dedup | PARTIAL | `id` defaults to `crypto.randomUUID()` (`:96`): a replayed import without stable ids duplicates. Planned `source.fingerprint` is not implemented (`05-eventos-notificacoes.md:49,56-58`) | V + D |
| Envelope versioning (`schemaVersion`, `payloadVersion`) | MISSING | Envelope has neither (`event-store.js:28-38`, DB columns `:64-76`); planned in `05-eventos...:45-53` | V + D |
| Occurrence vs ingestion timestamps | MISSING | Single `at`, defaulting to now (`:98`). Orchestration contract has `timestamp`+`receivedAt` (`event-contract.js:19-20`) | V |
| Relations: `parentRunId`, `traceId`, `runId`, `workflowRunId`, etc. | MISSING in EP-09 | Only `sessionId`, `executionId`; `payload` is free-form JSON, no relation columns or indexes beyond those two (`:78-79`) | V |
| Relation vocabulary reuse | CONFLICT | Orchestration contract already names `correlationId`, `causationId`, `parentExecutionId` (`event-contract.js:26-28`); pre-plan proposes `parentRunId`, `traceId`. Same concept, three names, two event stores | V |
| Type catalog validation | MISSING | `normalizeEvent` accepts any `type` string (`:92-93`); no allowlist, no payload validation, `trust` limited to `observed|inferred|declared` (`:25`). Contract doc says `observed`/`inferred` only (`10-contrato:94`) | V; CONFLICT (code accepts `declared`, contract does not) |
| Sanitization / secret guard at ingest | MISSING | `POST /events` stores `body.payload` as-is, 256 KB cap (`central-events.controller.js:101`); doc rule "no secrets in log" is not enforced in code (`09.02:52`) | V |
| Absent value vs zero | N/A in EP-09 | No numeric usage fields yet; payload is opaque | V |
| Skill/workflow hooks "foreseen" in contract | PARTIAL | Workflow types exist; `skill.*` do not. Free-form `type` means adding them needs no schema change | V |

### P2 - Activity (session registry, backend projection, Now view)

| Item | Status | Evidence | Label |
|---|---|---|---|
| Session projection keeps two sessions of the same engine independent | EXISTS (projector level) | `projectSessions` groups by `event.sessionId` (`event-projector.js:70-73`); `provider` is just an attribute (`:30`). Sessions with distinct ids never share state. Not covered by a dedicated test (tests use one `s1`; `central-events.test.js:116-126`) | V (code) / A (untested) |
| ... but nobody feeds it per-session activity | MISSING | Only `session.discovered` is published (`orchestrator:23`). No producer emits `execution.*` per session for live chats; 09.02 says so (`:119`) | V + D |
| Pre-plan bug (engine state overwritten) lives outside EP-09 | CONFIRMED (reading) | `syncAgentFromChatExecution` sets `activeCount` 0/1 per `agentKey` (`office-agent-telemetry.js:62-66`); subscription uses `snapshot.currentEngine` (`:95-97`). Server side `agent-activity.service.js:115` hardcodes `Math.max(x ? 1 : 0, 1)` so Claude is always at least 1 (always-active) | V (reading); not reproduced |
| Presence vs activity vs phase separation | PARTIAL | Session model has 3 orthogonal states: execution / workflow / attention (`session-model.js:8-10`, ADR-006). Presence (`online/offline`) and fine activity (`lendo`, `pensando`...) only specified in 09.06 (status planejada) | V + D |
| Last-activity vs last-presence timestamps | MISSING | Only `lastEventAt` / `lastObservedAt` (single clock) (`event-projector.js:57`; `session-model.js:58`) | V |
| State on stale / out-of-order events | MISSING | Projector folds in `seq` (arrival) order and last-wins with no guard: a late `execution.started` after `execution.succeeded` regresses to `running` (`:34`); `lastEventAt` is overwritten by the latest applied event even if its `at` is older (`:57`). No terminal-state stickiness | V |
| Engine-level aggregate "3 running, 2 waiting" | MISSING | No projection by provider/status counts for sessions. Registry `readCentral` counts by `executionStatus` from the JSON registry, not from the event log (`orchestrator:110-116`) | V |
| Collection continues with UI closed | EXISTS (server-side) | Store and SSE are server-side; no browser dependency. But collection of live activity is not wired (see above) | V |
| Two read models for the same sessions | CONFLICT | JSON registry `canonical-sessions.json` (`GET /sessions`) and event projection (`GET /projections`) both expose session state; `readCentral` reads only the registry (`orchestrator:79`) | V |
| Route shadowing | CONFLICT | `GET /api/project/:slug/sessions/stream` is registered after `GET .../sessions/([^/]+)` (`router.js:136-137`; regexes `canonical-sessions.routes.js:12`, `central-events.routes.js:13`). Router is first-match (`router.js:232-236`), so `stream` is likely captured as session id `stream`. HTTP tests call the controller directly, not the router (`central-events-http.test.js:135`) | V (static reading) / A (not executed) |

### P3 - Engines and consumption (adapters, tokens, prices, quality)

| Item | Status | Evidence | Label |
|---|---|---|---|
| Engine adapters feeding EP-09 | MISSING | Discovery has a single port, Markdown (`session-discovery.service.js`, `markdown-discovery.js`); orchestration adapters (`claude/gemini/opencode/services-adapter.js`) emit the other contract | V |
| Token / cache / reasoning / cost fields | MISSING | None in EP-09 envelope or projections | V |
| Null vs zero semantics | MISSING (EP-09); CONFLICT (legacy) | `telemetry.js:100-102` | V |
| Price tables, currency, estimated/reported/billed | MISSING | grep found no such structure in EP-09 | V |
| Per-call accounting and no double count of totals | MISSING | No call entity; payload opaque | V |
| Coverage as a metric | MISSING | No denominator concept; 09.06 RF9 only requires evidence per state (`09.06:50`) | V + D |
| Model/provider per call | MISSING | see entity table | V |

### P4 - Orchestration, skills, workflows

| Item | Status | Evidence | Label |
|---|---|---|---|
| Delegation chain across engines (parent/child) | MISSING in EP-09 | No parent field in envelope or projection. Orchestration contract has `parentExecutionId` but no consumer joins it with `events.sqlite` | V |
| Workflow run + step + attempt model | PARTIAL | `projectWorkflows` per `executionId`, last-wins `stageId`, approvals list (`event-projector.js:99-132`). Run history lives separately in `workflow-run-store.js` (EP-08.05, no `runId`/`parentRunId` fields found by grep) | V |
| Workflows publish to the log | MISSING | `09.02:119` (deferred to 09.04) | D |
| Approvals | PARTIAL | `approval.requested/resolved` projected only as history rows (`:126-128`); attention queue exists (`:140-166`); central approval queue is 09.05 (`05-eventos...:85-93`) | V + D |
| Skill events and application evidence | MISSING | see entity table | V |
| Instrumentation without relying on LLM self-report | A | EP-09 is passive: discovery reads files, publish is an open loopback POST | A |

### P5 - Views and operation

| Item | Status | Evidence | Label |
|---|---|---|---|
| Central list/kanban | PARTIAL | Stories 09.03/09.04/09.05 exist; 09.03 front-first with mock until real client (`10-contrato:112`); 09.02 notes Central does not subscribe yet (`09.02:120`) | D |
| Office consuming EP-09 data | CONFLICT | Office reads `/api/orchestration/stream` (`office-state.js:71`) and engine-level summary (`office-agent-telemetry.js:73-87`) | V |
| Retention / rotation | PARTIAL | Count-based prune at 20000 events per project (`event-store.js:14,149-154`), executed on every insert. No time-based retention, no compaction, no per-type policy; `05-eventos...:110-111` plans configurable retention and compaction that preserve final state | V + D |
| Alerts | PARTIAL | Attention items by explicit `attention.*` events only; no policy-derived items (stale, failure) in code (`:140-166`) vs plan (`05-eventos...:73-81`) | V + D |
| Access control | PARTIAL | Publish and stream limited to loopback (`controller:74,93`); `GET /events` and `/projections` have no loopback check although doc RF11 says reads are "in the same scope" (`09.02:46`) | V |
| Resource budget measurement | MISSING | No benchmark or metrics of the store/stream | V |
| Slow consumer / backpressure | PARTIAL | Each SSE connection polls independently (1 s, batch 200) so a slow client does not block ingestion; `res.write` return value ignored (`event-stream.js:57-61`) | V |

## 4. Cross-cutting questions asked in the task

**Identities and relations.** EP-09 has `id`, `type`, `sessionId`, `executionId`, `projectId` only (`event-store.js:28-38`). `parentRunId`, `traceId`, `runId`, `workflowRunId`, `stepRunId`, `attemptId`, `skillApplicationId`, `callId`, `agentId`, `hostId`, `engineInstanceId` are absent from all EP-09 code. Closest existing names live in the other contract: `correlationId`, `causationId`, `parentExecutionId`, `agentId`, `taskId`. V.
Session identity is composed `provider|nativeSessionId|sourceKind` (`session-model.js:20-24`); the pre-plan wants native id scoped by engine and instance. Instance/host are missing, so two hosts or two OpenCode instances with equal native ids would collide. V (code) / A (practical occurrence).

**Idempotency and dedup.** Event-id dedup exists and is tested. Fact-level dedup (`source.fingerprint`) and "ignore repeated transitions" are documented (`05-eventos...:55-61`) but not implemented. Session discovery dedups at fingerprint level in the registry/reconciler, not in the log; `publishDiscovered` republishes ALL scanned sessions with a random UUID whenever any one was inserted (`orchestrator:18-23`), so one new session duplicates `session.discovered` for existing ones. V.

**Out-of-order events.** Not handled: no use of `at` for ordering, no per-aggregate version, no reconciliation. Replay is deterministic only with respect to arrival order (`seq`). Documented principle says "reprocessing must be idempotent" (`05-eventos...:8`) but no out-of-order rule is documented. V + D.

**Cursor / replay.** Cursor is `seq` string; `readEvents` is exclusive and ordered (`event-store.js:166-177`). Stream reads `?cursor=` (`controller:79`); `Last-Event-ID` header is NOT read although doc says so (`05-eventos...:66`). Defects: (1) every event in a polled batch is emitted with the batch's LAST cursor as SSE `id` (`event-stream.js:57-58`, `next` is the batch cursor), so a reconnect after a mid-batch drop with `Last-Event-ID` could skip events (browser EventSource sends the last received id); (2) after pruning, a cursor older than the oldest remaining `seq` silently returns the survivors with no snapshot/reset signal, contrary to doc (`05-eventos...:67`); (3) `types`/`sessionId` filters make cursor semantic per filter set. Tests only check SSE text format and header (`central-events.test.js:169-180`; `central-events-http.test.js:133-141`), not reconnection. V.

**Session state projection.** See P2. Rebuilds are full scans with `limit 5000` (`event-projector.js:67,100,141`); `projectWorkflows` and `projectAttention` ignore any cursor, and `projectSessions` accepts one but `view.cursor` is the batch cursor, not per-session. With store cap 20000, projections only fold the FIRST 5000 events (oldest surviving), so recent events are silently ignored once the log exceeds 5000. V. This directly contradicts RF7 "reconstructible" at scale and the pre-plan warning against re-reading full history.

**What is persisted.** Events table (`event-store.js:64-76`): id, type, at, provider, kind, trust, project/session/execution ids, payload JSON. Plus `canonical-sessions.json` (registry, 8 MB read cap, `registry.service.js:11`). Projections are not persisted (recomputed per request). No ingestion cursor/checkpoint per source, no source fingerprint table, no DB migrations/user_version (`CREATE TABLE IF NOT EXISTS` only). `events.sqlite` is stored under `projects/`; whether `.gitignore` excludes it was not confirmed (the `.gitignore` grep for `events.sqlite` returned nothing; test comment says `projects/` is git-ignored, `central-events.test.js:33`). V / A.

**Retention.** Count cap 20000 per project, delete-oldest on insert (`event-store.js:14,149-154`). Doc: "rotation per project needed for longer history" (`09.02:109`) and configurable retention planned (`05-eventos...:110`). Not configurable in code. V + D.

## 5. What the Central read contract (`10-contrato-leitura-central.md`) freezes

Frozen (D, "congelado", changes need inbox notice, `:3`):
1. `CanonicalSession` field set and enums, `schemaVersion` additive migration (`:11-29`). Statuses are orthogonal (ADR-006).
2. `GET /sessions` query params and response shape with opaque `cursor` (this one is an OFFSET paginator in code, `orchestrator:99-117`, while `/sessions/stream` cursor is `seq`; same word, different meaning; contract says only "opaque").
3. `GET /sessions/:id` shape (providerSessions, artifacts, executions, events, attention) (`:51-62`).
4. SSE format `id/event/data`, minimum event types, no-cursor = from start, reconnect idempotent (`:64-76`).
5. Event envelope with exactly: id, type, at, source{provider,kind}, trust, projectId, sessionId, executionId, payload (`:80-92`); `trust` observed|inferred; no absolute paths/secrets.
6. Aliases accepted on input (`:96-98`).
7. File-ownership split and hub files with single owner (`:100-108`).
8. Message contents never in the body; ordering by `lastObservedAt` desc then `id`.

Implications for the pre-plan:
- Adding optional envelope fields (`schemaVersion`, `receivedAt`, relation ids) is additive, but the contract lists the envelope as fixed fields; any change requires notice to both sides (09.03 and 09.02). A.
- The `source.kind` examples differ: contract says `"motor"` (`:85`), code default is `"internal"` and orchestrator uses `"discovery"`; registry `SOURCE_KIND` enum is a different list (`session-model.js:11`). Three vocabularies for "kind". V.
- Contract says `/sessions/:id` returns `executions` and `events`; no code path was found in this analysis that builds those from the event log (controller `canonical-session.controller.js` not read in depth). A.
- The contract is read-oriented (sessions); it freezes nothing about usage, cost, skills, workflows beyond event names, so P3/P4 data can be added without breaking it provided they stay as new event types plus new endpoints. A.

## 6. Test coverage relevant to the pre-plan acceptance scenarios (section 11)

| Pre-plan scenario | Covered in EP-09 tests? |
|---|---|
| Replay/re-import without duplication | Yes for same `id` only (`central-events.test.js:46-48`); not for re-observation without id |
| Restart keeps data | Yes (`:99-111`) |
| Two sessions of same engine independent | No (single session `s1` everywhere) |
| Out-of-order events | No |
| Streaming then final total | N/A (no usage data) |
| Missing tokens not zero | N/A |
| Cursor beyond retention | No |
| Reconnect mid-batch | No |
| Load / retention / resource peaks | No |

## 7. Top 5 findings

1. EP-09 is a generic, working event log (SQLite, seq cursor, id-idempotency, SSE, 3 projections), but it carries only session/execution/workflow/attention data from one producer (`session.discovered`). Tokens, cost, calls, skills, delegation relations and engine adapters are entirely MISSING; P1 should extend it rather than create a new store. V
2. Two incompatible event contracts coexist: EP-09 (`at`, `sessionId`, `executionId`, no version, store `events.sqlite`) and EP-08.04 orchestration (`timestamp`+`receivedAt`, `schemaVersion`, `correlationId`/`causationId`/`parentExecutionId`, in-memory/other store). The pre-plan's `parentRunId`/`traceId` would be a third naming. A contract decision is the first P1 task. V
3. The projector and stream have verified correctness gaps that the pre-plan acceptance tests would hit: arrival-order last-wins (no out-of-order guard), projections read only the first 5000 events, SSE batch events share the last cursor as `id` and `Last-Event-ID` is ignored, pruning gives no reset signal. V
4. Two sessions of the same engine are independent in the EP-09 projector (keyed by `sessionId`), but the live bug the pre-plan describes is real in reading: Office sets `activeCount` 0/1 per engine (`office-agent-telemetry.js:62-66`) and `agent-activity.service.js:115` forces Claude to at least 1. The Office does not consume EP-09 at all, so P2's fix is a wiring problem plus a missing live-execution producer. V (reading), not reproduced
5. Route shadowing: `GET /api/project/:slug/sessions/stream` is declared after `/sessions/([^/]+)` in a first-match router (`router.js:136-137,232-236`), so the SSE endpoint may be unreachable via the real router while unit tests pass by calling the controller directly. V (static) / A (runtime). Also: ingest does no type allowlist, no payload sanitization, and `POST /events` is an open loopback publish endpoint.

## 8. Questions that block decisions

1. Which contract is canonical for P1: extend EP-09's envelope (additive fields, with notice under the freeze), or unify with the EP-08.04 `event-contract.js`? This determines names (`correlationId` vs `traceId`, `parentExecutionId` vs `parentRunId`) and whether a second store is retired.
2. Is the "Central read contract freeze" negotiable for an additive envelope change, and who owns the notice (09.02 and 09.03 owners per `10-contrato:100-108`)? Inbox/owner status of 09.03-09.05 at this commit was not verified.
3. Is the pre-plan's SQLite/SSE choice already settled by ADR-005 (local persistent log)? ADR files were not read; if yes, P1 storage decision reduces to schema evolution and migrations (store currently has no `user_version`).
4. Where should usage (tokens/cost) live: new event types in `events.sqlite` or a separate table keyed by call? The 20000-event count cap would evict usage evidence; retention policy must be decided before P3.
5. Should the engine-monitor story 09.06 (status planejada) be absorbed into P2, since it already specifies presence vs activity events (`engine.presence.changed`, `engine.activity.changed`)?
6. Do the runtime checks (route shadowing, mid-batch reconnect, out-of-order regression, 5000-event projection limit) need to be reproduced by an executable test before planning? None was run here.
7. Is `events.sqlite` git-ignored and acceptable to hold telemetry (privacy tier), given no ingest sanitization exists?
