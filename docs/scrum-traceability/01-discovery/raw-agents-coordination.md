# Raw discovery: agents, coordination, sessions, telemetry, hooks

Read-only subagent report, 2026-10-31, against a89703c. Items marked Unknown were not verified.

## Key facts
- ADR-007 exists (docs/harness-evolution/03-decisions/ADR-007-ledger-coordenacao-agentes.md, accepted 2026-10-19): per-project JSON ledger mutated only via tools/coordination.js; lock + validation + idempotent event + revision bump + atomic state write + JSONL audit append + regenerated dashboard/context/inboxes. autoDispatch off. SQLite deferred.
- Related ADRs: ADR-004 canonical session registry (proposed), ADR-005 SQLite event store append-only with idempotent projectors (proposed), ADR-006 orthogonal states, ADR-009 one memory fact per file, ADR-010 atelier agent loop. Telemetry ADRs in docs/harness-telemetria/adr/ ADR-TEL-001..007 (store, ingestion order, correlation with runId minted before spawn and relation grades native/declared/inferred/unknown, dedup, projection, accounting, privacy) - status proposed.
- Ledger layout: tools/lib/coordination/storage.js:6-17 -> projects/<slug>/coordination/{state.json,.lock,events/,inbox/,STATUS.md} + context/coordination.md. NOT initialized for harness-leca in this worktree.
- Ledger event (reducer.js:10-17): {id, type, provider, storyId, payload, at}; types story.claimed/started/heartbeat/blocked/completed, inbox.read, handoff, notify. Claim rules reducer.js:50-60; lease 120 min; heartbeat reducer.js:62-64; only enabled providers (reducer.js:21-25).
- Lock storage.js:35-45 (wx + stale removal); atomic write storage.js:20-25; append storage.js:55. Idempotency processedEventIds reducer.js:49, service.js:108-112. Append-only by convention; state not rebuilt from JSONL.
- No per-file ownership; no commit/branch fields in ledger events.
- Sessions: ui/server/services/canonical-sessions/ (session-model, session-registry.service -> projects/<slug>/canonical-sessions.json, reconciler, session-workflow-linker, markdown-discovery); API GET/POST /api/project/:slug/sessions; session-projection-merge.js; UI central-sessions*.js.
- Engines: tools/lib/engines/{claude,codex,index}.js, opencode v2 HTTP (tools/lib/opencode-v2*.js), 9router :20128. Native session ID formats Unknown.
- Execution lifecycle: ui/server/services/chat-run-telemetry.service.js - runId = chatId minted before spawn; start() emits session.discovered + run.started (149-152); tool.invoked (115-137); run.finished (71-81 incl. 429). Natural hook point.
- Orchestration adapters ui/server/services/orchestration/adapters/*, event-contract.js, workflow-event-bridge.js (workflowRunId/stepRunId/attemptId), routine-runner.service.js.
- Envelope ID_FIELDS (event-envelope.js:12-24): runId, parentRunId, traceId, agentId, taskId, workflowRunId, stepRunId, attemptId, engineInstanceId, nativeSessionId, idempotencyKey. NO cwd/branch/worktree, NO storyId.
- Telemetry store: SQLite event log (ui/server/services/events/event-migrations.js, event-ingest.js single ingestEvent, event-type-allowlist.js, event-projector.js, event-order.js, event-retention.js).
- Hooks: .claude/settings.json only UserPromptSubmit -> load-project.ps1. No PostToolUse; file edits not captured outside Harness chat runs.
- Redaction: tools/lib/redact.js, tools/lib/jira-redact.js, ui/server/services/events/event-sanitizer.js (metadata-only default, ADR-TEL-007).

## Matrix
| Item | Status | Evidence |
|---|---|---|
| ADR-007 ledger | Existing | ADR-007 file |
| state.json + JSONL ledger | Existing (not initialized here) | storage.js:6-17, :55 |
| Claim/lease/handoff | Existing | reducer.js:50-64 |
| Lock + atomic write | Existing | storage.js:20-25, :35-45 |
| Event idempotency | Existing | reducer.js:49, service.js:108 |
| Append-only enforcement | Partial | storage.js:55 |
| Per-file ownership | Absent | reducer.js:53 |
| Commit/branch in events | Absent | reducer.js:10-17 |
| Canonical session registry | Existing | canonical-sessions/ |
| Execution start/end events | Existing (chat runs) | chat-run-telemetry.service.js:149-152 |
| cwd/worktree/branch in runs | Absent | event-envelope.js:12-24 |
| Workflow/step/attempt ids | Existing | event-envelope.js, workflow-event-bridge.js |
| storyId in envelope | Absent (taskId/traceId usable) | event-envelope.js:15-17 |
| Tool-call capture | Partial (chat only) | chat-run-telemetry.service.js:115-137 |
| Claude PostToolUse hook | Absent | .claude/settings.json |
| Usage/tokens/cost | Existing | ADR-TEL-006 |
| Redaction | Existing | redact.js, event-sanitizer.js |
| opencode-delegate capture | Unknown | tools/opencode-delegate.js |
| Native session ID formats | Unknown | tools/lib/engines/*.js |
