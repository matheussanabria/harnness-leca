---
domain: frontend
module: canvas
feature: canvas-workspace
summary: Canvas Design views as a three-column workspace: board catalog, chat dock and the embedded editor (EP-19.06).
paths: [ui/public/js/modules/design-canvas-*.js, ui/web/src/shared/EmptyPane.tsx, ui/web/src/shared/empty-pane.css, ui/public/css/design/07-canvas-catalog.css, tests/design-canvas-*.test.js]
keywords: [canvas, catalog, mindmap, board, design, workspace, chat, sidebar, ep-19]
updated: 2026-11-04
---
# Canvas workspace (EP-19.06)

The Design views `canvas-mindmap` and `canvas-board` follow the Atelier layout: board catalog on the left, chat dock in the middle, editor on the right.

| File | Responsibility |
|---|---|
| `ui/public/js/modules/design-canvas-api.js` | `createCanvasApi(slug)`: list by kind, create with a starter document, rename (GET then PUT with rev, one retry on 409) and delete boards. |
| `ui/public/js/modules/design-canvas-catalog.js` | `canvasCatalogHtml` (pure, escaped markup reusing the prototype catalog classes) and `mountCanvasCatalog` (select, create, inline rename, two-step delete). |
| `ui/public/js/modules/design-canvas-workspace.js` | `canvasWorkspaceHtml` and `renderCanvasWorkspace`: Atelier-style three columns (catalog, Studio chat dock, editor stage), reusing `initWorkspaceLayout`, the `#protoWorkspaceRoot` and `#atelierChatHost` ids and the chat attach helpers; mounts the island with the selected board in `params[0]`. |
| `ui/web/src/shared/EmptyPane.tsx` | Placeholder shown by an embedded island when no board is selected in the catalog. |
| `ui/public/js/modules/canvas-chat-bridge.js` | Studio chat bridge for the mind map: adds the rules and the current map (from `harness:canvas-state`) to the prompt and hands `<mindmap>` blocks of the answer to the island with `harness:canvas-apply`. Hooked into `prototype-chat-bridge.js` and `chat-persist.js`. |
| `ui/public/css/design/07-canvas-catalog.css` | Styles of the inline rename input and the item action buttons. |
| `tests/design-canvas-catalog.test.js`, `tests/design-canvas-workspace.test.js`, `tests/canvas-chat-bridge.test.js` | API client (fake fetch) and catalog markup tests. |
