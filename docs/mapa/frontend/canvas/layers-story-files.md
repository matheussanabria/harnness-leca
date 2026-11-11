---
domain: frontend
module: canvas
feature: layers-story-files
summary: Stories and files panel of the Layers map, read from doc/scrum/_historias-arquivos.json of the project repo.
paths: [ui/server/services/story-files.service.js, ui/server/controllers/design-story-files.controller.js, ui/public/js/modules/design-layers/layers-story-files.js, ui/public/css/design/35-layers-story-files.css, tests/layers-story-files.test.js, tests/design-story-files-route.test.js]
keywords: [historias, arquivos, rastreabilidade, mapa em camadas, story-files, git log, DIS, painel]
updated: 2026-11-11
---
# Layers map: stories and files panel

Data comes from `tools/rastreio-historias.js` (see `docs/mapa/tools/rastreio/historias.md`), which writes `doc/scrum/_historias-arquivos.json` in the project repo. The Harness only reads it; regenerate it to refresh.
Flow: `GET /api/project/:slug/design/story-files` (route in `ui/server/routes/design.routes.js`) -> `readStoryFiles(repoRoot)` -> `loadStoryFiles` (called from `design.js`) stores it in `dls.storyFiles` -> `design-layers-workspace.js` renders the panel under the two columns. Missing file answers `found:false` and the panel shows the generation command.
The service keeps only keys like `DIS-443` / `DIS-XXX` and the fields the panel renders (`titulos`, `commits`, `repos[].path/commits`).

| File | Responsibility |
|---|---|
| `ui/server/services/story-files.service.js` | Reads and normalizes the JSON (missing, oversized, invalid, malformed stories). |
| `ui/server/controllers/design-story-files.controller.js` | Route handler: resolves the project repo and returns the service result. |
| `ui/public/js/modules/design-layers/layers-story-files.js` | Panel markup: stories sorted by commits, collapsible files per repo, escaped text. |
| `ui/public/css/design/35-layers-story-files.css` | Panel styles (collapsible rows, file chips, mobile wrap). |
| `tests/layers-story-files.test.js` | Service, sorting, panel rendering and the real generated file when present. |
| `tests/design-story-files-route.test.js` | Route: missing file, file in the repo, unknown project. |

Touched, not owned: `design.js` (one `loadStoryFiles(slug)` call), `design-layers.js` (re-export), `design-layers-store.js` (`storyFiles`), `design-layers-workspace.js` (render call), `design.css` (import), `design.routes.js` (route).
