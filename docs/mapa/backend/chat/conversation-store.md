---
domain: backend
module: chat
feature: conversation-store
summary: Chat conversations, engine sessions and messages in SQLite (EP-17.02); the server resolves the engine session.
paths: [ui/server/db/migrations/002-chat.js, ui/server/db/repos/chat.repo.js, ui/server/services/chat/conversation.service.js, ui/server/services/chat/md-import.js, ui/server/controllers/chat-conversations.controller.js, ui/public/js/modules/chat-conversation-api.js, tools/migrate/chat-import.js, tests/chat-repo.test.js, tests/chat-conversation-api.test.js, tests/chat-import-md.test.js, tests/chat-session-server.test.js]
keywords: [chat, conversation, session, engine session, f5, refresh, sqlite, import, ep-17]
updated: 2026-11-20
---
# Chat conversation store

`chat_conversations`, `chat_engine_sessions` and `chat_messages` live in `data/harness.sqlite` (owner: the web server; the one-time importer is the only CLI writer). A conversation is linked to its `projects/<slug>/chats/*.md` file by `source_file`; the .md files are still written and stay the rollback path (`HARNESS_CHAT_STORE=file`).

| File | Responsibility |
|---|---|
| `ui/server/db/migrations/002-chat.js` | Creates the three tables; `seq` unique per conversation, one session per conversation and engine. |
| `ui/server/db/repos/chat.repo.js` | Conversations (create, by file, list newest activity first, rename, archive), engine sessions (upsert), messages (append with server-side seq, page by seq). |
| `ui/server/services/chat/conversation.service.js` | Opens the repository lazily and fails open; mirrors `POST /api/chat/save` (appends only new turns), records engine sessions, imports the browser session map; redacts content on write. |
| `ui/server/services/chat/md-import.js` | Parses one chat .md into messages (thinking kept apart, tool blocks dropped). |
| `ui/server/controllers/chat-conversations.controller.js` | `GET/POST /api/chat/conversations`, `GET/PATCH /api/chat/conversations/:id`, `POST .../sessions`, `POST .../import-sessions`; 503 when the store is off. |
| `ui/public/js/modules/chat-conversation-api.js` | Browser calls to that API; every call fails soft. |
| `tools/migrate/chat-import.js` | Idempotent import of every project's chat .md files (`--project`, `--dry-run`, `--projects`). |
| `tests/chat-repo.test.js` | Monotonic seq, paging, idempotent link by file, session upsert, list and archive. |
| `tests/chat-conversation-api.test.js` | Save mirror, session across a restart, create/rename/archive, map import, redaction, rollback flag. |
| `tests/chat-import-md.test.js` | The two 2026-11-01 PRD chats import once; redaction on import. |
| `tests/chat-session-server.test.js` | Regression of the F5 incident: cleared storage resumes the same engine session from the server. |

The browser cache is `ui/public/js/modules/chat-session-store.js` (`reconcileEngineSessions`, `migrateLocalSessionsOnce`); see `docs/mapa/frontend/chat/chat.md`.
