---
domain: frontend
module: canvas
feature: kanban-carryover-fit
summary: Sprint kanban lists open stories of earlier active sprints, shows hidden lanes that hold stories, fits columns.
paths: [ui/public/js/modules/design-scrum-filters.js, ui/public/js/modules/design-scrum-sprint.js, ui/public/js/modules/design-scrum-story-card.js, ui/public/css/design/37-scrum-kanban-fit.css, tests/scrum-carryover.test.js, docs/features/kanban-carryover-fit/02-bdd.feature]
keywords: [scrum, kanban, sprint, carry-over, raia, selo, DIS-443, layout, scrollbar]
updated: 2026-11-11
---
# Sprint kanban: carried-over stories and column fit

The active-sprint view (`storiesForSprint`, filter "active") adds `carriedOver(...)`: stories not done and not in the `concluido` or `backlog` lanes whose sprint is another sprint with status `active` (the Jira snapshot keeps ended sprints as active). Each gets `carryFrom` (sprint name) and the card shows the "veio da Sprint N" badge. A specific sprint chosen in the selector shows only that sprint.
Hidden lanes: a lane configured as not visible (e.g. `pronto-para-dev`) is still drawn, tagged "Oculta" with disabled move arrows, when it holds stories of the shown sprint; hidden empty lanes stay hidden. Before this, their cards vanished silently.
Layout: `37-scrum-kanban-fit.css` removes the per-column horizontal scroll, wraps the card footer buttons and makes scrollbars follow the dark theme.

| File | Responsibility |
|---|---|
| `ui/public/js/modules/design-scrum-filters.js` | `storiesForSprint` plus `carriedOver`. |
| `ui/public/js/modules/design-scrum-sprint.js` | Draws hidden lanes that have stories, with the Oculta tag. |
| `ui/public/js/modules/design-scrum-story-card.js` | Origin badge on the card. |
| `ui/public/css/design/37-scrum-kanban-fit.css` | Column fit, wrapping footer, dark scrollbars, badge style. |
| `tests/scrum-carryover.test.js` | CP-01 to CP-05, CP-07, CP-08. |
| `docs/features/kanban-carryover-fit/02-bdd.feature` | BDD (CP-06 is manual). |
