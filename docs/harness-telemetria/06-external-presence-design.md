# External session presence and activity (design, story T2.4)

Status: proposal, 2026-10-24. Source of the problem: office screenshots showed 0 sessions in the Central while a terminal Claude session was running, and every engine panel showing "1 chat(s) em andamento".

## Problem
Only chats started through the Harness (`POST /api/chat`) publish to the EP-09 store (T2.2). Sessions of Claude Code, Codex and Antigravity started in a terminal or IDE are seen only by the file-polling heuristics in `ui/server/services/agent-activity.service.js` (Claude is forced to at least 1 active; Gemini counts a transcript written in the last 30 minutes as active; Codex is not detected). Those heuristics never reach the EP-09 projection, and with the stream connected the office ignores them (T2.3 precedence rule).

## Principle (pre-plan section 5)
- Presence (is the session there) and activity (is it working) are separate fields. Expiry of presence is never "completed".
- Everything derived from file timestamps is `relation: inferred`, `trust: inferred`. Never claim a state we cannot observe: unknown stays unknown.
- Metadata only: the scanner stats files and reads names; it does not read transcript contents.

## Inference rules (defaults, constants in one module, configurable)
Signal = last write time (mtime) of the session's transcript/rollout/db row.

| Age of last signal | activity | presence |
|---|---|---|
| < 30 s | `processing` | `connected` |
| 30 s to 15 min | `idle` | `connected` |
| 15 min to 8 h | `unknown` | `no_recent_signal` |
| > 8 h | not published (no new event) | - |

An agent waiting for a long tool call or for approval can look idle; this is a documented limitation, not hidden. Hooks or OTLP (later stories) replace the heuristic with observed activity.

## Sources (read only)
- Claude Code: `~/.claude/projects/<cwd-slug>/<sessionId>.jsonl`, session id from the file name.
- Codex: rollout JSONL under the Codex sessions folder (verify the real path locally; A5 found the format).
- Antigravity: `~/.gemini/antigravity-ide/brain/<uuid>/.system_generated/logs/transcript.jsonl` and the second root `~/.gemini/antigravity/brain` (A6).
- OpenCode: `session` table of `~/.local/share/opencode/opencode.db`, read-only, top-level sessions (`parent_id IS NULL`), `updated_at`.
Project attribution: reuse how the repo already maps a working directory to a project slug (importers and `projects/.sources.json`); sessions that match no project are skipped and counted, not invented.

## Event contract (additive; no new event type)
`session.discovered` the first time a session is seen, then `session.updated` only when activity or presence changes (never on every scan). Envelope: `sessionId` = native session id prefixed by engine when ids can collide, `nativeSessionId`, `engineInstanceId` = `<engine>@<host>`, `relation: inferred`, `trust: inferred`, source `{provider: <engine>, kind: "presence-scanner"}`, `idempotencyKey` = `presence|<engine>|<sessionId>|<activity>|<presence>|<bucket>` where bucket makes repeated identical states a no-op.
Payload: `{ origin: "external", engine, activity, presence, lastActivityAt, lastSeenAt, signal: "mtime" }`.

## Session projection additions (event-projector)
Each session view gains `origin` (`harness_chat` or `external`), `activity` (`processing|idle|unknown`), `presence` (`connected|no_recent_signal|unknown`), `lastActivityAt`, `lastSeenAt`. Existing fields and the frozen read contract do not change. Latest occurrence time wins per field (event-order rules).

## Office rule
Engine `activeCount` = running Harness executions + external sessions with `activity = processing`, without double counting a session that is also a Harness run (same `nativeSessionId`). Connected-idle external sessions are shown as "N open", not as working. The panel never shows a count when it is 0 (remove the `activeCount || 1` fallback in `office-desk-dossier.js`).

## Runtime
A scanner service started with the server, timer `unref`'d, default interval 5 s, disabled by `HARNESS_PRESENCE=0`. Measure CPU/time per scan with ~500 transcripts and record it in the story report (resource budget, pre-plan section 12).

## Out of scope
Real activity from hooks/OTLP, token usage, subagent links, cancel/approve controls, per-project streams.
