---
domain: backend
module: prototype
feature: design-registry
summary: Design System registry, sandbox preview and extractor services plus the registry controller.
paths: [ui/server/services/design-*.service.js, ui/server/controllers/design-registry.controller.js]
keywords: [design, registry, preview, extractor, components, sandbox]
updated: 2026-10-30
---
# Design System Registry

| File | Responsibility |
|---|---|
| `ui/server/services/design-registry.service.js` | Canonical component catalog (`DesignSystemComponent`), manifest validation, multi-framework support and persistence. |
| `ui/server/services/design-preview.service.js` | Isolated sandbox rendering of components with clean token injection and demo props. |
| `ui/server/services/design-extractor.service.js` | Semantic decomposition of legacy components, CSS extraction and modular packaging of the `AnnotationList` pilot. |
| `ui/server/controllers/design-registry.controller.js` | REST endpoints (`/api/project/:slug/design/registry`) for listing, filters, sandbox `/preview` and extraction. |
