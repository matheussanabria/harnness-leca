---
domain: backend
module: projects
feature: projects-scrum
summary: Project overview, project state and files, active project selection and Scrum lanes, transitions and impediments.
paths: [ui/server/controllers/overview.controller.js, ui/server/controllers/project.controller.js, ui/server/services/project*.js, ui/server/controllers/scrum*.controller.js]
keywords: [project, overview, active, scrum, lanes, transitions, impediments]
updated: 2026-10-30
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
| `ui/server/services/project-scrum-transitions.js` and `ui/server/controllers/scrum-transition.controller.js` | Validate the canonical matrix, active lanes and expected origin; persist move and history atomically. |

- Impediments (EP-05.05): `project-scrum-ops.js`, `project-scrum-persist.js` and `project-scrum-resolver.js` persist `impediment`/`impedimentHistory`, compose the summary with blockers and keep external snapshots intact.
