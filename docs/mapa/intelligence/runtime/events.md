---
domain: intelligence
module: runtime
feature: events
summary: Central event log (EP-09): event store, projections, SSE stream, API and the EP-09 story documents.
paths: [docs/harness-evolution/02-epics/EP-09-observabilidade/*.md, ui/server/services/events/*.js, ui/server/controllers/central-events.controller.js, ui/server/routes/central-events.routes.js, tests/central-events*.test.js]
keywords: [events, event-log, sse, projections, central, ep-09, stream]
updated: 2026-10-30
---
# Central Event Log

| File | Responsibility |
|---|---|
| `docs/harness-evolution/02-epics/EP-09-observabilidade/10-contrato-leitura-central.md` | Frozen read contract between 09.02 (event log) and 09.03 (Central). |
| `docs/harness-evolution/02-epics/EP-09-observabilidade/09.02-event-log-sse.md` | Story for the persistent event log, projections and SSE recovery. |
| `docs/harness-evolution/02-epics/EP-09-observabilidade/09.04-navegacao-retomada.md` | Detailed story for navigation, resume and integration with Chat and Office. |
| `docs/harness-evolution/02-epics/EP-09-observabilidade/09.05-atencao-aprovacoes.md` | Detailed story for attention needed, notifications and the approvals queue. |
| `ui/server/services/events/event-store.js` | Per-project append-only log on native SQLite, with cursor, idempotency and type aliases. |
| `ui/server/services/events/event-stream.js` | SSE stream with cursor, keep-alive and clean close. |
| `ui/server/controllers/central-events.controller.js` | API for events, projections, recoverable stream and publishing (loopback). |
| `ui/server/routes/central-events.routes.js` | Routes `GET/POST /api/project/:slug/events`, `/projections` and `/sessions/stream`. |
| `tests/central-events.test.js` | Tests of the log, projections and SSE format. |
| `tests/central-events-http.test.js` | Tests of the events API, projections and stream. |
