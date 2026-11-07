---
domain: backend
module: canvas
feature: canvas-store
summary: Per-project Canvas boards and assets: validation, atomic files, rev conflicts, migrations, index cache, REST routes.
paths: [ui/server/services/canvas/*.js, ui/server/controllers/canvas.controller.js, ui/server/routes/canvas.routes.js, tests/canvas-*.test.js, ui/server/controllers/canvas-assets.controller.js, tests/helpers/canvas-http-fake.js]
keywords: [canvas, board, mindmap, diagram, flow, kinds, ep-21, store, rev, migration, trash, index, adr-011, assets, sha256, upload, magic-bytes]
updated: 2026-11-07
---
# Canvas Store and Assets (stories 19.01 and 19.02, formerly 16.01 and 16.02)

Boards live in `projects/<slug>/canvas/<uuid>.json` with a rebuildable `index.json`; deletes move the file to `.trash/`.
Kinds (EP-21.02, ADR-014): `board`, `mindmap`, `diagram` (`mermaid@1`) and `flow` (`flow@1`). The list endpoint returns every kind; each client filters by its own kind. Kinds with a schema get a shallow shape check (`INVALID_SCHEMA`); a blank `{}` is accepted only on create.
The server treats `data` as opaque JSON (4 MB cap). API: `GET/POST /api/canvas/boards`, `GET/PUT/DELETE /api/canvas/boards/:id`.
Assets (16.02): `POST /api/canvas/boards/:id/assets` and `GET /api/canvas/boards/:id/assets/<sha256>.<ext>`, stored content-addressed in `canvas/<boardId>/assets/`; the type is decided by the bytes.

| File | Responsibility |
|---|---|
| `ui/server/services/canvas/canvas-errors.js` | `CanvasError` (message, code, status, details) and one factory per error code. |
| `ui/server/services/canvas/canvas-validate.js` | Validates project, UUID id, kind (from the registry), title and data (size cap `MAX_BOARD_BYTES`); no path is built from unvalidated input. |
| `ui/server/services/canvas/canvas-kinds.js` | Kind registry (`KINDS`, `KIND_REGISTRY`) and `checkKindData`: shallow shape checks for `diagram` (schema, source up to 64 KB, diagramType) and `flow` (schema, graph arrays, layout object); the server never reads deeper. |
| `ui/server/services/canvas/canvas-fs.js` | Directory and file guards (no symlinks), atomic write (tmp `wx` + rename), JSON read, copy-if-missing and move-to-trash. |
| `ui/server/services/canvas/canvas-migrate.js` | `CURRENT_VERSION` and pure per-version migrators; refuses files from a newer version (`UNSUPPORTED_VERSION`). |
| `ui/server/services/canvas/canvas-index.js` | Reads, updates and rebuilds the `index.json` cache from the board files. |
| `ui/server/services/canvas/canvas-store.js` | Public service API: `listBoards`, `createBoard`, `readBoard`, `updateBoard` (rev check), `deleteBoard`; writes `.v<N>.bak.json` before the first migration rewrite. |
| `ui/server/controllers/canvas.controller.js` | HTTP handlers; maps `CanvasError` to status and `{ error, code }`, invalid JSON to 400 and oversize bodies to 413. |
| `ui/server/routes/canvas.routes.js` | Route table for the five endpoints, spread into `ROUTES` by `ui/server/router.js`. |
| `tests/canvas-kinds.test.js` | Contract of the four kinds: CRUD with rev, blank create, wrong schema refused on create and update, limits, and the HTTP status of `INVALID_SCHEMA`. |
| `tests/canvas-store.test.js`, `tests/canvas-migrate.test.js`, `tests/canvas-migration-persist.test.js`, `tests/canvas-http.test.js` | Service contract, migration chain (injectable target version), backup-on-first-migration, and HTTP endpoint tests. |
| `ui/server/services/canvas/canvas-asset-types.js` | Magic-byte type detection (png, jpg, gif, webp, pdf; txt, md, csv, json by name plus UTF-8 check), ext/mime/inline tables, size limits, `ASSET_FILE_RE`. |
| `ui/server/services/canvas/canvas-assets.js` | `saveAsset` (sha256 name, dedupe, 200 MB board quota, atomic write) and `readAsset` (validated file name, symlink-guarded folders). |
| `ui/server/services/canvas/canvas-body.js` | `readBinaryBody`: checks Content-Length first, then stops reading as soon as the limit is crossed. |
| `ui/server/controllers/canvas-assets.controller.js` | Upload (checks the board before reading the body) and download with fixed Content-Type, nosniff, sandbox CSP and inline/attachment disposition. |
| `tests/helpers/canvas-http-fake.js` | Fake request/response, paced upload stream and byte fixtures for the asset HTTP tests. |
| `tests/canvas-assets-types.test.js`, `tests/canvas-assets.test.js`, `tests/canvas-assets-http.test.js` | Type detection, assets service (dedupe, quota, symlinks, trash) and HTTP contract. |
