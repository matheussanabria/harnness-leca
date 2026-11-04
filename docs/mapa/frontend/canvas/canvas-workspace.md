---
domain: frontend
module: canvas
feature: canvas-workspace
summary: Canvas Design views as a three-column workspace: board catalog, chat dock and the embedded editor (EP-19.06).
paths: [ui/public/js/modules/design-canvas-*.js, ui/public/css/design/07-canvas-catalog.css, tests/design-canvas-*.test.js]
keywords: [canvas, catalog, mindmap, board, design, workspace, chat, sidebar, ep-19]
updated: 2026-11-04
---
# Canvas workspace (EP-19.06)

The Design views `canvas-mindmap` and `canvas-board` follow the Atelier layout: board catalog on the left, chat dock in the middle, editor on the right.

| File | Responsibility |
|---|---|
| `ui/public/js/modules/design-canvas-api.js` | `createCanvasApi(slug)`: list by kind, create with a starter document, rename (GET then PUT with rev, one retry on 409) and delete boards. |
| `ui/public/js/modules/design-canvas-catalog.js` | `canvasCatalogHtml` (pure, escaped markup reusing the prototype catalog classes) and `mountCanvasCatalog` (select, create, inline rename, two-step delete). |
| `ui/public/css/design/07-canvas-catalog.css` | Styles of the inline rename input and the item action buttons. |
| `tests/design-canvas-catalog.test.js` | API client (fake fetch) and catalog markup tests. |
