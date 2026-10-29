## 18. Telemetry usage, pricing and workflow instrumentation

| Caminho | Responsabilidade |
|---|---|
| `docs/harness-telemetria/diagnostico/A6-antigravity-capability-matrix.md` | Capability matrix for the Antigravity CLI (agy) and IDE: headless stream-json usage, hooks, resume, local data, unknowns. |
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
| `tools/lib/opencode-ports.js` | Finds listening TCP ports of OpenCode processes (image name and node/bun hosts by command line); the OS command layer is injectable. |
| `tools/lib/opencode-detect.js` | Validates candidates (OPENCODE_URL, discovered ports, default) with GET /session, short cache, optional Basic auth, Portuguese failure messages. |
| `tests/opencode-detect.test.js` | Fake HTTP servers (valid, wrong service, none, 401, auth header) and injected process/port lists. |
| `tests/agent-activity-opencode.test.js` | OpenCode detection in the legacy activity poll: `time_updated` (ms) and `updated_at` (s) schemas, stale and child sessions, missing db gives 0. |
| `docs/harness-telemetria/09-t41a-spike-findings.md` | Findings of the T4.1a spike: real Skill and Task block shapes, subagent linkage, sessionId behaviour on resume, open stream-id question. |
| `ui/server/services/orchestration/workflow-attempt.service.js` | Attempt model of a workflow stage (T4.1c): opens on started (idempotent while open), reopens after blocked or opt-in failed retry as attempt N+1, closes on completed/failed/blocked/cancelled; declares the engine session on the attempt, decorates task payloads with attemptId/attemptNo and normalizes the optional validation (never rejects). |
| `tests/workflow-attempt.test.js` | Unit tests for attempts: open, idempotent double start, restart after blocked as attemptNo 2, close outcomes and cancelled close, failed ends the run by default, opt-in retry keeps the run and opens attempt 2, validation defaults/sanitising, invalid sessionId ignored. |
| `tests/workflow-attempt-events.test.js` | Integration tests with a temp harness root: attempt_id reaches the EP-09 store, replay of the same emission is a no-op and two attempts never collide (attemptId joins the idempotency key), note text absent from every stored event (noteLength only), old-style advance bodies work through the HTTP controller, `allowRetryAfterFailure` accepts only boolean true. |
| `tools/lib/engines/claude-tool-use.js` | Pure allow-list extraction of Skill/Agent/Task `tool_use` metadata and `tool_result` outcome; never keeps prompts, descriptions, inputs or outputs. |
| `tests/claude-tool-use.test.js` | Tests for the tool-use helpers and parser callbacks: Skill/Agent/Task, dedup, resultOk true/false/null, null messageId, privacy sentinels and unchanged SSE chunks. |
| `tests/chat-tool-use-telemetry.test.js` | Tests for tracker `skill.loaded`/`tool.invoked` publishing: metadata payloads, duplicate suppression, cancel flush with resultOk null and isolated publish failure. |
| `tests/claude-stream-callid-replay.test.js` | Experiment Q3: replays the same synthetic transcript lines through the live stream parser/chat tracker and the transcript usage ingest, proving both derive the same callId (message.id) for the T4.1e join; synthetic fixtures only, no real stream captured. |
| `docs/harness-telemetria/10-handoff-pendencias.md` | Handoff for the next agent (any engine): working rules, P0 sessions-tab layout spec, merge/cleanup list and engineering follow-ups. |
