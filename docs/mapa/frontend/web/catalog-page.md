---
domain: frontend
module: web
feature: catalog-page
summary: Standalone /catalogo page: skills and agents in separate tabs, grouped by area, with a file browser per item.
paths: [ui/public/catalogo.html, ui/public/css/catalogo.css, ui/public/js/catalogo/*.js, ui/server/services/catalog/*.js, ui/server/controllers/catalog.controller.js, ui/server/routes/catalog.routes.js, tests/catalog.test.js, tests/catalog-files.test.js]
keywords: [catalog, catalogo, skills, agents, area, documentation, frontend, group, override, browser, tree, files]
updated: 2026-11-06
---
# Skills and agents catalog (/catalogo)

Reads `~/.claude/skills`, `~/.claude/agents` and the harness `.agents/skills`. Each item gets a suggested area from keywords in its name and description; a manual choice is saved in `global/catalog-areas.json` (key `skill:<name>` or `agent:<name>`) and wins over the suggestion. Skills and agents are separate tabs. Opening an item shows its file tree (a skill is a folder, an agent is one `.md` file) and a viewer (rendered markdown or raw code). Writes and file browsing are limited to loopback; paths are validated (no `..`, dot entries, `node_modules` or symlinks leaving the item). Nav entry in `app-header.js`, route in `static.controller.js`.

| File | Responsibility |
|---|---|
| `ui/server/services/catalog/catalog-areas.js` | Area list (id, label, icon, keywords) and the pure `classify` suggester. |
| `ui/server/services/catalog/catalog-reader.js` | Reads skills and agents from the sources, applies overrides, returns items and per-area counts. |
| `ui/server/services/catalog/catalog-overrides.js` | Reads and atomically writes the manual area choices. |
| `ui/server/services/catalog/catalog-files.js` | Read-only file tree and text file reader for one item, with path, symlink and size guards. |
| `ui/server/controllers/catalog.controller.js` | `GET /api/catalog`, `POST /api/catalog/area`, `GET /api/catalog/tree` and `GET /api/catalog/file` (loopback only). |
| `ui/server/routes/catalog.routes.js` | Registers the four catalog routes. |
| `ui/public/catalogo.html` | Page shell: Skills/Agentes tabs, search, area chips, list and the file browser panel. |
| `ui/public/css/catalogo.css` | Page styles (reuses `consumo.css` tokens). |
| `ui/public/js/catalogo/catalogo-model.js` | Pure filter, group-by-area and per-area counts. |
| `ui/public/js/catalogo/catalogo-view.js` | Escaped HTML for chips, groups and cards. |
| `ui/public/js/catalogo/catalogo-tree.js` | Pure helpers: tree HTML, default file (SKILL.md) and frontmatter split. |
| `ui/public/js/catalogo/catalogo-browser.js` | File browser controller: loads the tree, shows files, rendered/raw toggle. |
| `ui/public/js/catalogo/catalogo-page.js` | Controller: load, tabs, filters, open item, area change saved through the API. |
| `tests/catalog.test.js` | Classifier, reader, overrides, filter model and escaping tests. |
| `tests/catalog-files.test.js` | File tree and reader (traversal, binary, symlink) and tree view tests. |
