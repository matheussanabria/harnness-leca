---
domain: frontend
module: web
feature: catalog-page
summary: Standalone /catalogo page: skills and agents in separate tabs, grouped by area, with a file browser per item.
paths: [ui/public/catalogo.html, ui/public/css/catalogo.css, ui/public/js/catalogo/*.js, ui/server/services/catalog/*.js, ui/server/controllers/catalog.controller.js, ui/server/routes/catalog.routes.js, tests/catalog.test.js, tests/catalog-files.test.js, tests/catalog-remote.test.js, tests/catalog-sources.test.js, tests/catalog-areas-config.test.js, tests/catalog-cache.test.js, tests/catalog-write.test.js, tests/catalog-bindings.test.js, ui/public/js/catalogo/catalogo-editor.js]
keywords: [catalog, cache, mtime, areas-config, frontmatter-area, catalogo, skills, agents, area, documentation, frontend, group, override, browser, tree, files]
updated: 2026-11-06
---
# Skills and agents catalog (/catalogo)

Reads a registry of sources (`catalog-sources.js`): user `~/.claude` (skills and agents), the harness `.agents/skills`, then every repo target of every project (`.agents/skills`, `skills/`, `.claude/agents`). A name present in several sources shows once: the first source in that order wins and the others are listed in `alsoIn` (a `+N` tag on the card). Area precedence: `area:` in the item frontmatter (the page locks the selector), then the manual choice saved in `global/catalog-areas.json` (key `skill:<name>` or `agent:<name>`), then a keyword suggestion from name and description; an id not in the config is ignored. The area list and keywords are data: `catalog-areas.data.json` (default) or your own `global/catalog-areas-config.json`, used when valid. Each card shows the origin (frontmatter, manual, sugerida). Speed: parsed frontmatter is cached per file while its mtime and size are unchanged (folder listings are read every call, so new and removed skills show at once), and the source registry is kept 15 s, so a new project repo can take that long to appear. Skills and agents are separate tabs. Opening an item shows its file tree (a skill is a folder, an agent is one `.md` file) and a viewer (rendered markdown or raw code). Browsing is read-only and works from the phone: remote requests already pass the router PIN gate, so the read endpoints add no extra check. Changing an area is limited to loopback; paths are validated (no `..`, dot entries, `node_modules` or symlinks leaving the item). Editing (loopback only, never remote): the Editar button replaces the viewer with a textarea; saving POSTs `/api/catalog/file/save` with the content hash read earlier (`revision`), the server answers 409 with `currentRevision` when the file changed meanwhile (the user may then overwrite explicitly), writes atomically (temp file and rename), keeps a UTF-8 BOM, edits only existing text files up to 256 KB (no create, no binary, no truncated files). Scrum links: `GET /api/catalog` adds to every skill `lanes` (project and lane name, read from each `projects/<slug>/skill-bindings.json` through `readBindingState`, matched by skill name) and `orphan` (true only for a project-repo skill with no lane; user and harness skills never are). Cards show a lane-count or "sem vínculo" tag and the detail view lists the lanes; links are read-only here, edited where the bindings already live. Nav entry in `app-header.js`, route in `static.controller.js`.

| File | Responsibility |
|---|---|
| `ui/server/services/catalog/catalog-areas.js` | Loads and validates the area config (custom file, else bundled default) and the pure `classify` suggester. |
| `ui/server/services/catalog/catalog-areas.data.json` | Bundled default areas: id, label, FontAwesome icon, keywords, and the `other` fallback. |
| `ui/server/services/catalog/catalog-sources.js` | Source registry: user, harness and project repo targets, url-safe ids, precedence order, no repeated folders. |
| `ui/server/services/catalog/catalog-cache.js` | In-memory caches: per-file frontmatter by mtime and size (pruned each build) and the source registry with a 15 s TTL. |
| `ui/server/services/catalog/catalog-reader.js` | Reads skills and agents from the registry, dedupes by name (`alsoIn`), applies overrides, returns items and per-area counts. |
| `ui/server/services/catalog/catalog-overrides.js` | Reads and atomically writes the manual area choices. |
| `ui/server/services/catalog/catalog-files.js` | Read-only file tree and text file reader for one item, with path, symlink and size guards. |
| `ui/server/services/catalog/catalog-bindings.js` | Index of skill name to Scrum lanes from the project binding manifests; marks orphan project skills. |
| `ui/server/services/catalog/catalog-write.js` | Saves one existing text file: revision check (409), atomic write, BOM kept, same path guards as the reader. |
| `ui/server/controllers/catalog.controller.js` | `GET /api/catalog`, `POST /api/catalog/area`, `GET /api/catalog/tree`, `GET /api/catalog/file` and `POST /api/catalog/file/save` (area change and save are loopback only). |
| `ui/server/routes/catalog.routes.js` | Registers the five catalog routes. |
| `ui/public/catalogo.html` | Page shell: Skills/Agentes tabs, search, area chips, list and the file browser panel. |
| `ui/public/css/catalogo.css` | Page styles (reuses `consumo.css` tokens). |
| `ui/public/js/catalogo/catalogo-model.js` | Pure filter, group-by-area and per-area counts. |
| `ui/public/js/catalogo/catalogo-view.js` | Escaped HTML for chips, groups and cards. |
| `ui/public/js/catalogo/catalogo-tree.js` | Pure helpers: tree HTML, default file (SKILL.md) and frontmatter split. |
| `ui/public/js/catalogo/catalogo-browser.js` | File browser controller: loads the tree, shows files, rendered/raw toggle. |
| `ui/public/js/catalogo/catalogo-editor.js` | Inline editor: textarea, confirm before save, 409 handling with explicit overwrite. |
| `ui/public/js/catalogo/catalogo-page.js` | Controller: load, tabs, filters, open item, area change saved through the API. |
| `tests/catalog.test.js` | Classifier, reader, overrides, filter model and escaping tests. |
| `tests/catalog-files.test.js` | File tree and reader (traversal, binary, symlink) and tree view tests. |
| `tests/catalog-bindings.test.js` | Index across projects, ignored folders, corrupt manifest, orphan rules and the card tag. |
| `tests/catalog-write.test.js` | Save with revision, 409 conflict, agent edit, BOM, traversal, no create or binary, body validation. |
| `tests/catalog-remote.test.js` | Remote requests can browse (404, not 403), cannot change an area or edit a file, traversal still refused. |
| `tests/catalog-sources.test.js` | Registry order, project sources, precedence and `alsoIn`, browsing a project item, no repeated folders. |
| `tests/catalog-areas-config.test.js` | Config load and validation, frontmatter/manual/suggested precedence, unknown areas ignored, origin tag in the view. |
| `tests/catalog-cache.test.js` | Cache hit without reads, invalidation on edit, create and remove, pruning, unreadable files, TTL of the registry. |
