---
domain: tools
module: coverage
feature: attention-activity-services
summary: Server aggregation services for agent activity and unified attention queue.
paths: [ui/server/services/agent-activity.service.js, ui/server/services/attention-queue.service.js]
keywords: [agents, activity, attention, queue]
updated: 2026-11-16
---
# Activity and Attention Services / Serviços de Atividade e Atenção

| File | Responsibility |
|---|---|
| `ui/server/services/agent-activity.service.js` | Read-only detection of active local engine sessions and conversations. / Detecta sessões locais ativas de motores e conversas em modo somente leitura. |
| `ui/server/services/attention-queue.service.js` | Aggregates, normalizes and orders unified attention items and pending approvals. / Agrega, normaliza e ordena itens da fila unificada e aprovações pendentes. |
