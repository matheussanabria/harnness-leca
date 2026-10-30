---
domain: telemetry
module: usage
feature: workflows
summary: OpenCode detection, Claude tool_use parser and workflow stage attempts (T4.1 instrumentation).
paths: [tools/lib/opencode-*.js, tools/lib/engines/claude-tool-use.js, ui/server/services/orchestration/workflow-attempt.service.js, tests/workflow-attempt*.test.js, tests/*tool-use*.test.js]
keywords: [opencode, tool_use, skill, workflow, attempt, T4.1, replay, callId]
updated: 2026-10-30
---
# Workflow instrumentation

| File | Responsibility |
|---|---|
| `docs/harness-telemetria/08-t41-workflow-instrumentation-design.md` | Design of story T4.1: workflow, id model, events, step-to-run link, skill evidence, usage per step, breakdown T4.1a-g. |
| `docs/harness-telemetria/09-t41a-spike-findings.md` | T4.1a spike findings: real Skill and Task block shapes, subagent linkage, sessionId on resume, open stream-id question. |
| `docs/harness-telemetria/10-handoff-pendencias.md` | Handoff for the next agent: working rules, P0 sessions-tab layout spec, merge/cleanup list, engineering follow-ups. |
| `tools/lib/opencode-ports.js` | Finds listening TCP ports of OpenCode processes (image name, node/bun hosts by command line); OS command layer injectable. |
| `tools/lib/opencode-detect.js` | Validates candidates (OPENCODE_URL, discovered ports, default) with GET /session, short cache, optional Basic auth. |
| `tests/opencode-detect.test.js` | Fake HTTP servers (valid, wrong service, none, 401, auth header) and injected process/port lists. |
| `tests/agent-activity-opencode.test.js` | OpenCode detection in the legacy activity poll: `time_updated`/`updated_at` schemas, stale and child sessions, missing db gives 0. |
| `tools/lib/engines/claude-tool-use.js` | Pure allow-list extraction of Skill/Agent/Task `tool_use` metadata and `tool_result` outcome; keeps no prompts or outputs. |
| `tests/claude-tool-use.test.js` | Tool-use helper and parser tests: Skill/Agent/Task, dedup, resultOk true/false/null, privacy sentinels, unchanged SSE chunks. |
| `tests/chat-tool-use-telemetry.test.js` | Tracker `skill.loaded`/`tool.invoked` publishing: metadata payloads, duplicate suppression, cancel flush, isolated failure. |
| `tests/claude-stream-callid-replay.test.js` | Experiment Q3: replays synthetic lines through stream parser and usage ingest to prove the same callId (message.id) for the T4.1e join. |
| `ui/server/services/orchestration/workflow-attempt.service.js` | Workflow stage attempt model (T4.1c): open/reopen as attempt N+1, close on outcomes, engine session, attemptId/attemptNo on payloads. |
| `tests/workflow-attempt.test.js` | Attempt unit tests: idempotent start, restart after blocked, close outcomes, failed ends run, opt-in retry, validation sanitising. |
| `tests/workflow-attempt-events.test.js` | Integration tests: attempt_id in the EP-09 store, replay no-op, no note text stored, HTTP controller, `allowRetryAfterFailure` boolean only. |
