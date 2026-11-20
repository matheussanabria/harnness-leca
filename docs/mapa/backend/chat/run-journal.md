---
domain: backend
module: chat
feature: run-journal
summary: Chat runs that outlive the connection and the process: live registry plus SQLite run journal (EP-23.02).
paths: [ui/server/services/chat-run-registry.service.js, ui/server/services/chat-run-journal.service.js, ui/server/db/repos/chat-runs.repo.js, ui/server/db/migrations/011-chat-runs.js, tests/chat-runs-repo.test.js, tests/chat-run-registry.test.js]
keywords: [chat, run, reattach, attach, journal, sse, sqlite, interrupted, ep-23]
updated: 2026-11-20
---
# Chat run journal

Every event of a chat run is written to `chat_runs` / `chat_run_events` in `data/harness.sqlite` before the browser sees it. Memory is only the live cache; `GET /api/chat/attach` replays from the journal once the run left memory. `HARNESS_RUN_JOURNAL=0` falls back to memory only.

| File | Responsibility |
|---|---|
| `ui/server/services/chat-run-registry.service.js` | Live runs: numbered events flushed per tick to the journal then to subscribers, reattach, stop and a grace period before an abandoned run is aborted. |
| `ui/server/services/chat-run-journal.service.js` | Opens the journal lazily, marks runs of a previous process interrupted, prunes runs older than 30 days, scrubs secrets, rebuilds a stored run for attach. |
| `ui/server/db/repos/chat-runs.repo.js` | `startRun`, idempotent `appendEvents` (run_id + seq), `endRun`, `readFrom`, `hasTerminalEvent`, `markInterruptedOnBoot`, `prune`. |
| `ui/server/db/migrations/011-chat-runs.js` | Creates `chat_runs` and `chat_run_events` (owner: web until EP-23.03). |
| `tests/chat-runs-repo.test.js` | Read from a seq, idempotence, final status, boot interruption, retention. |
| `tests/chat-run-registry.test.js` | Write before publish, attach one hour later, restart in a second process, secret scrubbing, journal off. |
