---
domain: frontend
module: design
feature: history
summary: Atelier undo/redo history: server journal service and controller, client model, timeline panel and styles.
paths: [ui/server/services/prototype-history.service.js, ui/server/controllers/prototype-history.controller.js, ui/public/js/modules/prototype-history-*.js, ui/public/css/design/25-prototype-history.css]
keywords: [history, undo, redo, journal, timeline, shortcuts, withHistory]
updated: 2026-10-30
---
# Atelier History

| File | Responsibility |
|---|---|
| `ui/server/services/prototype-history.service.js` | Undo/redo of every prototype change: journal plus content blobs in `.history/`; external changes become "Alteração externa". |
| `ui/server/controllers/prototype-history.controller.js` | Routes `history`, `history/undo`, `history/redo`, `history/goto` (registered in `design.routes.js`; `prototype.controller.js` records via `withHistory`). |
| `ui/public/js/modules/prototype-history-model.js` | Client model of the history timeline and undo/redo state. |
| `ui/public/js/modules/prototype-history-panel.js` | Undo/Redo/History buttons, timeline panel and Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y (also from the iframe via `HARNESS_PROTO_SHORTCUT`). |
| `ui/public/css/design/25-prototype-history.css` | Styles of the history buttons and timeline panel. |
