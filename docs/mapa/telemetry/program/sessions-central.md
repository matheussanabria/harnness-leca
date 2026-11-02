---
domain: telemetry
module: program
feature: sessions-central
summary: Merge of the EP-09 session projection into the Central read model and the redesigned Central sessions UI.
paths: [ui/server/services/canonical-sessions/session-projection-merge.js, ui/server/services/canonical-sessions/session-registry-orchestrator.service.js, ui/server/services/events/event-projector.js, ui/public/js/modules/central-sessions*.js, tests/central-sessions-*.test.js, tests/central-projection-usage.test.js]
keywords: [central, sessions, projection-merge, kanban, origin, readCentral, phantom-session]
updated: 2026-11-01
---
# Central sessions merge and UI

| File | Responsibility |
|---|---|
| `ui/server/services/canonical-sessions/session-projection-merge.js` | Merges the EP-09 session projection into the Central read model (T2.5): exact id, native id in registry fingerprint, else own row; scanner sessions `inferred`. |
| `ui/server/services/events/event-projector.js` | Session, execution and attention projections, rebuildable from the log; `projectSessions` ignores `usage.observed` (it created provider-less phantom session views); usage stays queryable. |
| `ui/public/js/modules/central-sessions-format.js` | Shared `esc` and `statusBadge` HTML helpers of the Central views. |
| `ui/public/js/modules/central-sessions-presence.js` | Activity, presence and origin ("externa" / "chat do Harness") badges and the "ultima atividade" text. |
| `ui/public/js/modules/central-sessions-detail.js` | Central detail panel (split from the view) with activity, origin and last activity. |
| `ui/public/js/modules/central-sessions-toolbar.js` | Header with three stat cards and toolbar with search, filters, refresh and mode toggle. |
| `ui/public/js/modules/central-sessions-card.js` | Structured 6-column list rows and kanban cards for the redesigned Central views. |
| `ui/public/js/modules/central-sessions-kanban.js` | Kanban with a per-lane cap: groups by lane first, shows 5 cards per lane (`laneLimits`), the disabled-Kanban notice above 100 sessions and the forced mode (`kanbanForce`). |
| `ui/public/js/modules/central-sessions-kanban-controls.js` | Binds the Kanban buttons (`data-lane-more`, `data-kanban-force`) to the Central state. |
| `ui/public/js/modules/central-sessions-view.js` | List and Kanban composition of the Central, re-exporting detail, toolbar and cards. |
| `ui/public/js/modules/central-sessions.js` | Central controller; requests up to 200 sessions so the totals line counts the merged list; the list renders 25 per page (`page` in state, reset on search/filter/view change); the Kanban has no pager and caps each lane at 5 cards (`laneLimits`, reset on search/filter change). |
| `tests/central-sessions-ui.test.js` | Tests for the redesigned Central UI: stat cards, toolbar, 6 columns, muted neutral states, line caps, dock spacing. |
| `tests/central-projection-usage.test.js` | Proof of the phantom-session cause and the projector fix (usage events kept, no session views). |
| `tests/central-sessions-projection.test.js` | Merge with dedup (external, chat, markdown), filters and totals on merged list, UI rendering of list, kanban, detail. |
