---
domain: office
module: hq
feature: scrum-panel
summary: Read-only Scrum panel in the office board drawer: open stories, ledger holder agent, linked commits.
paths: [ui/public/js/office/office-scrum-panel.js, ui/server/services/scrum-panel.js, ui/server/controllers/scrum-panel.controller.js, tests/scrum-panel.test.js]
keywords: [office, scrum, panel, ledger, agents, commits, drawer, whiteboard]
updated: 2026-11-04
---
# Office Scrum panel

`GET /api/project/:slug/scrum/panel` joins three existing read-only sources; it writes nothing.

| File | Responsibility |
|---|---|
| `ui/server/services/scrum-panel.js` | Pure `buildScrumPanel`: open stories (cap 60, later lanes first), holder by id or key from the ledger, last commit and count, per-agent totals, plus active ledger cards that match no story (cap 30). |
| `ui/server/controllers/scrum-panel.controller.js` | Loads Scrum, ledger and one `readStoryCommits` call (max 500 commits), answers JSON; missing ledger or repo degrades to flags. |
| `ui/public/js/office/office-scrum-panel.js` | Markup (escaped, FontAwesome, paginated with the shared pager) and `mountScrumPanel`; shows notes when ledger or git is missing. |
| `tests/scrum-panel.test.js` | Join rules, caps, ledger-only cards, escaping and no emoji. |

- Mounted by the `whiteboard` case of `ui/public/js/office/office-drawer-views.js`; styles reuse `ui/public/css/design/14-scrum-coordination.css`, imported in `ui/public/css/office.css`.
- Known gap: ledger ids (`EP-xx.yy`) and local Scrum ids (`us-...`) rarely coincide, so the ledger-only section carries most agent information until stories are linked.
