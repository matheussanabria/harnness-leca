---
domain: frontend
module: design
feature: atelier-traceability
summary: Element map and traceability of a selected Atelier node, modular traceability service, route and undo-component route.
paths: [ui/public/js/modules/prototype-element-map.js, ui/server/services/prototype-traceability-modular.service.js, ui/server/controllers/prototype-component.controller.js, ui/server/controllers/prototype-traceability.controller.js, tests/prototype-traceability-modular.test.js]
keywords: [traceability, element map, data-pid, component, unextract, contexto-elemento]
updated: 2026-10-30
---
# Atelier Element Traceability

| File | Responsibility |
|---|---|
| `ui/public/js/modules/prototype-element-map.js` | Queries traceability of the selected node, renders `#atelierElementMap`, injects `<contexto-elemento arquivo=...>` into chat (EP-06.05). |
| `ui/server/services/prototype-traceability-modular.service.js` | Resolves file, `px-<pid>` class, CSS rule and HTML/Angular/React code by `data-pid` for prototypes with HTML screen files. |
| `ui/server/controllers/prototype-component.controller.js` | `POST .../design/prototypes/:protoId/unextract-component` removes the component from proto.json via `removeComponentCandidate`. |
| `ui/server/controllers/prototype-traceability.controller.js` | `GET .../design/prototypes/:protoId/traceability?screenId=&nodeId=` with validation and clear errors (EP-06.05). |
| `tests/prototype-traceability-modular.test.js` | Covers modular prototype, missing screen and missing pid. |

- The modular service also recognizes extracted components (proto.json) and DS components (class `ds-x` becomes `dis.x` in the registry), and reads real React/Angular code.
- It is used by `prototype-traceability.service.js` when `screens` is an array.
