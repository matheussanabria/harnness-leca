---
domain: backend
module: artifacts
feature: artifact-registry
summary: Artifact registry with stable ids, owner, files and ownership history, plus the Canvas hook and the importer (EP-25.03).
paths: [ui/server/db/migrations/025-artifacts.js, ui/server/db/repos/artifact.repo.js, ui/server/services/artifacts/artifact-id.js, ui/server/services/artifacts/artifact-canvas.js, ui/server/services/artifacts/artifact-registry.service.js, tools/migrate/artifact-registry-import.js, tests/artifact-repo.test.js, tests/artifact-registry-import.test.js]
keywords: [artifact, registry, registro, owner, dono, sqlite, canvas, importer, ulid, ownership]
updated: 2026-11-23
---
# Artifact registry

| File | Responsibility |
|---|---|
| `ui/server/db/migrations/025-artifacts.js` | Tables `artifacts` (id, type, owner, title, derived_from, source_key), `artifact_files` (path, hash) and `artifact_ownership_log` (create, move, copy). |
| `ui/server/db/repos/artifact.repo.js` | Repository: `register` (idempotent by source key), `get`, `listByOwner`, `filesOf`, `history`, `findReferences`. |
| `ui/server/services/artifacts/artifact-id.js` | `art_` + ULID ids and the format check. |
| `ui/server/services/artifacts/artifact-canvas.js` | Pure mapping from a Canvas board file to a registration (type `canvas.<kind>`, source key, file hash). |
| `ui/server/services/artifacts/artifact-registry.service.js` | Opens the repository lazily and fails open; `registerCanvasBoard` is called by `createBoard`; off with `HARNESS_ARTIFACT_REGISTRY=off`, and when `HARNESS_PROJECTS_DIR` is redirected without `HARNESS_DB_PATH`. |
| `tools/migrate/artifact-registry-import.js` | One-time idempotent importer of existing Canvas boards (all owners, `--dry-run`); moves nothing. |
| `tests/artifact-repo.test.js` | Ids, register, idempotency, filters, copy references, rollback on failure. |
| `tests/artifact-registry-import.test.js` | Importer by kind, second run changes nothing, the registry guard and the Canvas hook (including a failing registry). |

- Moving and copying between owners is story 25.04; the other feature types register in 25.06 and 25.07.
