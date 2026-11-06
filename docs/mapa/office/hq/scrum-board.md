---
domain: office
module: hq
feature: scrum-board
summary: Interactive Scrum board in the office: move stories between lanes, open details, switch sprint, start and close it.
paths: [ui/public/js/office/scrum-board/*.js, ui/public/css/office/21-scrum-board.css, tests/office-scrum-board.test.js]
keywords: [office, scrum, kanban, sprint, drawer, window, war-screen, drag, interactive]
updated: 2026-11-06
---
# Office Scrum board

Opened by the war screen on the `kanban` preset (descriptor `moduleByPreset: { kanban: "scrum" }` in `facilities.data.js`, resolved in `office-action-dispatcher.js`) and rendered by the `scrum` case of `office-drawer-views.js`. It reuses the existing Scrum routes; the office user is recorded as `human:office`.

| File | Responsibility |
|---|---|
| `ui/public/js/office/scrum-board/scrum-board-model.js` | Pure rules: visible lanes, sprint view, adjacent-lane targets, progress, days left, which sprint actions are available, close preview. |
| `ui/public/js/office/scrum-board/scrum-board-api.js` | Wrappers over transition, impediment, sprint start/close, DoR and commits routes; never throws. |
| `ui/public/js/office/scrum-board/scrum-board-controller.js` | State and actions: load, select view and story, move, start, confirm and close, impediment; publishes the new Scrum after each success. |
| `ui/public/js/office/scrum-board/scrum-board-view.js` | Markup of lanes and cards (escaped, FontAwesome, move buttons only toward allowed lanes). |
| `ui/public/js/office/scrum-board/scrum-board-sprint-view.js` | Markup of the sprint bar (selector, progress, start, close confirmation) and the story detail with DoR and commits. |
| `ui/public/js/office/scrum-board/scrum-board.js` | DOM glue: click, keyboard and drag handlers assigned as properties, so remounting never stacks listeners; listens to `dai:scrumChanged`. |
| `ui/public/css/office/21-scrum-board.css` | Board styles; imported by `ui/public/css/office.css`. |
| `tests/office-scrum-board.test.js` | Model, views, API and controller flows (conflict, busy, late answers). |
