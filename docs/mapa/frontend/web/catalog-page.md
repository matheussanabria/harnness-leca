---
domain: frontend
module: web
feature: catalog-page
summary: Standalone /catalogo page listing skills and agents grouped by area, with a manual area override.
paths: [ui/public/catalogo.html, ui/public/css/catalogo.css, ui/public/js/catalogo/*.js, ui/server/services/catalog/*.js, ui/server/controllers/catalog.controller.js, ui/server/routes/catalog.routes.js, tests/catalog.test.js]
keywords: [catalog, catalogo, skills, agents, area, documentation, frontend, group, override]
updated: 2026-11-06
---
# Skills and agents catalog (/catalogo)

Reads `~/.claude/skills`, `~/.claude/agents` and the harness `.agents/skills`. Each item gets a suggested area from keywords in its name and description; a manual choice is saved in `global/catalog-areas.json` (key `skill:<name>` or `agent:<name>`) and wins over the suggestion. Writes are limited to loopback. Nav entry in `app-header.js`, route in `static.controller.js`.

| File | Responsibility |
|---|---|
| `ui/server/services/catalog/catalog-areas.js` | Area list (id, label, icon, keywords) and the pure `classify` suggester. |
| `ui/server/services/catalog/catalog-reader.js` | Reads skills and agents from the sources, applies overrides, returns items and per-area counts. |
| `ui/server/services/catalog/catalog-overrides.js` | Reads and atomically writes the manual area choices. |
| `ui/server/controllers/catalog.controller.js` | `GET /api/catalog` and `POST /api/catalog/area` (loopback only). |
| `ui/server/routes/catalog.routes.js` | Registers the two catalog routes. |
| `ui/public/catalogo.html` | Page shell: search, kind toggle, area chips, list. |
| `ui/public/css/catalogo.css` | Page styles (reuses `consumo.css` tokens). |
| `ui/public/js/catalogo/catalogo-model.js` | Pure filter, group-by-area and per-area counts. |
| `ui/public/js/catalogo/catalogo-view.js` | Escaped HTML for chips, groups and cards. |
| `ui/public/js/catalogo/catalogo-page.js` | Controller: load, filters, area change saved through the API. |
| `tests/catalog.test.js` | Classifier, reader, overrides, filter model and escaping tests. |
