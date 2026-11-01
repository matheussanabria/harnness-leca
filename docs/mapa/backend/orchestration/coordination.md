---
domain: backend
module: orchestration
feature: coordination
summary: Automatic multi-agent coordination CLI, library, ledger, events, inboxes and ADR.
paths: [tools/coordination.js, tools/lib/coordination/**, tests/coordination-flow.test.js, .agents/skills/multi-agent-coordination/references/scrum-multiagent-flow.md, docs/harness-evolution/03-decisions/ADR-007-ledger-coordenacao-agentes.md]
keywords: [coordination, claim, handoff, ledger, inbox, agents]
updated: 2026-10-31
---
# Automatic agent coordination

| File | Responsibility |
|---|---|
| `tools/coordination.js` | CLI for init, sync, status, claim, start, heartbeat, block, complete, handoff, notify and inbox. |
| `tools/lib/coordination/scopes.js` | Reads a story's file scope (`owns:` or the "## 5." list) and detects overlapping globs; the reducer refuses a claim that overlaps an active story. |
| `tools/lib/coordination/flow.js` | Scrum flow: worktree per claim (`agent/<provider>/<story>`), parallel sprint waves, commit check on `complete`, story delegation to OpenCode. |
| `tests/coordination-flow.test.js` | Scopes, overlap, claim refusal, worktree record, waves, commit check and delegation (fake OpenCode). |
| `.agents/skills/multi-agent-coordination/references/scrum-multiagent-flow.md` | Playbook: roles, waves, claim with worktree, delegate, verify, integrate. |
| `tools/lib/coordination/` | Config of the four providers, backlog import, reducer, lock/persistence and projections. |
| `projects/<slug>/coordination/state.json` | Canonical versioned ledger of the project. |
| `projects/<slug>/coordination/events/*.jsonl` | Append-only audit log, split by event origin. |
| `projects/<slug>/coordination/inbox/*.md` | Generated inboxes for Claude, Gemini, OpenCode and Codex. |
| `projects/<slug>/context/coordination.md` | Generated summary any agent can load at task start. |
| `docs/harness-evolution/03-decisions/ADR-007-ledger-coordenacao-agentes.md` | Architectural decision and alternatives of the protocol. |
