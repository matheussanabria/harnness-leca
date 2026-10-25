## 16. Telemetry program (EP telemetry: plan, event log extensions, bridges, office projection)

| Caminho | Responsabilidade |
|---|---|
| `docs/harness-telemetria-resumo-executivo-pre-plano.md` | Pre-plan v0.1: scope, entity model, accounting rules, phases P0-P5 and the briefing for planning. |
| `docs/harness-telemetria/00-plano-consolidado.md` | Consolidated diagnosis, decisions, additive event contract over EP-09, engine matrix summary, ADR drafts, backlog T0-T5, delegation plan. |
| `docs/harness-telemetria/diagnostico/A1-ep09-overlap.md` | Matrix of what EP-09 already covers against the pre-plan, plus projector, SSE and router gaps. |
| `docs/harness-telemetria/diagnostico/A2-accounting-audit.md` | Audit of the HIA and runtime telemetry JSONL: null vs zero, orphan schema, gaps against accounting rules. |
| `docs/harness-telemetria/diagnostico/A3-office-concurrency.md` | Reproduction of the per-engine overwrite bug in the office and the coupling assessment. |
| `docs/harness-telemetria/diagnostico/A4-dispatch-paths.md` | Spawn, workflow, skill, approval and cancel paths with ids and ranked instrumentation points. |
| `docs/harness-telemetria/diagnostico/A5-engine-capability-matrix.md` | Capability matrix for Claude Code, Codex, Gemini and OpenCode with sources and the recommended first adapter. |
| `tests/office-agent-concurrency.test.js` | Regression tests for the office bridge: per-engine active count with several chats, error masking, reset notification, compare mode (same-document only). |
| `docs/harness-telemetria/adr/README.md` | Index of the telemetry ADRs (proposed, awaiting user review), their dependencies and open items. |
| `docs/harness-telemetria/adr/ADR-TEL-001-store.md` | Extend the EP-09 SQLite log; usage in the same DB under a separate retention class. |
| `docs/harness-telemetria/adr/ADR-TEL-002-ingestion-order.md` | Ingestion order: in-process bridges, engine adapters, optional OTLP/HTTP receiver; transcripts first. |
| `docs/harness-telemetria/adr/ADR-TEL-003-correlation.md` | runId minted before spawn, scoped native ids, relation grade native/declared/inferred/unknown. |
| `docs/harness-telemetria/adr/ADR-TEL-004-dedup-idempotency.md` | idempotencyKey per event, callId per model call, streaming upsert. |
| `docs/harness-telemetria/adr/ADR-TEL-005-state-projection.md` | Rebuildable projections; presence, activity and phase kept separate; ordering by occurrence time. |
| `docs/harness-telemetria/adr/ADR-TEL-006-accounting.md` | usage.observed per call, null vs zero, cost kinds, legacy import quality. |
| `docs/harness-telemetria/adr/ADR-TEL-007-privacy.md` | Metadata-only default, opt-in text, sanitization at ingest, read-endpoint access. |
| `docs/harness-telemetria/diagnostico/A6-antigravity-capability-matrix.md` | Capability matrix for the Antigravity CLI (agy) and IDE: headless stream-json usage, hooks, resume, local data, unknowns. |
| `ui/server/services/events/event-envelope.js` | Envelope v1 of the event log: additive fields (schemaVersion, ingestedAt, relation, run/trace/agent/workflow/attempt ids, idempotencyKey), normalization and row mapping. |
| `ui/server/services/events/event-migrations.js` | Base DDL and `PRAGMA user_version` migrations of the event store (additive nullable columns, indexes, idempotent under lock). |
| `ui/server/services/events/event-type-allowlist.js` | Allowed event types for ingest (EP-09, EP-08.04 catalog, aliases and the telemetry types usage/skill/run). |
| `ui/server/services/events/event-sanitizer.js` | Ingest sanitizer: redacts secret-like keys and values, drops prompt/output text unless explicitly enabled, caps depth, size and payload. |
| `ui/server/services/events/event-ingest.js` | Single validated ingest function (`ingestEvent`) used by the POST path and future producers; rejects unknown types with typed errors. |
| `tests/event-envelope.test.js` | Tests for envelope fields, migration from a version-0 database, idempotent replay and null preservation. |
| `tests/event-sanitizer.test.js` | Tests for the ingest sanitizer: secret redaction, text dropping, limits. |
| `tests/central-events-defects.test.js` | Executable reproductions (todo until T1.3 fixes land) of EP-09 defects: shadowed stream route, ignored Last-Event-ID, shared batch ids, out-of-order regression, 5000-event projection window, missing prune reset signal. |
| `ui/server/services/orchestration/workflow-event-bridge.js` | Bridge from `emitWorkflowEvent` to the EP-09 store via `ingestEvent`: field mapping, relation from confidence, idempotency keys, never throws (counts and logs once). |
| `tests/workflow-event-bridge.test.js` | Tests for the workflow bridge: stage, approval, cancel events persisted, replay no-op, failing store isolated, invalid slug skipped. |
| `ui/server/services/events/event-order.js` | Ordering rules for projections: per-field stamp (`at`, then seq) and terminal-state precedence for executions. |
| `ui/server/services/events/event-retention.js` | Retention by class: operational events capped by count, `usage.observed` pruned by age and size; mutable `RETENTION` constants. |
| `tests/central-events-retention.test.js` | Tests for retention, stream reset, Last-Event-ID, ordering, `publishDiscovered` idempotency and router order. |
| `tools/import-legacy-telemetry.js` | CLI that imports legacy HIA and runtime JSONL telemetry into the EP-09 store (dry-run by default, `--apply` to write); never modifies the logs. |
| `tools/lib/telemetry-import/index.js` | Import loop: per-file counts (read, imported, duplicate, invalid, flagged), dry-run duplicate detection, `ingestEvent` calls. |
| `tools/lib/telemetry-import/common.js` | Shared helpers: line hash, idempotency key `legacy:<file>:<hash>`, null-safe number parsing, line parser. |
| `tools/lib/telemetry-import/map-hia.js` | Maps `hia-executions` lines to `run.finished` events; coerced zeros become null, script zeros flagged unverified. |
| `tools/lib/telemetry-import/map-runtime.js` | Maps `runtime-shadow` lines to `usage.observed` events (provider ollama); failure lines import null tokens. |
| `tests/import-legacy-telemetry.test.js` | Tests for the legacy importer: replay no-op, moved lines, dry-run writes nothing, corrupt lines counted, null preserved. |
| `ui/server/services/chat-run-telemetry.service.js` | Publishes the chat run lifecycle (one run per POST /api/chat) to the EP-09 store: session/run/execution events, 429 rejection, disconnect as cancelled; metadata only, never throws. |
| `tests/chat-run-telemetry.test.js` | Tests for the chat run tracker: normal, error, disconnect, 429, compare, independent same-engine sessions, no prompt text, failing store isolated. |
| `ui/public/js/office/office-projection-reducer.js` | Pure reducer: folds EP-09 projection/stream events into per-engine office state (active count, status priority, error expiry, 429 notice). |
| `ui/public/js/office/office-projection-client.js` | Loads `/projections`, opens the session SSE stream from the projection cursor, resyncs on error/restart/`stream.reset` with backoff. |
| `ui/public/js/office/office-projection-bridge.js` | Binds the projection client to the active project and applies engine state to the office; falls back to local store when the stream drops. |
| `ui/public/js/office/office-telemetry-source.js` | Server-truth flag and the precedence rule: with the stream connected only the server projection writes agent state. |
| `ui/public/js/modules/chat-trace-id.js` | Generates the shared `cmp-<uuid>` traceId sent in every POST of a compare-mode comparison. |
| `tests/office-projection-reducer.test.js` | Tests for the projection reducer: concurrent runs, error masking, compare, waiting approval, orphan runs, 429 notice. |
| `tests/office-projection-client.test.js` | Tests for the projection client with a fake EventSource: resume, dedup, backoff, reset, stop, server-vs-local precedence. |
| `tests/office-projection-server.test.js` | Integration tests with a temp harness root: two simultaneous Claude runs counted via the real chat tracker and projection stream. |
| `docs/harness-telemetria/06-external-presence-design.md` | Design of external session presence/activity (story T2.4): inference rules from file timestamps, event contract, projection fields, office counting rule. |
| `ui/server/services/external-presence/presence-config.js` | Constants of the presence scanner (30 s / 15 min / 8 h thresholds, heartbeat, cold sweep, interval) and default source roots. |
| `ui/server/services/external-presence/presence-inference.js` | Pure inference of activity and presence from the last signal time, plus the bucket and idempotency key. |
| `ui/server/services/external-presence/presence-sources-files.js` | Claude Code and Antigravity session readers (stat and file names only, cold-file cache). |
| `ui/server/services/external-presence/presence-sources-db.js` | Codex, OpenCode and Antigravity workspace lookups through read-only SQLite. |
| `ui/server/services/external-presence/presence-scanner.js` | Keeps the last published state per external session and publishes `session.discovered`/`updated` through `ingestEvent` only on change or heartbeat. |
| `ui/server/services/external-presence/presence-runtime.js` | Starts the scanner at server boot (first scan, unref'd timer, `HARNESS_PRESENCE=0` disables, errors counted). |
| `tests/external-presence.test.js` | Tests for the presence scanner with temp dirs: inference boundaries, per-source classification, change-only publishing, replay, independence, no transcript opened. |
| `ui/public/js/office/office-engine-activity-format.js` | Pure formatter of engine activity text for the dossier ("N em andamento", standby, open sessions). |
| `ui/public/js/office/office-engine-summary.js` | Shared per-engine summary used by Central cards, war-room board and HUD (larger of canonical state and running executions). |
| `tests/office-presence-reducer.test.js` | Tests for the office reducer rule with external sessions: processing, open, no double counting, older servers, staleness. |
| `tests/office-engine-summary.test.js` | Tests for the dossier formatter, the engine summary, the rendered Central card and the war board. |
| `tools/lib/pricing/prices.json` | Versioned price table (per million tokens) from official provider pages, each model with sourceUrl and retrievedAt; `reviewStatus: pending-user-review`. |
| `tools/lib/pricing/index.js` | `estimateCost`: API-equivalent cost estimate from token counts; null when model or counts are unknown, never turns null into 0. |
| `tools/lib/pricing/loader.js` | Loads and validates `prices.json` (rejects entries without source), memoised. |
| `tools/pricing.js` | CLI to list the price table and estimate a cost from token counts. |
| `tests/pricing.test.js` | Tests for the estimator: arithmetic, null handling, model id normalisation, cache rates, table validation. |
| `ui/server/services/usage-ingest/usage-config.js` | Constants and limits of the Claude usage ingest, with notes on the real transcript shape. |
| `ui/server/services/usage-ingest/transcript-reader.js` | Incremental byte reader of transcripts: complete lines only, holds a partial last line. |
| `ui/server/services/usage-ingest/call-normalizer.js` | Allow-list extraction of usage per call, streaming merge to the final value, `usage.observed` body (no text kept). |
| `tests/usage-cache-split.test.js` | Normalizer tests: cache_creation 5m/1h split copied, null vs 0, streaming merge. |
| `tests/pricing-cache-split.test.js` | Estimator tests: cache-write TTL split arithmetic, fallbacks, missing flags, no-1h-rate table. |
| `ui/server/services/usage-ingest/file-discovery.js` | Stat-only discovery of transcript and subagent files with cold-file caching. |
| `ui/server/services/usage-ingest/checkpoint-store.js` | Per-project checkpoint JSON (offset, size, mtime) written atomically. |
| `ui/server/services/usage-ingest/usage-cost.js` | Guarded call to the pricing estimator: missing module, null or error gives cost null. |
| `ui/server/services/usage-ingest/usage-ingestor.js` | Bounded ingest tick: reads appended bytes, merges calls, publishes `usage.observed` idempotently. |
| `ui/server/services/usage-ingest/usage-runtime.js` | Starts the usage ingest at server boot (`HARNESS_USAGE=0` disables), exposes stats. |
| `ui/server/services/usage-ingest/usage-summary.js` | SQL read model for `GET /api/project/:slug/usage/summary` with coverage. |
| `tests/usage-ingest.test.js` | Tests for the usage ingest: dedup, incremental reads, replay, truncation, null vs zero, sidechain, privacy sentinels, bounds. |
| `tests/usage-ingest-http.test.js` | Tests for the usage summary endpoint, runtime disable and error counting. |
| `tests/usage-ingest-fixtures.js` | Shared transcript fixtures for the usage ingest tests (not a test file). |
| `ui/server/services/usage-ingest/codex-config.js` | Constants and limits of the Codex rollout usage ingest, with notes on the real rollout shape and the call identity and delta rule. |
| `ui/server/services/usage-ingest/codex-call-normalizer.js` | Allow-list extraction of token_count (last_token_usage), turn_context model and subagent flag; builds the `usage.observed` body (engine codex, provider openai). |
| `ui/server/services/usage-ingest/codex-file-discovery.js` | Stat-only walk of `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` with cold-file caching. |
| `ui/server/services/usage-ingest/codex-ingestor.js` | Bounded incremental Codex ingest: project from threads.cwd, subagent threads excluded, per-file checkpoint with model, idempotent publish. |
| `tests/usage-ingest-codex.test.js` | Tests for the Codex ingest: per-call usage, repeated totals, null vs 0, unknown model, incremental and replay, subagent exclusion, bounds, privacy sentinels, runtime stats. |
| `tests/codex-usage-fixtures.js` | Rollout and state_5.sqlite fixtures with sentinel strings for the Codex usage tests (not a test file). |
| `ui/server/services/usage-ingest/usage-range.js` | Parses `since`/`window`/`until` for the usage summary (24h, 7d, 14d, all); invalid or conflicting input is a 400. |
| `ui/server/services/usage-ingest/usage-pricing-info.js` | Reads pricing table metadata (version, reviewStatus, retrievedAt) for the summary; null fields when the module is unavailable. |
| `tests/usage-summary-extended.test.js` | Tests for origin split, `groupBy=origin`, unpriced models, pricing metadata, window presets, 400s and 20k-event timing. |
| `ui/public/js/modules/usage-format.js` | Formatters of the consumption panel: compact K/M/B with exact title, cost, share percent; null renders as n/d. |
| `ui/public/js/modules/usage-view-model.js` | Builds the consumption view model: cards, main vs subagent split, per-day buckets, models, sessions, coverage, notices. |
| `ui/public/js/modules/usage-view.js` | HTML sections of the consumption panel. |
| `ui/public/js/modules/usage-render.js` | Composes loading, error, disabled, empty and ready states of the consumption panel. |
| `ui/public/js/modules/usage-api.js` | Fetches `/usage/summary` for day, model and session groupings with an abort signal. |
| `ui/public/js/modules/usage-panel.js` | Controller of the consumption panel: 30 s polling only while visible, abort, window selector, retry. |
| `ui/public/js/office3d/orchestration/tab-usage.js` | The Consumo tab of the Centro de Orquestracao (render, setup, unmount). |
| `ui/public/css/office/20-usage-panel.css` | Styles of the consumption panel using the office dark theme tokens. |
| `tests/usage-tab-model.test.js` | Tests for the consumption pure logic: formatters, view model, split math, null-never-zero. |
| `tests/usage-tab-panel.test.js` | Fake-DOM tests for the consumption panel: states, polling stop when hidden, abort, retry. |
| `docs/harness-telemetria/08-t41-workflow-instrumentation-design.md` | Design of story T4.1: candidate workflow, id model, events, step-to-run link, skill evidence, usage per step, metrics, story breakdown T4.1a-g. |
| `ui/server/services/canonical-sessions/session-projection-merge.js` | Merges the EP-09 session projection into the Central read model (T2.5): exact id, then native id inside the registry fingerprint, else its own unlinked row; scanner sessions are `inferred`, never invented links. |
| `ui/server/services/canonical-sessions/session-registry-orchestrator.service.js` | `readCentral` now merges the projection before filters, totals (adds `byOrigin`) and paging; projection failure degrades to registry-only with a warning. |
| `ui/server/services/events/event-projector.js` | `projectSessions` ignores `usage.observed` (it created provider-less phantom session views); usage stays queryable in the log. |
| `ui/public/js/modules/central-sessions-format.js` | Shared `esc` and `statusBadge` HTML helpers of the Central views. |
| `ui/public/js/modules/central-sessions-presence.js` | Activity, presence and origin ("externa" / "chat do Harness") badges and the "ultima atividade" text. |
| `ui/public/js/modules/central-sessions-detail.js` | Detail panel of the Central (split out of the view), now with activity, origin and last activity. |
| `ui/public/js/modules/central-sessions-view.js` | List and Kanban rendering of the Central; rows and cards show activity, presence and origin; re-exports the detail panel. |
| `ui/public/js/modules/central-sessions.js` | Central controller; requests up to 200 sessions so the totals line counts the merged list. |
| `tests/central-projection-usage.test.js` | Proof of the phantom-session cause and the projector fix (usage events kept, no session views). |
| `tests/central-sessions-projection.test.js` | Merge with dedup (external, chat, markdown), filters and totals on the merged list, UI rendering of list, kanban and detail. |
| `tools/lib/opencode-ports.js` | Finds listening TCP ports of OpenCode processes (image name and node/bun hosts by command line); the OS command layer is injectable. |
| `tools/lib/opencode-detect.js` | Validates candidates (OPENCODE_URL, discovered ports, default) with GET /session, short cache, optional Basic auth, Portuguese failure messages. |
| `tests/opencode-detect.test.js` | Fake HTTP servers (valid, wrong service, none, 401, auth header) and injected process/port lists. |
| `tests/agent-activity-opencode.test.js` | OpenCode detection in the legacy activity poll: `time_updated` (ms) and `updated_at` (s) schemas, stale and child sessions, missing db gives 0. |
| `docs/harness-telemetria/09-t41a-spike-findings.md` | Findings of the T4.1a spike: real Skill and Task block shapes, subagent linkage, sessionId behaviour on resume, open stream-id question. |
| `ui/server/services/orchestration/workflow-attempt.service.js` | Attempt model of a workflow stage (T4.1c): opens on started (idempotent while open), reopens after blocked or opt-in failed retry as attempt N+1, closes on completed/failed/blocked/cancelled; declares the engine session on the attempt, decorates task payloads with attemptId/attemptNo and normalizes the optional validation (never rejects). |
| `tests/workflow-attempt.test.js` | Unit tests for attempts: open, idempotent double start, restart after blocked as attemptNo 2, close outcomes and cancelled close, failed ends the run by default, opt-in retry keeps the run and opens attempt 2, validation defaults/sanitising, invalid sessionId ignored. |
| `tests/workflow-attempt-events.test.js` | Integration tests with a temp harness root: attempt_id reaches the EP-09 store, replay of the same emission is a no-op and two attempts never collide (attemptId joins the idempotency key), note text absent from every stored event (noteLength only), old-style advance bodies work through the HTTP controller, `allowRetryAfterFailure` accepts only boolean true. |
