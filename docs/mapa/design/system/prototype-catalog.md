---
domain: design
module: system
feature: prototype-catalog
summary: Local per-project prototype catalog: design.json source, modular Atelier prototypes and implementation notes.
paths: [ui/server/services/design-registry.service.js, ui/public/js/modules/prototype-catalog.js]
keywords: [catalog, design.json, prototypes, proto.json, atelier, registry]
updated: 2026-10-30
---
# Local prototype catalog

| File | Responsibility |
|---|---|
| `projects/<slug>/design/design.json` | Explicit source of the HTML artifacts shown on the prototypes screen of that project. |
| `projects/<slug>/design/prototypes/<id>/` | Modular editable Atelier prototypes (`proto.json`, `screens/`, `styles/`, `data/`). |
| `projects/<slug>/design/05-dev-notas.md` | Log of implementation, structural decisions and validations of the catalog evolution. |

- The registry service and the catalog module above read this data; the files under `projects/<slug>/design/` are per-project and not tracked in this repository.
