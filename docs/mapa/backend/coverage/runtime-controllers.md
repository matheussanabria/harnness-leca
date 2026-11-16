---
domain: backend
module: coverage
feature: runtime-controllers
summary: HTTP endpoints for attention, engine activity, orchestration, permissions and uploads.
paths: [ui/server/controllers/central-attention.controller.js, ui/server/controllers/engine-activity.controller.js, ui/server/controllers/orchestration.controller.js, ui/server/controllers/permissions.controller.js, ui/server/controllers/upload.controller.js]
keywords: [runtime, controllers, attention, orchestration, permissions]
updated: 2026-11-16
---
# Runtime Controllers / Controllers de Runtime

| File | Responsibility |
|---|---|
| `ui/server/controllers/central-attention.controller.js` | Lists, acknowledges and resolves project attention queue items. / Lista, reconhece e resolve itens da fila de atenção do projeto. |
| `ui/server/controllers/engine-activity.controller.js` | Serves engine presence and activity information. / Disponibiliza informações de presença e atividade dos motores. |
| `ui/server/controllers/orchestration.controller.js` | Serves consolidated orchestration state and event streams. / Disponibiliza estado consolidado e streams de eventos da orquestração. |
| `ui/server/controllers/permissions.controller.js` | Handles permission requests made by Claude Code during chat. / Trata solicitações de permissão feitas pelo Claude Code durante o chat. |
| `ui/server/controllers/upload.controller.js` | Handles chat attachment uploads. / Trata uploads de anexos de chat. |
