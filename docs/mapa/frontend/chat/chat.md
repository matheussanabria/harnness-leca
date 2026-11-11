---
domain: frontend
module: chat
feature: chat
summary: Chat modules: send, stream, compare, render, sessions, persistence, mini dock, HIA feedback, canonical models.
paths: [ui/public/js/modules/chat*.js, ui/public/js/types/chat-models.d.ts, ui/public/css/chat/04-mini-chat-dock.css, tests/chat-*.test.js, tests/bdd-traceability.test.js, docs/features/chat-clipboard-drop/*]
keywords: [chat, streaming, sse, compare, mini-dock, session, persist, hia, thinking, presentations]
updated: 2026-11-11
---
# Chat Modules

| File | Responsibility |
|---|---|
| `ui/public/js/modules/chat.js` | Aggregating chat facade (engines, SSE streaming, persistence, mini-dock). Split into `chat-*.js` modules; `chat-store.js` holds the shared mutable state. |
| `ui/public/js/modules/chat-code-actions.js` | Copy code (`copyCodeFromContainer`) and apply single files to the Prototype Atelier (`applySingleAtelierFile`). |
| `ui/public/js/modules/chat-attachments.js` | Chat attachments (files, images, audio): upload on pick, paste (`onChatPaste`, also in Studio) and drop (`uploadChatFiles`); chips in the 3 trays. |
| `ui/public/js/modules/chat-attachments-input.js` | Pure clipboard/drop helpers (`filesFromTransfer`, `pastedFileName`) and `bindChatDrop`, a document-level drop delegate for composers and histories with the `chat-drop-active` highlight. |
| `tests/chat-attachments-input.test.js` | Tests the paste/drop helpers and the drop delegation (zone highlight, ignored drops). |
| `docs/features/chat-clipboard-drop/02-bdd.feature` | BDD scenarios CP-01..CP-11 for paste and drop (US-1794180293134); `@auto` ones are named in test titles, `@manual` ones need the browser. |
| `tests/bdd-traceability.test.js` | Guard: every `@auto` scenario id in `docs/features/*/02-bdd.feature` must appear in a test title under `tests/`. |
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
| `ui/public/js/modules/chat-scope.js` | Chat per project and scope (general chat, each design tab): `parkActiveChat`, `adoptStoredChat`, `switchChatScope`, `isActiveChatStreaming`/deferred switch while an answer streams, `latestSavedChat` (quiet restore of the newest saved chat when the browser has none), `setChatArtifact` (scope per artifact: `design:<view>:<mapId|protoId>`). Called by `projects-load.js` on project switch and by `persistDesignView`. Storage key `harness_active_chat_<slug>[::design:<view>]`; unsaved engine sessions are also scoped. |
| `ui/public/js/modules/chat-tabs.js` | Multi-tab presence over BroadcastChannel: tabs never block each other; a warning shows only when two tabs hold the same chat key (`chatPresence`, `createChatPresence`). Chat send warns without blocking. |
| `tests/chat-tabs.test.js` | Tests same-chat conflict warning, silence for different artifacts, and that two tabs do not erase each other's engine sessions. |
| `tests/chat-scope-state.test.js` | Tests per-project and per-scope isolation of the active chat and draft engine sessions. |
| `ui/public/js/modules/chat-continue.js` | Continue-previous-chat modal (`continueChatDlg`), search, engine filters with FontAwesome, session reset. |
| `ui/public/js/modules/chat-persist.js` | Manual and auto save to disk, runtime session migration, history rehydration (`resumeExistingChat`). |
| `ui/public/js/modules/chat-execution-store.js` | Canonical execution lifecycle (`idle`, `streaming`, `waiting_approval`, `cancelled`, `error`), reactive listeners, granular cancel. |
| `ui/public/js/modules/chat-send.js` | Sends messages in single or compare mode with isolated AbortController and canonical sessions. |
| `ui/public/js/modules/chat-send-compare.js` | Compare mode: fires the selected engines in parallel and fills the comparison turn. |
| `ui/public/js/modules/chat-stream-resume.js` | Reads the chat SSE stream and reattaches by `seq` after a screen lock or app switch; the stop button also stops the run on the server. |
| `ui/public/js/modules/chat-stream-ui.js` | Reactive send/cancel button sync in the 3 presentations and stream cancellation. |
| `ui/public/js/modules/chat-hia-feedback.js` | Local execution status, Script-First route metadata and tokens-saved counter per session. |
| `ui/public/js/modules/chat-hia-panel.js` | Consumes `GET /api/hia/metrics` and renders telemetry, hardware and routing state in the settings popover. |
| `ui/public/js/modules/chat-workflow-command.js` | Intercepts `/workflows` and `/workflow <slug> <desc>` in `chat-send.js`, posts to the workflow-command route, shows list/error/stage cards and "Executar etapa" injects the stage prompt in the composer and sends it with a short bubble text (full prompt kept aside); "Concluir e avançar"/approve appears only after the reply finished without error and moves the stage (card refreshed from the server), and cancels a run from the card (`/workflows <slug> <desc>` is an alias; a description is required unless `--from`). |
| `ui/public/js/modules/chat-user-turn.js` | User turn with a short bubble text and the full prompt kept aside (`buildUserTurn`), `engineText` (the engine and history replay always get the full prompt) and `userBubbleHtml` (escaped "Ver prompt" toggle). |
| `tests/chat-user-turn.test.js` | Covers the short/full turn, the engine text and the escaped bubble html. |
| `ui/public/js/modules/chat-workflow-command-view.js` | Pure escaped renderers for the workflow list, error and stage card (FontAwesome icons). |
| `ui/public/js/modules/chat-workflow-suggest.js` | Autocomplete of commands and slugs in the chat inputs, fed by `GET /api/orchestration/workflow-commands` (catalog is the single source). The popover is appended inside the chat `<dialog>` (top layer), never on the body. |
| `tests/workflow-suggest-dialog.test.js` | Regression: the suggestion popover must live inside the modal dialog to be visible. |
| `ui/public/css/chat/08-chat-workflow-command.css` | Styles for the workflow cards and the suggestion popover. |
