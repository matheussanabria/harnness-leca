---
domain: backend
module: artifacts
feature: artifacts-routes
summary: Artifact controllers, services and routes, plus the Angular component inspector controller and service.
paths: [ui/server/controllers/artifact*.controller.js, ui/server/services/artifact-*.service.js, ui/server/routes/artifact.routes.js, ui/server/controllers/inspect.controller.js, ui/server/services/component-resolver.service.js]
keywords: [artifacts, inventory, import, access, preview, relationships, inspector, angular]
updated: 2026-10-30
---
# Artifacts and Inspector

| File | Responsibility |
|---|---|
| `ui/server/controllers/artifact.controller.js` | Exposes `GET /api/project/:slug/artifacts`, hides `local` artifacts off loopback and reports `canManageAccess`. |
| `ui/server/controllers/artifact-import.controller.js` | Exposes `POST /api/project/:slug/artifacts/import` validating slug, project, name and file/folder origin. |
| `ui/server/controllers/artifact-access.controller.js` | Exposes `POST /api/project/:slug/artifacts/access`, loopback only, toggling `project` and `local`. |
| `ui/server/controllers/artifact-preview.controller.js` | Exposes `GET /api/project/:slug/artifacts/preview` as JSON and `raw=1` with sandbox CSP. |
| `ui/server/controllers/artifact-relationships.controller.js` | Exposes `GET`/`POST .../artifacts/relationships`; only loopback edits links and remote reads filter `local`. |
| `ui/server/routes/artifact.routes.js` | Groups inventory, import, access, preview and links routes to keep `router.js` under the cap. |
| `ui/server/services/artifact-inventory-scan.service.js` and `artifact-inventory.service.js` | Scans design, Atelier, chats, extractions, docs, answers and imports; merges metadata, filters local access, blocks symlinks. |
| `ui/server/services/artifact-import.service.js` | Validates extension, size, folder and symlink; writes to `artifacts/`, records metadata and returns a relative path. |
| `ui/server/services/artifact-metadata.service.js` | Maintains `artifacts/.metadata.json` (origin, source, date, size, MIME, SHA-256, access) atomically without following symlinks. |
| `ui/server/services/artifact-preview.service.js` | Resolves path by type, applies access and limits, returns text or bytes for HTML, image and PDF. |
| `ui/server/services/artifact-relationships.service.js` | Maintains `artifacts/.relationships.json` with stable screen/field keys, validates targets, reports orphans, writes atomically. |
| `ui/server/controllers/inspect.controller.js` | Angular inspector: resolves component classes (`/api/project/:slug/inspect/resolve`) and safely reads code (`.../inspect/file`). |
| `ui/server/services/component-resolver.service.js` | Scans `.ts` files, parses `@Component` decorators, extracts template/styles and strictly confines paths. |
