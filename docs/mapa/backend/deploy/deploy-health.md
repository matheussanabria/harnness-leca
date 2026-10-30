---
domain: backend
module: deploy
feature: deploy-health
summary: Deploy pipelines, deploy configuration and environment health checks (services and controllers).
paths: [ui/server/services/deploy/*.js, ui/server/controllers/deploy-pipeline.controller.js, ui/server/controllers/deploy-health.controller.js]
keywords: [deploy, pipeline, health, environments, config, webhook]
updated: 2026-10-30
---
# Deploy and Health

| File | Responsibility |
|---|---|
| `ui/server/services/deploy/pipeline-definitions.js`, `pipeline-store.js` and `pipeline-runner.service.js` | Pipeline model, `global/deploy-pipelines.json`, staged runs, history in `global/deploy-pipeline-runs.jsonl` (EP-10.01). |
| `ui/server/services/deploy/deploy-config.service.js` | Single source of `global/deployments.json`, webhook masking and environment lookup, shared by panel and pipelines (EP-10.01). |
| `ui/server/controllers/deploy-pipeline.controller.js` | Pipeline catalog, save, run and history; writes restricted to loopback (EP-10.01). |
| `ui/server/services/deploy/health-definitions.js`, `health-store.js` and `health-runner.service.js` | `http`/`command` checks with measured latency, per-environment state, history in `global/deploy-health-runs.jsonl` (EP-10.02). |
| `ui/server/controllers/deploy-health.controller.js` | Per-environment health state, check saving and on-demand run; writes restricted to loopback (EP-10.02). |
