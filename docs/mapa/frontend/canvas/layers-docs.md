---
domain: frontend
module: canvas
feature: layers-docs
summary: Read-only reader of the project's doc/ for the Layers map: confined endpoints, reference index and panel sections.
paths: [ui/server/services/project-docs/**, ui/server/controllers/project-docs.controller.js, ui/server/routes/project-docs.routes.js, tests/project-docs-confine.test.js, tests/project-docs-refs.test.js, tests/project-docs-route.test.js, ui/public/js/modules/design-layers/docs/**, ui/public/js/modules/design-layers/layers-docs-refs.js, ui/public/js/vendor/marked-16.4.2/**, ui/public/css/design/40-layers-docs.css, tests/layers-docs-reader.test.js, ui/server/services/screen-links.js, ui/public/js/modules/design-layers/layers-screen-links.js, tests/screen-links.test.js]
keywords: [documentacao, doc, leitor, reader, referencias, RN, DIS, rastreio, criterio, confinamento, wikilinks, mapa em camadas, dossie]
updated: 2026-11-16
---
# Layers map: documentation reader

Phase 1 of "Referências e navegação na documentação". The Harness only reads `doc/` of the project repo (resolved by `getProjectRepoInfo`); it never edits a `.md`.
Routes: `GET /api/project/:slug/docs/tree | catalog | refs` and `GET .../docs/file?path=<relative to doc>`.
Confinement: relative path without `.`/`..`/`%`/dot folders, only `.md .yml .yaml .json`, real path (after links and junctions) inside the real `doc/`, at most 1 MB.
Hidden: the "contains a secret" block of the repo `.gitignore`, every Postman file (saved responses can carry real data) and `scrum/_jira-dis.json`.
Reference index (cached by size and date of the files read): `rn` (table rows of `regras.md`, anchor `rn-<id>`), `stories` (`scrum/<ID>/user-story.md`, criteria anchor `criterio-<n>`, drafts and `aliasOf` from the Apelidos table of `_historias.md`), `trace` (two-space keys of `rastreio.yml`, a list because ids repeat), `features` (dossier documents by role, stories of `historias:`), `storyFeatures`, `aliases`; `refs` adds `fieldStories` per final screen id and `missing` (cited, not found).
Every parser splits on `/\r?\n/` (see f171fba).

| File | Responsibility |
|---|---|
| `ui/server/services/project-docs/confine.js` | Path normalization and `createDocAccess(repoRoot)`: `resolve`/`read` with 400, 403, 404 and 413 answers. |
| `ui/server/services/project-docs/secret-rules.js` | Fixed deny list plus the secret block of the repo `.gitignore`, rewritten relative to `doc/`. |
| `ui/server/services/project-docs/tree.js` | Filtered tree and flat file list of `doc/`; skips links, junctions, dot folders and oversized files. |
| `ui/server/services/project-docs/refs-parsers.js` | CRLF-safe parsers: RN rows, story title and criteria, trace ids, aliases, frontmatter scalar; anchor conventions. |
| `ui/server/services/project-docs/refs-index.js` | Builds and caches the reference index; `screenRefs` adds field stories per screen and unresolved references. |
| `ui/server/services/project-docs/catalog.js` | Panel sections: review index, checklist, open issues, features, stories, drafts. |
| `ui/server/controllers/project-docs.controller.js` | The four read-only handlers. |
| `ui/server/routes/project-docs.routes.js` | Route table of the reader. |
| `tests/project-docs-confine.test.js` | Traversal, encoded dots, types, secrets, junction to outside, size, tree filtering. |
| `tests/project-docs-refs.test.js` | One test per reference kind, CRLF `_status.md` and `regras.md`, cache, catalog, real repo (skipped when absent). |
| `tests/project-docs-route.test.js` | HTTP answers of the four routes. |
| `ui/public/js/modules/design-layers/layers-docs-refs.js` | "Documentação oficial" strip (feature, stories, features of the cited rules, unresolved count) and RN/story chips; one capture listener opens them. |
| `ui/public/js/modules/design-layers/docs/docs-panel.js` | Side drawer on `document.body`: back stack, link clicks, filter, refresh, `refTarget` (reference to document and anchor). |
| `ui/public/js/modules/design-layers/docs/docs-panel-views.js` | Pure HTML of the panel: sections and tree, feature dossier, choice between places, not found. |
| `ui/public/js/modules/design-layers/docs/docs-render.js` | Markdown (marked) and YAML/JSON to safe HTML: raw HTML as text, no unsafe links or images, Mermaid as code, anchors. |
| `ui/public/js/modules/design-layers/docs/docs-paths.js` | Relative links, wikilink resolution, heading slugs and the anchor conventions shared with the server. |
| `ui/public/js/modules/design-layers/docs/docs-source.js` | Data source: the HTTP API in the Harness, `embeddedDocsSource` in the static package (with `paths` and `isIncluded`); `loadDocsRefs`. |
| `ui/public/js/modules/design-layers/docs/docs-location.js` | Direct links: `?doc=&docAnchor=` in the Harness (the router owns the hash), `#doc/<path>#<anchor>` in the package. |
| `ui/public/js/vendor/marked-16.4.2/marked.esm.js` | marked 16.4.2 (MIT), byte-identical to the npm build; `LICENSE.md` alongside. |
| `ui/public/css/design/40-layers-docs.css` | Strip, chips and drawer styles (mobile stacks the index above the reader). |
| `tests/layers-docs-reader.test.js` | Safe rendering, anchors equal to the server's, paths, link format, `refTarget`, strip and chips. |
| `ui/server/services/screen-links.js` | Phase 2: `linkScreens` after `mergeScreens`; resolves `navega.para` by id or `featureScreenId` and adds the reverse side (vaiPara/vemDe, chama/chamadaPor). |
| `ui/public/js/modules/design-layers/layers-screen-links.js` | "Telas ligadas" strip; a click opens the linked screen (and focuses the source field on "Vem de"). |
| `tests/screen-links.test.js` | Adapter of `navega` (missing `tipo` = navegacao), both directions across the canvas merge, self links, the strip. |

Touched, not owned: `feature-screen-adapter.js` (rules keep `rn`; screens keep `featureScreenId`, which survives `mergeScreens`), `story-features.service.js` (exports `parseTitle`), `routes/index.js` (one line), `design.js` (loads the index in the background), `design-layers.js` (re-exports), `design-layers-store.js` (`docsRefs`), `design-layers-workspace.js` (strip, `refreshLayersWorkspace`, opens `?doc=` once), `layers-detail-ui-rules.js` (chips), `design.css` (import).
