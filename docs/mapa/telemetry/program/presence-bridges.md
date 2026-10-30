---
domain: telemetry
module: program
feature: presence-bridges
summary: Chat run telemetry, office projection client/reducer, external session presence scanner and engine activity formatting.
paths: [ui/server/services/chat-run-telemetry.service.js, ui/public/js/office/office-*.js, ui/public/js/modules/chat-trace-id.js, ui/server/services/external-presence/*.js, tests/office-*.test.js, tests/chat-run-telemetry.test.js, tests/external-presence.test.js, docs/harness-telemetria/06-external-presence-design.md]
keywords: [presence, office, projection, sse, chat-run, external-sessions, scanner, activity]
updated: 2026-10-30
---
# Presence, bridges and office projection

| File | Responsibility |
|---|---|
| `ui/server/services/chat-run-telemetry.service.js` | Publishes chat run lifecycle (one run per POST /api/chat) to EP-09: session/run/execution events, 429, disconnect as cancelled; metadata only. |
| `tests/chat-run-telemetry.test.js` | Tests for the chat run tracker: normal, error, disconnect, 429, compare, independent sessions, no prompt text, failing store. |
| `ui/public/js/office/office-projection-reducer.js` | Pure reducer folding EP-09 projection/stream events into per-engine office state (active count, priority, error expiry, 429 notice). |
| `ui/public/js/office/office-projection-client.js` | Loads `/projections`, opens the session SSE stream from the cursor, resyncs on error/restart/`stream.reset` with backoff. |
| `ui/public/js/office/office-projection-bridge.js` | Binds the projection client to the active project and applies engine state to the office; falls back to local store. |
| `ui/public/js/office/office-telemetry-source.js` | Server-truth flag and precedence rule: with the stream connected only the server projection writes agent state. |
| `ui/public/js/modules/chat-trace-id.js` | Generates the shared `cmp-<uuid>` traceId sent in every POST of a compare-mode comparison. |
| `tests/office-projection-reducer.test.js` | Tests for the projection reducer: concurrent runs, error masking, compare, waiting approval, orphan runs, 429 notice. |
| `tests/office-projection-client.test.js` | Tests for the projection client with a fake EventSource: resume, dedup, backoff, reset, stop, server-vs-local precedence. |
| `tests/office-projection-server.test.js` | Integration tests with a temp harness root: two simultaneous Claude runs counted via chat tracker and projection stream. |
| `docs/harness-telemetria/06-external-presence-design.md` | Design of external session presence/activity (T2.4): file-timestamp inference, event contract, projection fields, counting rule. |
| `ui/server/services/external-presence/presence-config.js` | Scanner constants (30 s / 15 min / 8 h thresholds, heartbeat, cold sweep, interval) and default source roots. |
| `ui/server/services/external-presence/presence-inference.js` | Pure inference of activity and presence from the last signal time, plus the bucket and idempotency key. |
| `ui/server/services/external-presence/presence-sources-files.js` | Claude Code and Antigravity session readers (stat and file names only, cold-file cache). |
| `ui/server/services/external-presence/presence-sources-db.js` | Codex, OpenCode and Antigravity workspace lookups through read-only SQLite. |
| `ui/server/services/external-presence/presence-scanner.js` | Tracks last state per external session; publishes `session.discovered`/`updated` via `ingestEvent` only on change or heartbeat. |
| `ui/server/services/external-presence/presence-runtime.js` | Starts the scanner at boot (first scan, unref timer, `HARNESS_PRESENCE=0` disables, errors counted). |
| `tests/external-presence.test.js` | Tests for the presence scanner with temp dirs: inference boundaries, classification, change-only publishing, no transcript opened. |
| `ui/public/js/office/office-engine-activity-format.js` | Pure formatter of engine activity text for the dossier ("N em andamento", standby, open sessions). |
| `ui/public/js/office/office-engine-summary.js` | Shared per-engine summary for Central cards, war-room board and HUD (larger of canonical state and running executions). |
| `tests/office-presence-reducer.test.js` | Tests for the office reducer with external sessions: processing, open, no double counting, older servers, staleness. |
| `tests/office-engine-summary.test.js` | Tests for the dossier formatter, engine summary, rendered Central card and war board. |
