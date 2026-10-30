---
domain: frontend
module: design
feature: inspector-artifacts
summary: Angular inspector, Artifacts tab (inventory, import, access, preview, links) and Routines tab of the 360 view.
paths: [ui/public/js/modules/inspector.js, ui/public/js/modules/design-artifacts*.js, ui/public/js/modules/design-routines*.js, ui/public/css/design/22-rotinas-filtros.css]
keywords: [inspector, artifacts, routines, import, preview, approvals, ivy, alt+i]
updated: 2026-10-30
---
# Inspector, Artifacts and Routines

| File | Responsibility |
|---|---|
| `ui/public/js/modules/inspector.js` | Visual inspector in Studio using Ivy (`window.ng`), hover overlay, `Alt+I`, and `<contexto-inspetor>` chat injection. Split into `inspector-*.js`; `inspector-store.js` holds shared state. |
| `ui/public/js/modules/design-artifacts.js` | Artifacts tab of the 360 view: search, type filter, summary, accessible table, origin, access, preview and import buttons. |
| `ui/public/js/modules/design-artifacts-state.js` | Normalizes, reads and writes filter, search, selection and sort of the `artifacts` screen (EP-14.12). |
| `ui/public/js/modules/design-artifacts-import.js` | Uploads files and folders in sequence with origin, progress, per-file errors and inventory reload. |
| `ui/public/js/modules/design-artifacts-access.js` | Toggles an imported artifact between project and local-only, with confirmation and list reload. |
| `ui/public/js/modules/design-artifacts-preview.js` | Opens escaped text, sandboxed HTML iframe, image or PDF link, with close and error messages. |
| `ui/public/js/modules/design-artifacts-relationships.js` | Screen/field links panel: add, remove, orphans, and opening the Map at the linked screen and field. |
| `ui/public/js/modules/design-routines.js` | Routines tab of the 360 view: routine catalog, idempotent run, approval queue with decision, project history (EP-08.05). |
| `ui/public/js/modules/design-routines-state.js` | Normalizes, reads and writes search, approval, tab and selected routine of the `routines` screen (EP-14.12). |
| `ui/public/js/modules/design-routines-api.js` | HTTP client for routines, approvals, decisions and project history. |
| `ui/public/css/design/22-rotinas-filtros.css` | Search bar and filters of the Routines view (EP-14.12); split from `21-rotinas.css` for the 300-line limit. |
