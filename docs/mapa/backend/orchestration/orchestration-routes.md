---
domain: backend
module: orchestration
feature: orchestration-routes
summary: Capabilities, SDLC stages and agents, workflows, skill bindings, routines, approvals and orchestration routes.
paths: [ui/server/services/orchestration/*.js, ui/server/controllers/orchestration-*.controller.js, ui/server/services/skill-bindings.service.js, ui/server/controllers/skill-bindings.controller.js, ui/server/routes/orchestration.routes.js, ui/server/routes/skill-bindings.routes.js]
keywords: [orchestration, capabilities, stages, agents, workflows, skill-bindings, routines, approvals, history]
updated: 2026-10-30
---
# Orchestration

| File | Responsibility |
|---|---|
| `ui/server/services/orchestration/capability-catalog.js`, `capability-definitions.js` and `capability-legacy.js` | Canonical providers, operations, states, modes and scopes; derives legacy fields, no external cancel advertised (EP-08.01). |
| `ui/server/controllers/orchestration-capabilities.controller.js` | Exposes `GET /api/orchestration/capabilities` and `.../:provider`, 404 for unknown provider. |
| `ui/server/services/orchestration/agent-stage-definitions.js` and `agent-stage-catalog.js` | Ten canonical `feature-delivery` stages, DAI agents as `executor`/`support`, `code-review` as `builtin` (EP-08.02). |
| `ui/server/controllers/orchestration-agent-stages.controller.js` | Exposes `GET /api/orchestration/agent-stages` and `.../:stage`, 404 for unknown stage. |
| `ui/server/routes/orchestration.routes.js` | Groups capabilities, agent stages, workflows and runs routes to keep `router.js` under the cap. |
| `ui/server/services/orchestration/workflow-definitions.js`, `workflow-plan.service.js` and `workflow-runner.service.js` | Declares `feature-delivery` and `hotfix`, resolves the per-project plan and runs the lifecycle with canonical events (EP-08.04). |
| `ui/server/controllers/orchestration-workflows.controller.js` and `orchestration-workflow-runs.controller.js` | Catalog, plan, start, advance, cancel and query of runs; writes restricted to loopback (EP-08.04). |
| `ui/server/services/skill-bindings.service.js` | Versioned `skill-bindings.json` (lane to project skills), validates limits, reports orphans, atomic write in mode `600` (EP-08.03). |
| `ui/server/controllers/skill-bindings.controller.js` | Exposes `GET`/`POST /api/project/:slug/skill-bindings`, writes restricted to loopback. |
| `ui/server/routes/skill-bindings.routes.js` | Groups skill binding routes to keep `router.js` under the cap. |
| `ui/server/services/orchestration/routine-definitions.js` and `routine-runner.service.js` | Routines with trigger and approval policy, run with a deterministic per-window idempotency key (EP-08.05). |
| `ui/server/services/orchestration/workflow-approval.service.js` and `workflow-history.service.js` | Decides sensitive-step approvals, publishes `execution.approval_requested`/`approved`/`rejected`, persists `workflow-runs.jsonl` (EP-08.05). |
| `ui/server/controllers/orchestration-routines.controller.js` and `orchestration-approvals.controller.js` | Routine catalog, idempotent run, approval queue, decision and history; writes restricted to loopback (EP-08.05). |
| `ui/server/services/orchestration/event-engine.js` | Event engine; `event-engine-projection.js` is the mixin with the event projection. |
| `ui/server/services/orchestration/workflow-command-parser.js` | Pure parser of `/workflows` and `/workflow <slug> <desc> [--story K] [--from S]`. |
| `ui/server/services/orchestration/workflow-command.service.js` | Resolves slug against the catalog, starts the run (dossier, completes `start`, seeds `story`), builds the gate card; lists autocomplete suggestions. Builds the card (actions run/advance/approve/cancel + stage prompt) and refreshes it by execution. Routes: `POST /api/project/:slug/workflow-command` (loopback) and `GET /api/orchestration/workflow-commands`. |
| `ui/server/services/orchestration/workflow-stage-prompt.js` | Pure builder of the stage prompt injected by "Executar etapa": delivery context (seed, story), stage agents/skills, gate, dossier path, the file to write, the files to read and the two permission levels (dossier only vs code and commands in an own worktree), plus the stop-after-this-stage rule. |
| `ui/server/services/orchestration/workflow-dossier-paths.js` | Dossier location and naming: `<repo>/docs/features/<feature-slug>/` (override with `projects/<slug>/dossier.json`, fallback `projects/<slug>/dossies/`), slug rules and path-traversal guard. Read-only. |
| `ui/server/services/orchestration/workflow-dossier.service.js` | Creates the dossier folder and `_status.md` (stage registry: id, status done/skipped/pending/in-progress/failed/blocked, reason, file, at; declared evidence), keeps it in sync on every `commit(run)`, reports the stage output file and the files a stage must read. Best effort. |
| `tests/workflow-dossier.test.js` | Paths, root resolution, dossier creation at start, registry sync, per-stage prompt, code stages in own worktree, skipped reasons, name collisions. |
| `ui/server/services/orchestration/workflow-run-persist.js` | Persists each workflow run as `projects/<slug>/workflow-runs/<executionId>.json` (atomic write, best effort) and reads them back, skipping corrupt or foreign files. `workflow-run-store.js` rehydrates runs (and the idempotency index) once per process and exposes `commit(run)` = persist + snapshot, used by the runner and approvals after every state change. |
| `tests/workflow-run-persistence.test.js` | Restart simulation with fresh node processes: active run rehydrated and advanceable, card rebuilt, cancelled stays cancelled, idempotency kept, bad files ignored. |
| `tests/workflow-command.test.js` | Covers parser, slug resolution, invalid slug error, `--from`/`--story`, gate card and suggestions. |
