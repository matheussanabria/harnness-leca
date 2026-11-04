---
domain: backend
module: screen-state
feature: screen-state
summary: Screen state registry, storage, controller and routes for per-screen UI state and history.
paths: [ui/server/services/screen-state/*.js, ui/server/controllers/screen-state.controller.js, ui/server/routes/screens.routes.js]
keywords: [screen-state, ui-state, registry, store, history, localstorage]
updated: 2026-10-30
---
# Screen State

| File | Responsibility |
|---|---|
| `ui/server/services/screen-state/registry.js` | Declares the 16 screens (including the canvas-mindmap and canvas-board Design views), scope, allowed typed fields, legacy `localStorage` keys, exclusions and 64 KB cap (EP-14.04). |
| `ui/server/services/screen-state/store.js` | Reads/writes `projects/<slug>/ui-state/<screen>.json` and `.history.jsonl` (global screens in `global/ui-state/`) atomically, `rev` concurrency, 500-action ring (EP-14.05). |
| `ui/server/controllers/screen-state.controller.js` | Catalog, per-screen state read/write and history read/append, mapping validation, conflict and size errors to HTTP (EP-14.05). |
| `ui/server/routes/screens.routes.js` | Groups `GET /api/screens` and per-screen state/history routes to keep `router.js` under the cap (EP-14.05). |
