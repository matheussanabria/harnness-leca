---
domain: backend
module: chat
feature: chat-sync-review
summary: Interactive chat and engines, conversation sync, memory review and skills management controllers.
paths: [ui/server/controllers/chat.controller.js, ui/server/services/chat-run-registry.service.js, ui/server/controllers/sync.controller.js, ui/server/controllers/review.controller.js, ui/server/controllers/skills.controller.js]
keywords: [chat, sse, engines, sync, review, memory, skills]
updated: 2026-11-06
---
# Chat, Sync, Review and Skills

| File | Responsibility |
|---|---|
| `ui/server/controllers/chat.controller.js` | SSE streaming (`/api/chat`), persistence (`/api/chat/save`), DAI catalog and engines. |
| `ui/server/services/chat-run-registry.service.js` | Runs that outlive the HTTP connection: numbered event buffer, reattach (`GET /api/chat/attach`), stop (`POST /api/chat/stop`) and a grace period before an abandoned run is aborted. |
| `ui/server/controllers/sync.controller.js` | Triggers `tools/sync.js` and streams its logs (`POST /api/sync`). |
| `ui/server/controllers/review.controller.js` | Lists, approves and discards extracted suggestions (`/api/project/:slug/review`). |
| `ui/server/controllers/skills.controller.js` | CRUD for project skills (`.agents/skills`), template install and import. |
