---
domain: backend
module: core
feature: route-registry
summary: Route table index (first match wins) and the per-domain route files split out of router.js, with its guard test.
paths: [ui/server/routes/index.js, ui/server/routes/scrum.routes.js, ui/server/routes/source.routes.js, ui/server/routes/state.routes.js, ui/server/routes/orchestration-stream.routes.js, ui/server/routes/project.routes.js, ui/server/routes/project-skills.routes.js, ui/server/routes/project-services.routes.js, ui/server/routes/app.routes.js, ui/server/routes/chat.routes.js, ui/server/routes/permissions.routes.js, ui/server/routes/deploy.routes.js, ui/server/routes/hia.routes.js, tests/route-registry.test.js]
keywords: [router, routes, registry, index, order, first-match, split, cat-04]
updated: 2026-11-06
---
# Route registry

`ui/server/router.js` only handles the request (PIN gate, preview proxy, matching, static fallback). The table it matches against is `ROUTES` in `ui/server/routes/index.js`: one array per domain, spread in order. The first matching route wins, so a specific path goes before a broader regex. New routes go in a `*.routes.js` file plus one line in the index, never inline in `router.js`. The other route files (design, inspect, artifact, audit, canvas, catalog, screens, sessions, events, orchestration, skill-bindings, scrum-sprint, engine-activity) are described in their own map files.

| File | Responsibility |
|---|---|
| `ui/server/routes/index.js` | The ordered `ROUTES` table: requires and spreads every `*.routes.js` file; holds the ordering note for events vs sessions. |
| `ui/server/routes/scrum.routes.js` | Project Scrum: board, story save/status/transition/assign/delete, capture, duplicates, commits, DoR, epics, sprints, lanes, Jira sync, panel, coordination lanes. |
| `ui/server/routes/source.routes.js` | Studio source list, read and save, plus the project journal. |
| `ui/server/routes/state.routes.js` | `/api/state`, active agents summary and the orchestration state, events and execution detail reads. |
| `ui/server/routes/orchestration-stream.routes.js` | Orchestration SSE stream and operations; registered after the orchestration route group. |
| `ui/server/routes/project.routes.js` | Engines, overview, sync, active project, project detail, memory review and chat groups. |
| `ui/server/routes/project-skills.routes.js` | Project skills: list, templates, recognized, detail, save, install, import, delete. |
| `ui/server/routes/project-services.routes.js` | Project dev services: status, start, stop, logs, config. |
| `ui/server/routes/app.routes.js` | File read, DAI catalog, app ping and the remote info and PIN endpoints. |
| `ui/server/routes/chat.routes.js` | Chat send, stream attach and stop, save and upload. |
| `ui/server/routes/permissions.routes.js` | Permission request and answer, and the per-project permission list and removal. |
| `ui/server/routes/deploy.routes.js` | Deploy config, trigger, history, pipelines, health checks, timeline, logs, actions and status. |
| `ui/server/routes/hia.routes.js` | HIA metrics. |
| `tests/route-registry.test.js` | Every route file is in the index once, no inline routes in `router.js` (at most 150 lines), events-before-sessions order, well-formed table without shadowed duplicates. |
