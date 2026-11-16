---
domain: frontend
module: coverage
feature: central-session-ui
summary: Central session actions, SSE client and session capability selection.
paths: [ui/public/js/modules/central-action-dispatcher.js, ui/public/js/modules/central-live.js, ui/public/js/modules/central-session-actions.js, ui/public/js/modules/session-capability-resolver.js]
keywords: [central, sessions, actions, sse, capabilities]
updated: 2026-11-16
---
# Central Session UI / Interface de Sessões da Central

| File | Responsibility |
|---|---|
| `ui/public/js/modules/central-action-dispatcher.js` | Routes Central session actions to chat and office features. / Encaminha ações de sessão da Central para chat e escritório. |
| `ui/public/js/modules/central-live.js` | Subscribes to the Central SSE stream with cursor and reconnection handling. / Assina o stream SSE da Central com cursor e reconexão. |
| `ui/public/js/modules/central-session-actions.js` | Determines available session actions from resolved capabilities. / Determina as ações disponíveis para a sessão conforme suas capacidades. |
| `ui/public/js/modules/session-capability-resolver.js` | Resolves native resume and context replay support for an engine session. / Resolve suporte a retomada nativa e replay de contexto por sessão. |
