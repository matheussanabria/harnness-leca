# Telemetry program: consolidated diagnosis and plan (Phase B)

Status: proposal v0.2, 2026-10-23. Nothing here is implemented. Baseline commit: `41d6cd5` (main).
Inputs: pre-plan `docs/harness-telemetria-resumo-executivo-pre-plano.md` and reports A1-A5 in `diagnostico/`.
Evidence labels: [V] verified in code (static reading, no tests executed), [R] reproduced, [D] documented externally, [A] assumption.

## 1. Corrections to the pre-plan

| Pre-plan claim | Finding | Effect |
|---|---|---|
| Base is four files | EP-09 already provides SQLite event log, cursor, dedup, 3 projections, SSE, canonical sessions [V] (A1) | P1/P2 extend EP-09; no new store |
| Per-engine overwrite bug (hypothesis) | Reproduced in Node: A finishes while B streams, office shows idle, activeCount 0 [R] (A3) | Confirmed; regression test is the P2 acceptance gate |
| Telemetry JSONL can be reused | Absent numbers become 0 on write and read; schema orphaned; two files cannot be joined; tests write to real logs [V] (A2) | Legacy logs are imported, not reused |
| Cloud engine tokens are captured | They are not captured anywhere; only the local Ollama classifier has tokens [V] (A2) | P3 is greenfield for cloud engines |
| Skills/workflows get hooks later | Runtime skill evidence does not exist; the Claude stream parser ignores `tool_use` [V] (A4) | Skill evidence is Claude-only at first |
| Office reads the shared source | Office reads `/api/orchestration/stream` (in-memory, 1000 events, lost on restart); chat state is a module-level Map; chat never publishes to EP-09 [V] (A3, A4) | Two event systems need a bridge |

## 2. Decisions taken (user, 2026-10-23)

1. Canonical contract: extend EP-09 additively.
2. Legacy JSONL (`hia-executions`, `runtime-shadow`): preserve; migrate through an idempotent importer marked `origin=legacy`, quality unknown. Nothing is deleted without explicit confirmation.
3. Office: chat and office are used simultaneously (user, 2026-10-24), so the complete solution is required: chat run lifecycle published to EP-09 and the office reading the server projection (T2.2 + T2.3, cross-tab and restart safe). T0.1 stays only as a small interim fix and as the regression test that gates T2.3.
4. Gemini target is the Antigravity CLI; the Gemini CLI is dropped. An Antigravity adapter story is added after the Claude and Codex adapters, preceded by a capability study (A6) because A5 only covered the legacy Gemini CLI.
5. Remaining open questions follow the recommended defaults in section 10.

Assumptions I am declaring (reversible): ADR-005 (SQLite + SSE) holds; OTLP receiver is optional and off by default; no prompt text is persisted by default.

## 3. Event contract delta (additive over EP-09)

EP-09 envelope today: `id, type, at, source{provider,kind}, trust, projectId, sessionId, executionId, payload` [V]. EP-08.04 uses `timestamp, receivedAt, schemaVersion, source.confidence, correlationId, causationId, parentExecutionId, agentId, taskId` [V]. EP-09 already aliases a few types (`execution.completed` to `execution.succeeded`), so a bridge can reuse that mechanism [V].

Add as nullable columns or payload-envelope fields, no rename of existing ones:

| Field | Meaning | Mapping from EP-08.04 |
|---|---|---|
| `schemaVersion` | event envelope version, default 1 | same |
| `ingestedAt` | ingestion time; `at` stays occurrence time | `receivedAt` |
| `traceId`, `parentRunId`, `runId` | causal links; unknown stays null | `correlationId`, `parentExecutionId`, `executionId` |
| `agentId`, `taskId`, `workflowRunId`, `stepRunId`, `attemptId` | workflow and agent attribution | `agentId`, `taskId`; others new |
| `engineInstanceId`, `nativeSessionId` | scoped native identity (engine + host + id) | new |
| `relation` | `native` / `declared` / `inferred` / `unknown` | `source.confidence` |
| `idempotencyKey` | stable per call; replay is a no-op | new |

Usage is its own event type `usage.observed`, one per model call, never nested in session or workflow events:
`{ callId, provider, model, tokens{input,output,cacheRead,cacheCreation,reasoning} each number|null, cost{amount,currency,kind: estimated|reported|billed|null, priceTableVersion}, semantics: delta|cumulative|final, quality }`.
Absent value is `null`; zero requires a valid observation. Aggregations count unique `callId`; skill links are separate `skill.applied` events carrying `callId` references and no cost.

Fix list for the existing store/projector (needed before the pre-plan acceptance tests can pass) [V] (A1):
- Projector state is last-wins by arrival: add ordering by `at` plus terminal-state precedence.
- Projections read first 5000 of 20000 events: page or maintain incremental projections.
- SSE: per-event `id`, honour `Last-Event-ID`, send a reset signal when the cursor was pruned.
- Router: `GET /sessions/stream` may be shadowed by `/sessions/([^/]+)`; reproduce with a router-level test.
- Ingest: add type allowlist, payload sanitization, reject `trust=declared` where the contract forbids it.
- Retention by event count would evict usage evidence: separate retention class for `usage.observed`.
- `publishDiscovered` republishes all sessions when one is new.
- `events.sqlite` lives at `projects/<slug>/coordination/` and `.gitignore` only ignores `logs/`: verify it is not tracked [A].

## 4. Engine capability matrix (summary; full table in A5)

| Engine | Installed here | Tokens / cost | Parent-child | Skills | Control | Best first path |
|---|---|---|---|---|---|---|
| Claude Code 2.1.301 | yes | OTLP: input/output/cache, cost USD [D] | `agent_id`, `parent_agent_id` [D] | `skill.name` [D] | stdin stream-json | OTLP + transcript fallback (`message.usage`) |
| Codex 0.146.0-alpha.3 | via `tools/lib/codex-bin.js` | rollout JSONL `token_count`, incl. reasoning; OTel config shape unverified [D][A] | `sub_agent_activity` in rollout [V] | none documented | none | rollout files |
| OpenCode 1.19.3 | yes | no usage fields documented; read `/doc` from a live server [A] | `/session/:id/children` [D] | none | `prompt_async`, `abort` | API + SSE, after a spec read |
| Gemini CLI | no (replaced by Antigravity CLI 2026-06-18 per docs) | OTLP/outfile tokens, no cost [D] | none | none | n/a | defer; clarify target |

No telemetry env/config key is set anywhere; all collection is opt-in. Launcher hooks: `claude.js` accepts a per-run env (OTEL vars, resource attributes); `codex.js` can pass `-c` args; `opencode.js` has no spawn (correlation via session title/id or plugin); inbound `TRACEPARENT` is honoured by Claude only in `-p`/SDK mode, not in the current stdin stream-json mode [D].

## 5. Architecture decision (ADR drafts)

- ADR-T01 Store: extend EP-09 SQLite log; usage in same DB, separate retention. Alternatives rejected: second store (two truths), full observability platform (cost in RAM and operations).
- ADR-T02 Ingestion: in-process publish bridges first (workflow events, chat lifecycle), adapters per engine second, optional local OTLP/HTTP receiver third.
- ADR-T03 Correlation: Harness mints `runId` before spawn and passes it via env/args; native ids stored scoped by engine instance; unproven links stay `inferred` or `unknown`.
- ADR-T04 Dedup: `idempotencyKey` per event, `callId` per model call; streaming updates upsert by `callId`.
- ADR-T05 State: projections rebuilt from the log; presence, activity and workflow phase kept in separate fields.
- ADR-T06 Accounting: semantics in section 3; legacy tokens imported with `quality=unknown`.
- ADR-T07 Privacy: metadata only by default; prompt/tool text gated by an explicit flag.

These become files under `docs/harness-telemetria/adr/` in the first ADR story.

## 6. MVP and backlog

MVP: contract delta + store fixes; individualized internal sessions (chat publishes to EP-09); office reads the server projection; Claude OTLP/transcript adapter with per-call usage; one real workflow instrumented with its skills.

| ID | Epic / story | Depends on | Files (verified) | Acceptance | Size |
|---|---|---|---|---|---|
| T0.1 | Quick office fix: count working chats per engine, add compare mode, notify on reset | none | `ui/public/js/office/office-agent-telemetry.js`, `chat-execution-store.js` | 2 Claude chats, one ends: engine stays active, count correct; regression test | S |
| T0.2 | Test hygiene: force temp `HARNESS_ROOT` in telemetry tests | none | `tests/*telemetry*`, `tools/lib/runtime/telemetry.js` | tests no longer append to `logs/telemetry` | S |
| T1.1 | ADRs T01-T07 | A1-A5 | `docs/harness-telemetria/adr/` | reviewed by user | S |
| T1.2 | Envelope v1 + migration (`user_version`), allowlist, sanitizer | T1.1 | `ui/server/services/events/event-store.js` | replay is idempotent; absent stays null | M |
| T1.3 | Projector/SSE/router fixes (section 3 list) | T1.2 | `events/event-projector.js`, `event-stream.js`, `ui/server/router.js` | out-of-order, reconnect, router-level tests pass | M |
| T1.4 | Legacy importer | T1.2 | new `tools/` importer | idempotent; marked legacy; no deletion | S |
| T2.1 | Bridge `emitWorkflowEvent` to `publish` | T1.2 | `orchestration/workflow-events.js` | workflow, stage, approval, cancel events in EP-09 | S |
| T2.2 | Chat run lifecycle events (`runId`=`chatId`, distinct stop vs disconnect, 429 visible) | T1.2 | `ui/server/controllers/chat.controller.js` | two sessions independent in projection | M |
| T2.3 | Office/chat consume projection and SSE; cross-tab | T2.2, T1.3 | office JS, `office-state.js` | closing chat tab keeps state; restart keeps state | M |
| T3.1 | Claude adapter: env injection, OTLP/HTTP receiver (opt-in), transcript fallback | T1.2, ADR-T02 | `tools/lib/engines/claude.js`, new adapter module | per-call usage with coverage field | L |
| T3.2 | Stream parser: `tool_use` capture, `context.injected` | T2.2 | `engines/claude.js`, `engines/common.js` | skill/subagent evidence without self-report | M |
| T3.3 | Price table (versioned) and cost semantics | T3.1 | new `tools/lib/pricing/` | estimated vs reported labelled | M |
| T3.4 | Codex rollout adapter | T3.1 | new adapter | tokens incl. reasoning not double counted | M |
| T4.1 | Instrument one real workflow with attempts and step-to-session link | T2.1, T3.2 | workflow runner | chain traceable; two skills on one call = one cost | M |
| T5.x | Views, retention, alerts, access control, resource budget | T2-T4 | UI | measured CPU/RAM/disk | L |
| T3.5 | Study A6: Antigravity CLI telemetry, session, subagent and control capabilities | none | research only | capability matrix row with sources | S |
| T3.6 | Antigravity adapter | T3.5, T3.1 | new adapter | coverage declared per field | M |

OpenCode adapter (after reading its `/doc` spec) is a post-MVP story. T2.3 is MVP, not post-MVP, because chat and office run simultaneously.

Dependency graph: T0.1, T0.2, T1.1 independent; T1.1 -> T1.2 -> {T1.3, T1.4, T2.1, T2.2, T3.1}; T2.2 -> {T2.3, T3.2}; T3.1 -> {T3.3, T3.4}; {T2.1, T3.2} -> T4.1.

## 7. Delegation plan for implementation

Rules: one owner per shared contract/schema; parallelism only between independent fronts; max 3 concurrent agents (RAM budget); no permanent agent per engine.

| Wave | Task | Agent | Notes |
|---|---|---|---|
| 0 (parallel) | T0.1, T0.2 | `software-developer` x2, `qa-engineer` for the regression test | disjoint files |
| 1 | T1.1 ADRs | `software-architect` | user review gate |
| 2 | T1.2 envelope and store (single owner) | `backend-engineer` | blocks the rest; no parallel schema edits |
| 3 (parallel) | T1.3 / T1.4 / T2.1 | `backend-engineer`, `software-developer`, `software-developer` | distinct files |
| 4 (parallel) | T2.2 + T2.3 sequenced; T3.1 | `backend-engineer`, `frontend-engineer`, `ai-engineer` | T2.3 after T2.2 |
| 5 | T3.2-T3.4, T4.1 | `ai-engineer`, `software-developer` | |
| Review | each wave | `qa-engineer` + `code-review` skill | `security-engineer` on ingest and receiver |

Each delegated task states scope, inputs, expected output, owned files, dependencies and validation. After any file creation the agent updates `docs/mapa/` in the same task.

## 8. Validation

- Contract tests per adapter with sanitized fixtures; router-level test for SSE; replay, out-of-order, streaming-then-final and null-vs-zero tests (pre-plan section 11).
- Baseline CPU/RAM/disk with telemetry on and off before T5.
- Local commands to confirm in the next step: `npm test`, `npm run check`, `scripts/regressao.js`. Not run in this phase.

## 9. Proposed commits (Conventional Commits, none created)

`fix(office): count active chats per engine`, `test(telemetry): isolate harness root`, `docs(telemetria): add ADRs T01-T07`, `feat(events): envelope v1 with idempotency and ingest allowlist`, `fix(events): ordering, paging and SSE resume`, `feat(events): bridge workflow events`, `feat(chat): publish run lifecycle`, `feat(telemetry): claude usage adapter`.

## 10. Decisions on the former open questions (2026-10-24)

1. OTLP/HTTP receiver: transcripts first, optional receiver later (default accepted).
2. Subscription usage: in scope, cost stays `estimated` and labelled API-equivalent; `billed` only with a billing source (default accepted).
3. Canonical store for the office: bridge in-memory events into EP-09, then retire the in-memory feed (default accepted).
4. Gemini target: Antigravity CLI (user decision). Needs study A6 before the adapter.
5. Office usage: simultaneous with chat (user decision). Full solution required (T2.2 + T2.3).

## 11. First increment

T0.1 (office quick fix with its regression test) and T0.2 (test hygiene), in parallel, no dependencies. T1.1 can run alongside. Next gate: user review of the ADRs before T1.2.
