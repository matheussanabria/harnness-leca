---
domain: backend
module: canvas
feature: canvas-store
summary: Per-project Canvas boards and mind maps: validation, atomic files, rev conflicts, migrations, index cache, REST routes.
paths: [ui/server/services/canvas/*.js, ui/server/controllers/canvas.controller.js, ui/server/routes/canvas.routes.js, tests/canvas-*.test.js]
keywords: [canvas, board, mindmap, store, rev, migration, trash, index, adr-011]
updated: 2026-11-01
---
# Canvas Store (story 16.01)

Boards live in `projects/<slug>/canvas/<uuid>.json` with a rebuildable `index.json`; deletes move the file to `.trash/`.
The server treats `data` as opaque JSON (4 MB cap). API: `GET/POST /api/canvas/boards`, `GET/PUT/DELETE /api/canvas/boards/:id`.

| File | Responsibility |
|---|---|
| `ui/server/services/canvas/canvas-errors.js` | `CanvasError` (message, code, status, details) and one factory per error code. |
| `ui/server/services/canvas/canvas-validate.js` | Validates project, UUID id, kind, title and data (size cap `MAX_BOARD_BYTES`); no path is built from unvalidated input. |
| `ui/server/services/canvas/canvas-fs.js` | Directory and file guards (no symlinks), atomic write (tmp `wx` + rename), JSON read, copy-if-missing and move-to-trash. |
| `ui/server/services/canvas/canvas-migrate.js` | `CURRENT_VERSION` and pure per-version migrators; refuses files from a newer version (`UNSUPPORTED_VERSION`). |
| `ui/server/services/canvas/canvas-index.js` | Reads, updates and rebuilds the `index.json` cache from the board files. |
| `ui/server/services/canvas/canvas-store.js` | Public service API: `listBoards`, `createBoard`, `readBoard`, `updateBoard` (rev check), `deleteBoard`; writes `.v<N>.bak.json` before the first migration rewrite. |
| `ui/server/controllers/canvas.controller.js` | HTTP handlers; maps `CanvasError` to status and `{ error, code }`, invalid JSON to 400 and oversize bodies to 413. |
| `ui/server/routes/canvas.routes.js` | Route table for the five endpoints, spread into `ROUTES` by `ui/server/router.js`. |
| `tests/canvas-store.test.js`, `tests/canvas-migrate.test.js`, `tests/canvas-migration-persist.test.js`, `tests/canvas-http.test.js` | Service contract, migration chain (injectable target version), backup-on-first-migration, and HTTP endpoint tests. |
