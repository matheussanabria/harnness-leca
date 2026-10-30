---
domain: telemetry
module: program
feature: eventlog-ingest
summary: Event log envelope, migrations, ingest, sanitizer, ordering, retention, workflow bridge and legacy telemetry import.
paths: [ui/server/services/events/event-*.js, ui/server/services/orchestration/workflow-event-bridge.js, tools/import-legacy-telemetry.js, tools/lib/telemetry-import/*.js, tests/event-*.test.js, tests/central-events-*.test.js]
keywords: [event-log, ingest, envelope, sanitizer, retention, idempotency, legacy-import, workflow-bridge]
updated: 2026-10-30
---
# Event log, ingest and legacy import

| File | Responsibility |
|---|---|
| `ui/server/services/events/event-envelope.js` | Envelope v1: additive fields (schemaVersion, ingestedAt, relation, run/trace/agent/workflow/attempt ids, idempotencyKey), normalization, row mapping. |
| `ui/server/services/events/event-migrations.js` | Base DDL and `PRAGMA user_version` migrations of the event store (additive nullable columns, indexes, idempotent under lock). |
| `ui/server/services/events/event-type-allowlist.js` | Allowed ingest event types (EP-09, EP-08.04 catalog, aliases, telemetry usage/skill/run types). |
| `ui/server/services/events/event-sanitizer.js` | Ingest sanitizer: redacts secret-like keys and values, drops prompt/output text unless enabled, caps depth and size. |
| `ui/server/services/events/event-ingest.js` | Single validated ingest function (`ingestEvent`) for the POST path and producers; rejects unknown types with typed errors. |
| `tests/event-envelope.test.js` | Tests for envelope fields, migration from a version-0 database, idempotent replay and null preservation. |
| `tests/event-sanitizer.test.js` | Tests for the ingest sanitizer: secret redaction, text dropping, limits. |
| `tests/central-events-defects.test.js` | Executable reproductions (todo until T1.3) of EP-09 defects: shadowed stream route, ignored Last-Event-ID, shared batch ids, out-of-order, window, prune reset. |
| `ui/server/services/orchestration/workflow-event-bridge.js` | Bridge from `emitWorkflowEvent` to the EP-09 store via `ingestEvent`: field mapping, relation, idempotency keys, never throws. |
| `tests/workflow-event-bridge.test.js` | Tests for the workflow bridge: stage, approval and cancel events, replay no-op, failing store isolated, invalid slug skipped. |
| `ui/server/services/events/event-order.js` | Projection ordering rules: per-field stamp (`at`, then seq) and terminal-state precedence for executions. |
| `ui/server/services/events/event-retention.js` | Retention by class: operational events capped by count, `usage.observed` pruned by age and size; mutable `RETENTION` constants. |
| `tests/central-events-retention.test.js` | Tests for retention, stream reset, Last-Event-ID, ordering, `publishDiscovered` idempotency and router order. |
| `tools/import-legacy-telemetry.js` | CLI importing legacy HIA and runtime JSONL into the EP-09 store (dry-run default, `--apply` writes); never modifies logs. |
| `tools/lib/telemetry-import/index.js` | Import loop: per-file counts (read, imported, duplicate, invalid, flagged), dry-run duplicate detection, `ingestEvent` calls. |
| `tools/lib/telemetry-import/common.js` | Shared helpers: line hash, idempotency key `legacy:<file>:<hash>`, null-safe number parsing, line parser. |
| `tools/lib/telemetry-import/map-hia.js` | Maps `hia-executions` lines to `run.finished` events; coerced zeros become null, script zeros flagged unverified. |
| `tools/lib/telemetry-import/map-runtime.js` | Maps `runtime-shadow` lines to `usage.observed` events (provider ollama); failure lines import null tokens. |
| `tests/import-legacy-telemetry.test.js` | Tests for the legacy importer: replay no-op, moved lines, dry-run writes nothing, corrupt lines counted, null preserved. |
