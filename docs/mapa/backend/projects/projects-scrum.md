---
domain: backend
module: projects
feature: projects-scrum
summary: Project overview, project state and files, active project selection and Scrum lanes, transitions and impediments.
paths: [ui/server/controllers/overview.controller.js, ui/server/controllers/project.controller.js, ui/server/services/project*.js, ui/server/controllers/scrum*.controller.js, ui/public/js/modules/design-scrum*.js, ui/public/css/design/09-scrum-story-details.css, ui/public/css/design/10-scrum-lanes.css, ui/public/css/design/11-scrum-lane-order.css, ui/public/css/design/12-scrum-story-transitions.css, ui/public/css/design/13-scrum-filters-metrics.css]
keywords: [project, overview, active, scrum, lanes, transitions, impediments, jira, snapshot, filters, metrics, drawer]
updated: 2026-11-01
---
# Projects and Scrum

| File | Responsibility |
|---|---|
| `ui/server/controllers/overview.controller.js` | Paginated activity summary (`GET /api/overview`). |
| `ui/server/controllers/project.controller.js` | State (`/api/state`), details (`/api/project/:slug`), groups and safe file reading. |
| `ui/server/services/project.service.js` | Reads metadata, counts chats and caches conversation statistics. |
| `ui/server/services/project-selection.service.js` | Canonicalizes slugs and atomically replaces `projects/.active`. |
| `ui/server/services/project-scrum-migration.js` | Versions `scrum.json`, maps status to lanes, creates a backup, writes atomically and rolls back. |
| `ui/server/services/project-scrum-lanes.js` | Defines the 12 canonical lanes, validates attributes and accepts only a full ID permutation with contiguous order. |
| `ui/server/services/project-scrum-ops.js` and `ui/server/controllers/scrum.controller.js` | Persist lane config and order with `lanesRevision`; reject stale concurrency with HTTP 409. |
| `ui/server/services/project-scrum-maturity.js` | Story maturity (`draft`, `refining`, `ready`; absent means `ready`): sprint entry guard and the `ready` gate backed by the DoR. |
| `ui/server/services/project-scrum-dor.js` | Pure, deterministic mechanical Definition of Ready (`dor-mechanical-v1`): 4 required and 5 advisory checks; always flags human review. |
| `ui/server/services/project-scrum-commits.js` | Read-only git reader: commits whose last trailer block has `Story: <id>`, SHAs verified with `git cat-file`, no shell, no `GIT_*` env, no paths in results. |
| `ui/server/controllers/scrum-trace.controller.js` | `GET /api/project/:slug/scrum/story/:id/commits` and `/dor`; commits use only the project's configured repo, never `projects/<slug>`. |
| `ui/server/services/project-scrum-transitions.js` and `ui/server/controllers/scrum-transition.controller.js` | Validate the canonical matrix, active lanes and expected origin; persist move and history atomically. |
| `ui/server/services/project-scrum.service.js` | Scrum facade; split into `project-scrum-*.js` modules in the same folder (defaults, migration, lanes, ops, persist, sanitize, transitions, resolver). |
| `ui/server/services/project-screens.service.js` | Screens facade; split into `project-screens-*.js` modules in the same folder (canvas, fallback, logic, sistema). |
| `ui/server/services/project-scrum-jira-source.js` | Reads the Jira snapshot (comments and sprints); `ui/server/services/project-scrum-jira-sprints.js` extracts sprints from the Server/Cloud payload. |
| `ui/server/services/project-scrum-doc-source.js` | Parses story documents; `ui/server/services/project-scrum-resolver.js` composes them with the local state. |
| `ui/server/controllers/scrum-jira-sync.controller.js` | Exposes `POST /scrum/jira-sync`; the Sync Jira button is `ui/public/js/modules/design-scrum-jira-sync.js`; the snapshot export CLI is in `jira-setup.md`. |
| `ui/public/js/modules/design-scrum.js` | Scrum UI facade split into `design-scrum-*.js` modules in the same folder; `design-scrum-store.js` holds the shared mutable state. |
| `ui/public/js/modules/design-scrum-lane-config.js` | Lane attribute configuration; `design-scrum-lane-order-model.js` computes the visible order, `design-scrum-lane-order.js` handles network, drag and keyboard. |
| `ui/public/css/design/10-scrum-lanes.css` | Lane styles; `ui/public/css/design/11-scrum-lane-order.css` styles the lane order controls. |
| `ui/public/js/modules/design-scrum-story-transition.js` | Story moves: integrates the endpoint, drag, buttons, announcement and focus; history shows in the drawer; styles in `ui/public/css/design/12-scrum-story-transitions.css`. |
| `ui/public/js/modules/design-scrum-filters.js` | Pure filter selection; `design-scrum-filter-bar.js` is the shared bar and `design-scrum-metrics.js` computes metrics and the strip (EP-05.05). |
| `ui/public/css/design/13-scrum-filters-metrics.css` | Styles of the Scrum filter bar and metrics strip. |
| `ui/public/js/modules/design-scrum-story-card.js` | Story card; `design-scrum-story-drawer.js` is the details drawer and `design-scrum-status-mapping.js` maps Jira status to lanes. |
| `ui/public/css/design/09-scrum-story-details.css` | Styles of Scrum story details (card and drawer). |

- Impediments (EP-05.05): `project-scrum-ops.js`, `project-scrum-persist.js` and `project-scrum-resolver.js` persist `impediment`/`impedimentHistory`, compose the summary with blockers and keep external snapshots intact.
