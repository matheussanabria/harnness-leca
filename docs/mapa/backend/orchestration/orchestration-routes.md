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
