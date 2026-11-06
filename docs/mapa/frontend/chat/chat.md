---
domain: frontend
module: chat
feature: chat
summary: Chat modules: send, stream, compare, render, sessions, persistence, mini dock, HIA feedback, canonical models.
paths: [ui/public/js/modules/chat*.js, ui/public/js/types/chat-models.d.ts, ui/public/css/chat/04-mini-chat-dock.css, tests/chat-*.test.js]
keywords: [chat, streaming, sse, compare, mini-dock, session, persist, hia, thinking, presentations]
updated: 2026-11-06
---
# Chat Modules

| File | Responsibility |
|---|---|
| `ui/public/js/modules/chat.js` | Aggregating chat facade (engines, SSE streaming, persistence, mini-dock). Split into `chat-*.js` modules; `chat-store.js` holds the shared mutable state. |
| `ui/public/js/modules/chat-code-actions.js` | Copy code (`copyCodeFromContainer`) and apply single files to the Prototype Atelier (`applySingleAtelierFile`). |
| `ui/public/js/modules/chat-ui-interaction.js` | Provider menus, more options, settings, scroll anchoring in the 3 presentations, composer for Chat and Studio. |
| `ui/public/js/modules/chat-render.js` | Renders history in the 3 presentations, comparison arena with timer, collapsible thinking, smart scroll anchor. |
| `ui/public/js/modules/chat-render-thinking.js` | "Internal reasoning" block: keeps scroll and open/closed choice across redraws; counter, expand and copy bar. |
| `tests/chat-render-thinking.test.js` | Tests for the reasoning block behavior. |
| `ui/public/js/modules/chat-presentations.js` | Declarative contract of IDs, menus and controls shared by the main, Studio and compact (`mini`) presentations. |
| `ui/public/js/modules/chat-mini.js` | Floating Picture-in-Picture mini dock: engine badge, preview, live streaming, standalone composer, cancel. |
| `ui/public/css/chat/04-mini-chat-dock.css` | Styles for the mini chat dock. |
| `ui/public/js/modules/chat-models.js` | Pure `ChatMessage`, `ChatSession` and `ChatExecutionState` entities with automatic code block extraction. |
| `ui/public/js/types/chat-models.d.ts` | Type declarations for the canonical chat models. |
| `ui/public/js/modules/chat-session-store.js` | Isolates engine sessions per project and conversation (4 canonical engines), mirrored in `localStorage` key `harness:engine-sessions:v1` (60 chats max). |
| `tests/chat-session-persistence.test.js` | Tests that the engine session survives F5 and that "New chat" resets it. |
| `ui/public/js/modules/chat-continue.js` | Continue-previous-chat modal (`continueChatDlg`), search, engine filters with FontAwesome, session reset. |
| `ui/public/js/modules/chat-persist.js` | Manual and auto save to disk, runtime session migration, history rehydration (`resumeExistingChat`). |
| `ui/public/js/modules/chat-execution-store.js` | Canonical execution lifecycle (`idle`, `streaming`, `waiting_approval`, `cancelled`, `error`), reactive listeners, granular cancel. |
| `ui/public/js/modules/chat-send.js` | Sends messages in single or compare mode with isolated AbortController and canonical sessions. |
| `ui/public/js/modules/chat-send-compare.js` | Compare mode: fires the selected engines in parallel and fills the comparison turn. |
| `ui/public/js/modules/chat-stream-resume.js` | Reads the chat SSE stream and reattaches by `seq` after a screen lock or app switch; the stop button also stops the run on the server. |
| `ui/public/js/modules/chat-stream-ui.js` | Reactive send/cancel button sync in the 3 presentations and stream cancellation. |
| `ui/public/js/modules/chat-hia-feedback.js` | Local execution status, Script-First route metadata and tokens-saved counter per session. |
| `ui/public/js/modules/chat-hia-panel.js` | Consumes `GET /api/hia/metrics` and renders telemetry, hardware and routing state in the settings popover. |
