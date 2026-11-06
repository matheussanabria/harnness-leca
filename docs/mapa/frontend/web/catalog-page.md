---
domain: frontend
module: web
feature: catalog-page
summary: Standalone /catalogo page: skills and agents in separate tabs, grouped by area, with a file browser per item.
paths: [ui/public/catalogo.html, ui/public/css/catalogo.css, ui/public/js/catalogo/*.js, ui/server/services/catalog/*.js, ui/server/controllers/catalog.controller.js, ui/server/routes/catalog.routes.js, tests/catalog.test.js, tests/catalog-files.test.js, tests/catalog-remote.test.js, tests/catalog-sources.test.js, tests/catalog-areas-config.test.js]
keywords: [catalog, areas-config, frontmatter-area, catalogo, skills, agents, area, documentation, frontend, group, override, browser, tree, files]
updated: 2026-11-06
---
# Skills and agents catalog (/catalogo)

Reads a registry of sources (`catalog-sources.js`): user `~/.claude` (skills and agents), the harness `.agents/skills`, then every repo target of every project (`.agents/skills`, `skills/`, `.claude/agents`). A name present in several sources shows once: the first source in that order wins and the others are listed in `alsoIn` (a `+N` tag on the card). Area precedence: `area:` in the item frontmatter (the page locks the selector), then the manual choice saved in `global/catalog-areas.json` (key `skill:<name>` or `agent:<name>`), then a keyword suggestion from name and description; an id not in the config is ignored. The area list and keywords are data: `catalog-areas.data.json` (default) or your own `global/catalog-areas-config.json`, used when valid. Each card shows the origin (frontmatter, manual, sugerida). Skills and agents are separate tabs. Opening an item shows its file tree (a skill is a folder, an agent is one `.md` file) and a viewer (rendered markdown or raw code). Browsing is read-only and works from the phone: remote requests already pass the router PIN gate, so the read endpoints add no extra check. Changing an area is limited to loopback; paths are validated (no `..`, dot entries, `node_modules` or symlinks leaving the item). Nav entry in `app-header.js`, route in `static.controller.js`.

| File | Responsibility |
|---|---|
| `ui/server/services/catalog/catalog-areas.js` | Loads and validates the area config (custom file, else bundled default) and the pure `classify` suggester. |
| `ui/server/services/catalog/catalog-areas.data.json` | Bundled default areas: id, label, FontAwesome icon, keywords, and the `other` fallback. |
| `ui/server/services/catalog/catalog-sources.js` | Source registry: user, harness and project repo targets, url-safe ids, precedence order, no repeated folders. |
| `ui/server/services/catalog/catalog-reader.js` | Reads skills and agents from the registry, dedupes by name (`alsoIn`), applies overrides, returns items and per-area counts. |
| `ui/server/services/catalog/catalog-overrides.js` | Reads and atomically writes the manual area choices. |
| `ui/server/services/catalog/catalog-files.js` | Read-only file tree and text file reader for one item, with path, symlink and size guards. |
| `ui/server/controllers/catalog.controller.js` | `GET /api/catalog`, `POST /api/catalog/area`, `GET /api/catalog/tree` and `GET /api/catalog/file` (area change is loopback only). |
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
| `tests/catalog-remote.test.js` | Remote requests can browse (404, not 403), cannot change an area, traversal still refused. |
| `tests/catalog-sources.test.js` | Registry order, project sources, precedence and `alsoIn`, browsing a project item, no repeated folders. |
| `tests/catalog-areas-config.test.js` | Config load and validation, frontmatter/manual/suggested precedence, unknown areas ignored, origin tag in the view. |
