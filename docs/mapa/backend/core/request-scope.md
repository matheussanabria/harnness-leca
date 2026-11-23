---
domain: backend
module: core
feature: request-scope
summary: Explicit request scope, reserved slugs and the chat validators that accept the personal workspace (EP-25.02).
paths: [ui/server/scope/*.js, tests/scope-resolve.test.js, tests/scope-chat.test.js, tests/scope-canvas.test.js]
keywords: [scope, escopo, pessoal, personal, workspace, reserved, header, active, chat]
updated: 2026-11-23
---
# Request scope and personal workspace

| File | Responsibility |
|---|---|
| `ui/server/scope/reserved.js` | Reserved folder names (`_template`, `_pessoal`); no dependencies so `config.js` and `tools/lib/state.js` can use it. |
| `ui/server/scope/personal-workspace.js` | Creates `projects/_pessoal/` (chats, context, scheduled, instructions, memory) on first use, without overwriting. |
| `ui/server/scope/resolve-scope.js` | `resolveScope(req)`: `X-Harness-Project` header first, `.active` only as default; `acceptsScope(slug)`: validator for features that accept the personal workspace. |
| `tests/scope-resolve.test.js` | Header precedence, `.active` as default, personal selection, reserved slugs hidden from `slugs()`, workspace creation. |
| `tests/scope-canvas.test.js` | Canvas in the personal workspace: full board lifecycle, registry owner, projects stay separate, reserved and unknown rejected. |
| `tests/scope-chat.test.js` | Chat save in `_pessoal` and in a real project, reserved and unknown slugs still rejected. |

- Canvas: `canvas-validate.js` (`resolveProject`) uses `acceptsScope`, so every Canvas route and service accepts `_pessoal` (EP-25.06 RF3).
- Chat validators using `acceptsScope`: `chat.controller.js` (save), `chat-conversations.controller.js`, `engine-host/run-starter.js`.
- Every other controller keeps `slugs().includes(slug)`, so `_pessoal` is rejected by project-scope features.
