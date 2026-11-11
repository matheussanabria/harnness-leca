---
domain: frontend
module: canvas
feature: story-field-links
summary: Stories link to map screens and fields in the drawer; mapped screens show the real prototype in the Layers map.
paths: [ui/server/services/prototype-section-extract.js, tests/proto-section-viewport.test.js, docs/features/proto-section-viewport/02-bdd.feature, ui/server/services/story-field-links.service.js, ui/server/services/project-screens-prototypes.js, ui/server/services/story-features.service.js, ui/public/js/modules/design-scrum-story-features.js, ui/public/js/modules/design-layers/layers-screen-replica-proto.js, ui/public/css/design/38-layers-proto-frame.css, tests/story-field-links.test.js, docs/features/story-field-links/02-bdd.feature]
keywords: [historia, campo, tela, ver no mapa, prototipo, iframe, replica, _historias-funcionalidades.json, _prototipos.json, DIS]
updated: 2026-11-11
---
# Story to field links and real prototype in the Layers map

Data lives in the project repo under `doc/sistema/features/`:
- `_historias-funcionalidades.json`: rows `{k, grupo, rotulo, tela, campo, principal, relacionadas[], conferido}`, extracted from the FEATS table of the original board (`tools/quadro-historias/mapa-camadas-dis.v20.html`). `tela` is a map screen id (`s1..s4` of the canvas or `<feature>-<screen>`), `campo` a field id of that screen.
- `_prototipos.json`: `{prototipo, telas: {<map screen id>: <prototype screen>}}`.

`readStoryFeatures` now returns, per story, `campos.dona` and `campos.relacionada` (screen title and field label resolved from the map; no screen means "sem mapa ainda") next to the per-feature lists. The drawer lists fields first and keeps the per-feature docs in a collapsed block. "Ver no mapa" fires `harness:open-layer-target` with the screen and field, so the Layers map opens with the field in focus.
`attachPrototypes` adds `prototype: {id, screen}` to mapped screens; `renderScreenReplica` then draws an iframe of `.../design/prototypes/<id>/render/<screen>` (sandboxed, read-only) instead of the generic replica. Screens without a mapping keep the previous replica.
The iframe asks for `?part=content` (only the content area, no header or side menu; every dis-paciente screen has it) and uses the logical width of the Desktop/Tablet/Mobile mode (1024, 768, 390 px, `dls.activeViewport`), scaled down to fit the panel by `fitPrototypeFrames` (never enlarged).

| File | Responsibility |
|---|---|
| `ui/server/services/story-field-links.service.js` | Reads the rows and resolves screen and field against the map. |
| `ui/server/services/project-screens-prototypes.js` | Applies `_prototipos.json` to the screen list (validates ids). |
| `ui/server/services/story-features.service.js` | Adds `campos` to each story. |
| `ui/public/js/modules/design-scrum-story-features.js` | Drawer section: fields, collapsed feature docs, Ver no mapa with field. |
| `ui/public/js/modules/design-layers/layers-screen-replica-proto.js` | Prototype iframe for mapped screens. |
| `ui/public/css/design/38-layers-proto-frame.css` | Iframe frame styles. |
| `ui/server/services/prototype-section-extract.js` | Cuts only `main.dis-shell__content` from a prototype screen (`?part=content`). |
| `tests/proto-section-viewport.test.js` | Section cut, server option, mode width. |
| `docs/features/proto-section-viewport/02-bdd.feature` | BDD for the section and the mode width. |
| `tests/story-field-links.test.js` | CP-01 to CP-08. |
| `docs/features/story-field-links/02-bdd.feature` | BDD (CP-09 is manual). |

Touched, not owned: `project-screens-fallback.js` (attach call), `layers-screen-replica.js` (prototype branch), `36-story-features.css`, `design.css`.
