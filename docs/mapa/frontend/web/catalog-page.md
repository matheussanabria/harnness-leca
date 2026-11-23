---
domain: frontend
module: web
feature: catalog-page
summary: Standalone /catalogo page: skills, agents and workflows tabs, grouped by area, with browser and cross-references.
paths: [ui/public/catalogo.html, ui/public/css/catalogo.css, ui/public/js/catalogo/*.js, ui/server/services/catalog/*.js, ui/server/controllers/catalog.controller.js, ui/server/routes/catalog.routes.js, tests/catalog*.test.js, ui/public/js/catalogo/catalogo-editor.js]
keywords: [catalog, cache, mtime, areas-config, frontmatter-area, catalogo, skills, agents, workflows, area, documentation, frontend, group, override, browser, tree, files]
updated: 2026-11-09
---
# Skills, agents and workflows catalog (/catalogo)

Reads a registry of sources (`catalog-sources.js`): user `~/.claude` (skills, agents, workflows), harness `.agents/skills` and `.agents/workflows`, and project targets (`.agents/skills`, `skills/`, `.claude/agents`, `workflows/`). Built-in canonical workflows (`feature-delivery`, `hotfix`) provide fallback when not on disk. Dedupes by name (`alsoIn`). Area precedence: `area:` frontmatter, then manual choice (`global/catalog-areas.json`), then keyword suggestion. Area config from `catalog-areas.data.json` or custom `global/catalog-areas-config.json`. Cache: parsed frontmatter cached while mtime/size unchanged; folder listings re-read every call; sources kept 15 s. Skills, agents and workflows are separate tabs. Item view shows file tree (skill/workflow is folder, agent is `.md`) and viewer (markdown or raw). Workflows render interactive stage overview with direct links to agents and skills. Canonical URL routing (`/catalogo/:kind/:id`) with History API popstate back navigation and legacy query fallback. Remote browsing passes PIN gate; area changes and file edits are loopback only. Editing: saves via POST `/api/catalog/file/save` with revision hash (409 on conflict), atomic write, BOM kept, text files up to 256 KB. Scrum links: adds `lanes` and `orphan` to project skills. Agent manifests: an agent is one `.md`, but repos keep `<repo>/.agents/<agent>/manifest.yaml` (and `AGENT.md`); `catalog-sources.js` collects every target `.agents` dir as `manifestRoots`, and when one has the agent name the tree adds a virtual `manifest/` folder (read-only guards kept; the manifest opens first). Nav entry in `app-header.js`, route in `static.controller.js`.

| File | Responsibility |
|---|---|
| `ui/server/services/catalog/catalog-areas.js` | Loads and validates the area config (custom file, else bundled default) and the pure `classify` suggester. |
| `ui/server/services/catalog/catalog-areas.data.json` | Bundled default areas: id, label, FontAwesome icon, keywords, and the `other` fallback. |
| `ui/server/services/catalog/catalog-sources.js` | Source registry: user, harness and project repo targets for skills, agents and workflows, url-safe ids, precedence order, no repeated folders. |
| `ui/server/services/catalog/catalog-workflows.js` | Reads workflow definitions, discovers workflows from sources, enriches stages with agents and skills, and provides canonical built-ins. |
| `ui/server/services/catalog/catalog-cache.js` | In-memory caches: per-file frontmatter by mtime and size (pruned each build) and the source registry with a 15 s TTL. |
| `ui/server/services/catalog/catalog-reader.js` | Reads skills, agents and workflows from the registry, dedupes by name (`alsoIn`), applies overrides, returns items and per-area counts. |
| `ui/server/services/catalog/catalog-overrides.js` | Reads and atomically writes the manual area choices. |
| `ui/server/services/catalog/catalog-files.js` | Read-only file tree and text file reader for one item, with path, symlink and size guards, supporting virtual workflow documentation. |
| `ui/server/services/catalog/catalog-bindings.js` | Index of skill name to Scrum lanes from the project binding manifests; marks orphan project skills. |
| `ui/server/services/catalog/catalog-write.js` | Saves one existing text file: revision check (409), atomic write, BOM kept, same path guards as the reader. |
| `ui/server/controllers/catalog.controller.js` | `GET /api/catalog`, `POST /api/catalog/area`, `GET /api/catalog/tree`, `GET /api/catalog/file` and `POST /api/catalog/file/save` (area change and save are loopback only). |
| `ui/server/routes/catalog.routes.js` | Registers the five catalog routes. |
| `ui/public/catalogo.html` | Page shell: Skills/Agentes/Workflows tabs, search, area chips, list and the file browser panel. |
| `ui/public/js/catalogo/catalogo-layers.js` | "Camadas por projeto" section: effective set by layer for a project, origin and overrides, create (form on top), edit the item files and remove on the project layer. |
| `ui/public/css/catalogo.css` | Page styles (reuses `consumo.css` tokens) with workflow stage cards and navigable reference chips. |
| `ui/public/js/catalogo/catalogo-model.js` | Pure filter, group-by-area and per-area counts. |
| `ui/public/js/catalogo/catalogo-view.js` | Escaped HTML for chips, groups and cards including workflow badge and stage counts. |
| `ui/public/js/catalogo/catalogo-tree.js` | Pure helpers: tree HTML, default file (SKILL.md) and frontmatter split. |
| `ui/public/js/catalogo/catalogo-browser.js` | File browser controller: loads tree, shows files, rendered/raw toggle and stage breakdown with clickable agent/skill reference chips. |
| `ui/public/js/catalogo/catalogo-router.js` | Client-side router: parses canonical routes (/catalogo/:kind/:id), builds URLs, pushes history and manages back navigation. |
| `ui/public/js/catalogo/catalogo-manifest.js` | Agent manifest: parses the flat frontmatter and renders it as an open table (tools as chips) above the agent text; cards also show model and tool count. |
| `ui/public/js/catalogo/catalogo-editor.js` | Inline editor: textarea, confirm before save, 409 handling with explicit overwrite. |
| `ui/public/js/catalogo/catalogo-page.js` | Controller: load, tabs, filters, open item, URL search deep-links, cross-reference navigation, area change saved through the API. |
| `tests/catalog-router.test.js` | Unit tests for route parsing, canonical URL builder, kind normalization, and legacy query compatibility. |
| `tests/catalog.test.js` | Classifier, reader, overrides, filter model and escaping tests. |
| `tests/catalog-files.test.js` | File tree and reader (traversal, binary, symlink) and tree view tests. |
| `tests/catalog-workflows.test.js` | Workflow sources discovery, stage enrichment with agents/skills, built-in fallback and browser tests. |
| `tests/catalog-bindings.test.js` | Index across projects, ignored folders, corrupt manifest, orphan rules and the card tag. |
| `tests/catalog-write.test.js` | Save with revision, 409 conflict, agent edit, BOM, traversal, no create or binary, body validation. |
| `tests/catalog-manifest.test.js` | Manifest parsing (folded lines) and rendering (escaping, tool chips). |
| `tests/catalog-remote.test.js` | Remote requests can browse (404, not 403), cannot change an area or edit a file, traversal still refused. |
| `tests/catalog-sources.test.js` | Registry order, project sources, precedence and `alsoIn`, browsing a project item, no repeated folders. |
| `tests/catalog-areas-config.test.js` | Config load and validation, frontmatter/manual/suggested precedence, unknown areas ignored, origin tag in the view. |
| `tests/catalog-cache.test.js` | Cache hit without reads, invalidation on edit, create and remove, pruning, unreadable files, TTL of the registry. |
