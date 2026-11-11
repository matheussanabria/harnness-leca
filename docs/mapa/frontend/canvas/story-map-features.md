---
domain: frontend
module: canvas
feature: story-map-features
summary: Scrum story drawer lists the features a story owns or relates to, with View on map links into the Layers map.
paths: [ui/server/services/story-features.service.js, ui/server/services/project-screens-features.js, ui/server/services/feature-screen-adapter.js, ui/server/controllers/design-story-features.controller.js, ui/public/js/modules/design-scrum-story-features.js, ui/public/css/design/36-story-features.css, tests/story-features.test.js, docs/features/story-map-features/02-bdd.feature]
keywords: [historia, funcionalidade, mapa em camadas, ver no mapa, _status.md, mapa-camadas.json, scrum, drawer, DIS]
updated: 2026-11-11
---
# Story drawer: features on the map

Link data lives in the project repo: `doc/sistema/features/<slug>/_status.md` (`historias:` with a role, `principal` = owner, anything else = related) and `mapa-camadas.json` (screens).
Flow: `GET /api/project/:slug/design/story-features` -> `getProjectScreens` + `readStoryFeatures` -> `loadStoryFeatures` fills the "Funcionalidades no mapa" section of the drawer. "Ver no mapa" closes the drawer and fires `harness:open-layer-target` (handled in `design.js`, which opens the Layers view on that screen).
The Layers map now also lists the screens of every `mapa-camadas.json`, appended after the canvas screens (`mergeScreens` skips a screen whose route already exists; the link then points to the canvas one). Ids are `<slug>-<screen>`.

| File | Responsibility |
|---|---|
| `ui/server/services/story-features.service.js` | Reads `_status.md` of each feature, groups by story (owner/related), resolves map screens. |
| `ui/server/services/project-screens-features.js` | Reads the `mapa-camadas.json` screens; merges them after the canvas screens without repeating routes. |
| `ui/server/services/feature-screen-adapter.js` | Converts a JSON screen (Portuguese keys, long statuses) to the Layers map screen shape. |
| `ui/server/controllers/design-story-features.controller.js` | Route handler. |
| `ui/public/js/modules/design-scrum-story-features.js` | Drawer section: loader, markup, click to open the map. |
| `ui/public/css/design/36-story-features.css` | Section styles. |
| `tests/story-features.test.js` | CP-01 to CP-08 plus adapter and real-data check. |
| `docs/features/story-map-features/02-bdd.feature` | BDD scenarios (CP-09 is manual, in the browser). |

Touched, not owned: `project-screens-fallback.js` (merge call), `design-scrum-story-drawer.js` (section), `design.routes.js` (route), `design.css` (import).
