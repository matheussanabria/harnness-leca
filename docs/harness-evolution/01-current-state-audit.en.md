# Current-State Audit

[Leia em português](01-current-state-audit.md).

> Historical planning note: this document describes the diagnosis recorded in the source. This translation preserves the source's status and dates; it is not a new verification of the implementation.

## Inventory

| Area | Observed implementation | Evidence |
|---|---|---|
| Runtime | Node.js >= 22.13, CommonJS on the server and native ES Modules in the browser, no npm dependencies | `package.json`; `ui/server.js`; `ui/public/js/app.js` |
| HTTP | Custom server, declarative router, and domain-based controllers | `ui/server/router.js`; `ui/server/controllers/` |
| Web state | Global object; draft and active conversation per project in `localStorage` | `ui/public/js/shared/state.js` |
| Chat | Modular facade over store, send, SSE, rendering, persistence, attachments, permissions, and miniwidget | `ui/public/js/modules/chat.js`; `chat-*.js`; `chat.controller.js` |
| Engines | `{ id, stream, status }` interface; Claude, Gemini, OpenCode, and Codex | `tools/lib/engines/index.js`; `catalog.json` |
| Studio | Modular facade, iframe/companion, shared history, and resizable sidebar | `studio.js`; `studio-core.js`; `studio-companion.js` |
| Prototypes | Storage, versions, sanitization, preview, editing, and export | `ui/server/services/prototype-*.service.js` |
| Scrum | Stories, epics, and sprints in `projects/<slug>/scrum.json`; four fixed statuses | `project-scrum-*.js`; `scrum.controller.js` |
| Layer Map | Layer services and modular six-tab UI | `design-layers.service.js`; `modules/design-layers/` |
| Components | Discovery, six milestones, and context handoff to chat | `design-index.service.js`; `design-stage.service.js`; `design-board.js` |
| Audit | Metrics derived from rules, tests, legacy code, and components | `project-audit.service.js`; `design-audit-*.js` |
| Agents | Event contract, projection, deduplication, and adapters | `services/orchestration/`; `tests/orchestration.test.js` |
| Tests | `node:test`; server, engines, permissions, design, and prototypes | `tests/*.test.js` |

## Flows

1. `boot.js` loads partials before `app.js`.
2. Chat sends the engine, context, history, and settings to `POST /api/chat`.
3. The controller selects the engine and returns SSE; the UI updates `state.chatTurns`.
4. The conversation stays local and is saved as Markdown through `/api/chat/save`.
5. Studio switches presentation while calling the same history and send logic.
6. Scrum reads or initializes `scrum.json`, sanitizes it, and saves the complete document.

## Constraints

- There is prior uncommitted work across much of the repository; this audit does not modify it.
- Authoring exceptions to the 300-line limit: `studio.html` (411), `prototype-atelier.js` (380), `03-barra-camadas.css` (1437), and `04-mini-chat-dock.css` (304). `OrbitControls.js` is vendor code.
- The cited comparative screenshots were not provided; visual fidelity and image-based regression cannot be verified.
- `package.json` has no coverage tool; the existence of tests does not establish a coverage percentage.
