---
domain: telemetry
module: usage
feature: usage-ingest
summary: Per-call usage ingest from Claude transcripts and Codex rollouts into usage.observed events and the summary API.
paths: [ui/server/services/usage-ingest/*.js, tests/usage-ingest*.js, tests/usage-quota.test.js, tests/usage-cache-split.test.js, tests/codex-usage-fixtures.js, tests/usage-summary-extended.test.js, tests/usage-9router.test.js, tests/usage-opencode.test.js, tests/usage-gemini.test.js]
keywords: [usage, ingest, transcript, codex, rollout, checkpoint, usage.observed, summary]
updated: 2026-11-02
---
# Usage ingest

| File | Responsibility |
|---|---|
| `ui/server/services/usage-ingest/usage-config.js` | Constants and limits of the Claude usage ingest, with notes on the real transcript shape. |
| `ui/server/services/usage-ingest/transcript-reader.js` | Incremental byte reader of transcripts: complete lines only, holds a partial last line. |
| `ui/server/services/usage-ingest/call-normalizer.js` | Allow-list usage per call, streaming merge to final value, builds `usage.observed` body (no text kept). |
| `ui/server/services/usage-ingest/file-discovery.js` | Stat-only discovery of transcript and subagent files with cold-file caching. |
| `ui/server/services/usage-ingest/checkpoint-store.js` | Per-project checkpoint JSON (offset, size, mtime) written atomically. |
| `ui/server/services/usage-ingest/usage-cost.js` | Guarded call to the pricing estimator: missing module, null or error gives cost null. |
| `ui/server/services/usage-ingest/usage-ingestor.js` | Bounded ingest tick: reads appended bytes, merges calls, publishes `usage.observed` idempotently. |
| `ui/server/services/usage-ingest/usage-runtime.js` | Starts the usage ingest at server boot (`HARNESS_USAGE=0` disables) and exposes stats. |
| `ui/server/services/usage-ingest/usage-summary.js` | SQL read model for `GET /api/project/:slug/usage/summary` with coverage. |
| `ui/server/services/usage-ingest/usage-range.js` | Parses `since`/`window`/`until` for the summary (24h, 7d, 14d, all); invalid or conflicting input is a 400. |
| `ui/server/services/usage-ingest/usage-pricing-info.js` | Reads pricing metadata (version, reviewStatus, retrievedAt) for the summary; null fields if unavailable. |
| `ui/server/services/usage-ingest/codex-config.js` | Constants and limits of the Codex rollout ingest, with notes on rollout shape, call identity and delta rule. |
| `ui/server/services/usage-ingest/codex-call-normalizer.js` | Allow-list of token_count (last_token_usage), turn_context model and subagent flag; builds `usage.observed` (codex/openai). |
| `ui/server/services/usage-ingest/codex-file-discovery.js` | Stat-only walk of `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` with cold-file caching. |
| `ui/server/services/usage-ingest/codex-ingestor.js` | Bounded incremental Codex ingest: project from threads.cwd, subagent threads excluded, per-file checkpoint, idempotent publish. |
| `ui/server/services/usage-ingest/quota-model.js` | QuotaSnapshot (provider, plan, window, used, limit, unit, resetsAt, confidence): allow-list validation, extras dropped. |
| `ui/server/services/usage-ingest/quota-store.js` | Global store of the latest snapshot per provider+window, atomic JSON in coordination/. |
| `ui/server/services/usage-ingest/codex-quota-normalizer.js` | Turns Codex token_count rate_limits into a snapshot (10080 weekly, 300 5h, else unknown). |
| `ui/server/services/usage-ingest/quota-plans-config.js` | Manual plans (Claude Pro, Codex Plus, Gemini Pro) and optional limits from usage-plans.json. |
| `ui/server/services/usage-ingest/quota-merge.js` | Merges observed and manual snapshots for `GET /api/usage/quotas`; stale after 1h, expired window becomes unknown. |
| `tests/usage-quota.test.js` | Quota model, Codex extraction, store ordering and stale/expired handling. |
| `tests/usage-ingest.test.js` | Ingest tests: dedup, incremental reads, replay, truncation, null vs zero, sidechain, privacy sentinels, bounds. |
| `tests/usage-ingest-http.test.js` | Tests for the usage summary endpoint, runtime disable and error counting. |
| `tests/usage-ingest-fixtures.js` | Shared transcript fixtures for the usage ingest tests (not a test file). |
| `tests/usage-cache-split.test.js` | Normalizer tests: cache_creation 5m/1h split copied, null vs 0, streaming merge. |
| `tests/usage-ingest-codex.test.js` | Codex ingest tests: per-call usage, repeated totals, unknown model, replay, subagent exclusion, privacy sentinels. |
| `tests/codex-usage-fixtures.js` | Rollout and state_5.sqlite fixtures with sentinel strings for Codex usage tests (not a test file). |
| `tests/usage-summary-extended.test.js` | Tests for origin split, `groupBy=origin`, unpriced models, pricing metadata, window presets, 400s, 20k-event timing. |
| `ui/server/services/usage-ingest/9router-stat-model.js` | Pure ComboStat aggregation (combo, provider, model, calls, tokens, failures, lastAt) of 9Router usageHistory rows. |
| `ui/server/services/usage-ingest/9router-reader.js` | Read-only node:sqlite reader of the 9Router DB (HARNESS_9ROUTER_DB), column allow-list, id checkpoint, degrades to empty with warning; feeds `GET /api/usage/combos`. |
| `tests/usage-9router.test.js` | 9Router reader tests: aggregation, incremental checkpoint, bounded ticks, degradation, secret sentinels, route. |
| `ui/server/services/usage-ingest/opencode-stat-model.js` | Pure OpenCodeStat aggregation per provider/model (tokens, cache, cost, failures); 9router-provider calls flagged viaRouter and kept out of totals. |
| `ui/server/services/usage-ingest/opencode-reader.js` | Read-only node:sqlite reader of the OpenCode DB (HARNESS_OPENCODE_DB), json_extract allow-list, one layout (session_message else message), rowid checkpoint; feeds `GET /api/usage/opencode`. |
| `tests/usage-opencode.test.js` | OpenCode reader tests: layout choice, router dedupe, bounds, text/title sentinels, degradation, route. |
| `ui/server/services/usage-ingest/gemini-activity-reader.js` | Read-only Antigravity transcript counter (HARNESS_GEMINI_DIR): reads only `type`/`created_at`, per-day prompts/responses/errors, size-cached, bounded; feeds `GET /api/usage/gemini` (tokens always null). |
| `tests/usage-gemini.test.js` | Gemini activity reader tests: per-day counts, content sentinel, cache invalidation, degradation, route. |
