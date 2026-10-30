---
domain: frontend
module: canvas
feature: canvas-board
summary: Atelier prototype canvas (model, store, engine, tools, play mode), design layers map and components board.
paths: [ui/public/js/modules/prototype-canvas/*.js, ui/public/js/modules/design-board*.js, ui/public/js/modules/design-*-state.js, ui/public/js/modules/design-layers.js]
keywords: [canvas, board, kanban, layers, atelier, camera, zoom, frames]
updated: 2026-10-30
---
# Prototype Canvas and Design Board

| File | Responsibility |
|---|---|
| `ui/public/js/modules/prototype-canvas/canvas-model.js` | Pure functions: document, camera (zoom at cursor, fit), items, hit-test, navigation order and saved-document validation. |
| `ui/public/js/modules/prototype-canvas/canvas-store.js` | Reads/writes the canvas document in `localStorage` per project and prototype, with deferred saving. |
| `ui/public/js/modules/prototype-canvas/canvas-engine.js` | Canvas state (document, selection, tool, camera) and the world DOM holding the items. |
| `ui/public/js/modules/prototype-canvas/canvas-items-view.js` | Builds the DOM for frames (scaled iframes with shield), texts, notes and rectangles. |
| `ui/public/js/modules/prototype-canvas/canvas-code-block.js` | Code block (editor, language, sandboxed HTML preview, copy and download), base for the Design System framework. |
| `ui/public/js/modules/prototype-canvas/canvas-interactions.js` | Mouse, wheel (pan/zoom), drag, resize, drawing items and keyboard shortcuts. |
| `ui/public/js/modules/prototype-canvas/canvas-toolbar.js` | Tools (select, hand, frame, text, note, rectangle, code), zoom, duplicate, delete and Play. |
| `ui/public/js/modules/prototype-canvas/canvas-play.js` | Play navigation: each screen becomes a canvas frame and `goto:` links move the camera to the target frame. |
| `ui/public/js/modules/design-layers/` | Layered map in 2 columns: `layers-header` metrics, `layers-stages-nav`, `layers-tabs-nav` (6 tabs), `layers-screen-replica` and `layers-detail-*.js`. |
| `ui/public/js/modules/design-scrum-state.js`, `ui/public/js/modules/design-layers-state.js`, `ui/public/js/modules/design-audit.js` | Adopt the per-screen state client: snapshot, validated apply, single hydration, persistence keeping early user actions (EP-14.09). `design-audit.js` is split into `design-audit-*.js` with `design-audit-store.js` for shared state. |
| `ui/public/js/modules/design-board.js` | Component kanban with filter, grouping by stage/feature, card selection and 25-200% zoom persisted per screen (EP-14.09). |
| `ui/public/js/modules/design-board-card-parts.js` | Card badges (registered in DS, manual stage), prototype usage line and board toolbar; extracted from `design-board.js`. |
| `ui/public/js/modules/design-layers.js` | Layers facade; modules in `ui/public/js/modules/design-layers/`: `layers-header`, `layers-stages-nav`, `layers-tabs-nav`, `layers-screen-replica` (+ `-s2` to `-s4`), `layers-right-content`, `layers-detail-*`, `layers-state`. |
