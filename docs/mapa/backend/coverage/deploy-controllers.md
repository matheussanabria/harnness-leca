---
domain: backend
module: coverage
feature: deploy-controllers
summary: HTTP endpoints for deployment configuration, authorized actions, status, timeline and logs.
paths: [ui/server/controllers/deploy-actions.controller.js, ui/server/controllers/deploy-status.controller.js, ui/server/controllers/deploy-timeline.controller.js, ui/server/controllers/deploy.controller.js]
keywords: [deploy, controllers, actions, status, history]
updated: 2026-11-16
---
# Deployment Controllers / Controllers de Deploy

| File | Responsibility |
|---|---|
| `ui/server/controllers/deploy-actions.controller.js` | Lists, authorizes and executes permitted deployment actions. / Lista, autoriza e executa ações permitidas de deploy. |
| `ui/server/controllers/deploy-status.controller.js` | Returns the operational deployment status summary. / Retorna o resumo do estado operacional de deploy. |
| `ui/server/controllers/deploy-timeline.controller.js` | Serves filtered deployment timeline and log data. / Disponibiliza dados filtrados da linha do tempo e logs de deploy. |
| `ui/server/controllers/deploy.controller.js` | Reads and saves deployment configuration and history. / Lê e salva configuração e histórico de deploy. |
