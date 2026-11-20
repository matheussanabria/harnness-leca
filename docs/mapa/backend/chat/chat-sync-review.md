---
domain: backend
module: chat
feature: chat-sync-review
summary: Interactive chat and engines, conversation sync, memory review and skills management controllers.
paths: [ui/server/controllers/chat.controller.js, ui/server/controllers/sync.controller.js, ui/server/controllers/review.controller.js, ui/server/controllers/skills.controller.js, ui/server/services/auto-sync.service.js, tools/lib/sync-fingerprint.js, tools/lib/envelope.js, tests/auto-sync.test.js]
keywords: [autosync, fingerprint, envelope, chat, sse, engines, sync, review, memory, skills]
updated: 2026-11-20
---
# Chat, Sync, Review and Skills

| File | Responsibility |
|---|---|
| `ui/server/controllers/chat.controller.js` | SSE streaming (`/api/chat`), reattach (`/api/chat/attach`, falls back to the run journal), persistence (`/api/chat/save`), DAI catalog and engines. |
| `ui/server/controllers/sync.controller.js` | Triggers `tools/sync.js` and streams its logs (`POST /api/sync`); shares a mutual-exclusion lock with the auto sync. |
| `ui/server/services/auto-sync.service.js` | Background sync: watches the Claude/Gemini/opencode folders, debounces 20 s, 60 s minimum gap, 5 min fallback interval, runs `tools/sync.js` in a child process, one run at a time. `HARNESS_AUTOSYNC=0` disables it. |
| `tools/lib/sync-fingerprint.js` | Per-session source fingerprint cache (`logs/sync-fingerprints.json`) so importers skip unchanged sessions; bump `IMPORTER_VERSION` when the output format changes. |
| `tools/lib/envelope.js` | Strips IDE/harness injected blocks (`contexto_do_harness`, `system-reminder`...) from user text and detects envelope-polluted titles. |
| `tests/auto-sync.test.js` | Auto sync switch, manual/auto lock, fingerprint cache and envelope helper. |
| `ui/server/controllers/review.controller.js` | Lists, approves and discards extracted suggestions (`/api/project/:slug/review`). |
| `ui/server/controllers/skills.controller.js` | CRUD for project skills (`.agents/skills`), template install and import. |
