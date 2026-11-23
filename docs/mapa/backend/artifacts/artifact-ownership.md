---
domain: backend
module: artifacts
feature: artifact-ownership
summary: Preview, move, undo and copy of registered artifacts between owners, with rollback and the HTTP routes (EP-25.04).
paths: [ui/server/db/migrations/026-artifact-ownership-detail.js, ui/server/services/artifacts/artifact-errors.js, ui/server/services/artifacts/artifact-fs-ops.js, ui/server/services/artifacts/artifact-adapter-canvas.js, ui/server/services/artifacts/artifact-ownership-plan.js, ui/server/services/artifacts/artifact-reassign.service.js, ui/server/controllers/artifact-ownership.controller.js, ui/server/routes/artifact-ownership.routes.js, tests/helpers/artifact-ownership-fixture.js, tests/artifact-reassign.test.js, tests/artifact-reassign-atomic.test.js, tests/artifact-copy.test.js, tests/artifact-ownership-routes.test.js]
keywords: [artifact, ownership, reassign, move, copy, undo, preview, mover, copiar, dono, rollback, canvas]
updated: 2026-11-23
---
# Artifact ownership: move, copy, undo

| File | Responsibility |
|---|---|
| `ui/server/db/migrations/026-artifact-ownership-detail.js` | Adds `snapshot` (files and hashes at move time) and `undo_of` to the ownership log. |
| `ui/server/services/artifacts/artifact-errors.js` | `ArtifactError` with a code and the HTTP status for each case. |
| `ui/server/services/artifacts/artifact-fs-ops.js` | Applies move, copy and write operations, never overwrites, and reverts everything if one fails. |
| `ui/server/services/artifacts/artifact-adapter-canvas.js` | What a Canvas board is on disk: plan for move or copy (new board id on copy), boards that mention it, index rebuild. |
| `ui/server/services/artifacts/artifact-ownership-plan.js` | Validates artifact, destination and type, asks the adapter for a plan, lists collisions and links; builds the preview. |
| `ui/server/services/artifacts/artifact-reassign.service.js` | `previewOwnership`, `reassign` (needs `confirmado: true`, files move inside the DB transaction), `undoReassign` and `copyArtifact`. |
| `ui/server/controllers/artifact-ownership.controller.js` | The four POST handlers; maps `ArtifactError` to its status, 503 when the registry is off. |
| `ui/server/routes/artifact-ownership.routes.js` | `POST /api/artifacts/:id/{preview,reassign,copy,undo}` (id must be a valid `art_` id). |
| `tests/helpers/artifact-ownership-fixture.js` | Temp projects, in-memory registry and a helper that creates registered boards. |
| `tests/artifact-reassign.test.js` | Confirmation, preview, move with assets, collisions, refusals, personal workspace, undo rules. |
| `tests/artifact-reassign-atomic.test.js` | Simulated disk and database failures leave everything at the origin. |
| `tests/artifact-copy.test.js` | New ids, untouched original, assets copied, no double registration by the importer. |
| `tests/artifact-ownership-routes.test.js` | The flow over the real route table and the status mapping. |

- Only `canvas.*` artifacts have an adapter. Other types answer `UNSUPPORTED_TYPE` until their story adds one (25.06, 25.07).
