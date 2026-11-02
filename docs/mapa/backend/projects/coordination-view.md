---
domain: backend
module: projects
feature: coordination-view
summary: Read-only coordination ledger lanes on the Scrum board (Coordenacao tab), advisory only.
paths: [ui/server/services/coordination-view.js, ui/server/controllers/coordination-view.controller.js, ui/public/js/modules/design-scrum-coordination.js, ui/public/css/design/14-scrum-coordination.css, tests/coordination-view.test.js]
keywords: [coordination, ledger, state.json, claim, lease, lanes, scrum, board, advisory]
updated: 2026-11-02
---
# Coordination ledger view

Shows `projects/<slug>/coordination/state.json` as lanes by ledger status. It never writes and never touches Scrum lanes (plan 04: ledger is the source for "who works on a story now", Scrum shows an advisory view). The ledger has no worktree field today, so a card shows one only if the story carries `worktree` or `branch`.

| File | Responsibility |
|---|---|
| `ui/server/services/coordination-view.js` | Pure projection of the ledger into lanes (`claimed`, `in_progress`, `review`, `blocked`, `ready`, `planned`, `done`) with lease-expired flag; `done` is counted without cards. |
| `ui/server/controllers/coordination-view.controller.js` | `GET /api/project/:slug/coordination/lanes`; read-only, 404 for unknown project, `available:false` when no ledger exists. |
| `ui/public/js/modules/design-scrum-coordination.js` | Renders the lanes and fetches the endpoint; used by the "Coordenacao" tab in `design-scrum-view.js`. |
| `ui/public/css/design/14-scrum-coordination.css` | Styles of the coordination lanes. |
| `tests/coordination-view.test.js` | Grouping, lease expiry, worktree fallback, done lane and empty ledger. |
