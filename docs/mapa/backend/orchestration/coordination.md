---
domain: backend
module: orchestration
feature: coordination
summary: Automatic multi-agent coordination CLI, library, ledger, events, inboxes and ADR.
paths: [tools/coordination.js, tools/lib/coordination/**, docs/harness-evolution/03-decisions/ADR-007-ledger-coordenacao-agentes.md]
keywords: [coordination, claim, handoff, ledger, inbox, agents]
updated: 2026-10-30
---
# Automatic agent coordination

| File | Responsibility |
|---|---|
| `tools/coordination.js` | CLI for init, sync, status, claim, start, heartbeat, block, complete, handoff, notify and inbox. |
| `tools/lib/coordination/` | Config of the four providers, backlog import, reducer, lock/persistence and projections. |
| `projects/<slug>/coordination/state.json` | Canonical versioned ledger of the project. |
| `projects/<slug>/coordination/events/*.jsonl` | Append-only audit log, split by event origin. |
| `projects/<slug>/coordination/inbox/*.md` | Generated inboxes for Claude, Gemini, OpenCode and Codex. |
| `projects/<slug>/context/coordination.md` | Generated summary any agent can load at task start. |
| `docs/harness-evolution/03-decisions/ADR-007-ledger-coordenacao-agentes.md` | Architectural decision and alternatives of the protocol. |
