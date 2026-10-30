---
domain: intelligence
module: runtime
feature: sessions
summary: Canonical session registry (EP-09.01): model, registry, discovery, reconciler, API and tests.
paths: [ui/server/services/canonical-sessions/**/*.js, ui/server/controllers/canonical-session.controller.js, ui/server/routes/canonical-sessions.routes.js, tests/canonical-session-*.test.js]
keywords: [sessions, canonical, registry, reconciler, discovery, fingerprint, ep-09]
updated: 2026-10-30
---
# Canonical Session Registry

| File | Responsibility |
|---|---|
| `ui/server/services/canonical-sessions/session-model.js` | Canonical model: fingerprint, state enums, creation, additive migration and validation. |
| `ui/server/services/canonical-sessions/session-registry.service.js` | Per-project registry (`projects/<slug>/canonical-sessions.json`) with atomic writes, tolerant reads and explicit linking. |
| `ui/server/services/canonical-sessions/session-registry-orchestrator.service.js` | Combines discovery, reconciliation and registry; builds the Central read model; `readCentral` merges the projection before filters, totals (adds `byOrigin`) and paging, and degrades to registry-only on failure. |
| `ui/server/services/canonical-sessions/session-reconciler.service.js` | Match order: exact, explicit metadata, reconciled origin, inferred candidate, unlinked. |
| `ui/server/services/canonical-sessions/session-workflow-linker.js` | Projects the 08.05 workflow state onto sessions without duplicating the source of truth. |
| `ui/server/services/canonical-sessions/discovery/markdown-discovery.js` | Read-only discovery port for Markdown conversations. |
| `ui/server/services/canonical-sessions/discovery/session-discovery.service.js` | Orchestrates discovery ports, deduplicating by fingerprint. |
| `ui/server/controllers/canonical-session.controller.js` | Read and link API of the canonical registry. |
| `ui/server/routes/canonical-sessions.routes.js` | Routes `GET/POST /api/project/:slug/sessions[...]`. |
| `tests/canonical-session-registry.test.js` | Registry tests: writes, migration, tolerant reads, linking and filters. |
| `tests/canonical-session-discovery.test.js` | Tests of read-only discovery and reconciliation. |
| `tests/canonical-session-http.test.js` | API tests: reads, filters, loopback, evidence and 404. |
