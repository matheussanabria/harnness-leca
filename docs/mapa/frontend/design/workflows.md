---
domain: frontend
module: design
feature: workflows
summary: Workflows tab of the 360 view: catalog, plan, dry run, executions, reducer, renderers, API client and styles.
paths: [ui/public/js/modules/design-workflows*.js, ui/public/css/design/27-workflows.css, ui/public/css/design/28-workflows-plan.css]
keywords: [workflows, plan, dry run, executions, reducer, gate]
updated: 2026-10-30
---
# Workflows Tab

| File | Responsibility |
|---|---|
| `ui/public/js/modules/design-workflows.js` | Workflows tab: loads catalog and plan, runs dry run and real start, lists project executions, advance or cancel (EP-08.06). |
| `ui/public/js/modules/design-workflows-state.js` | Reducer and initial state: catalog, selected workflow, plan, dry run, executions, error and notice (EP-08.06). |
| `ui/public/js/modules/design-workflows-view.js` | Pure escaped renderers for workflow cards, plan steps (agent, skills, gate, permissions, missing), executions and empty/loading/error states. |
| `ui/public/js/modules/design-workflows-api.js` | HTTP client for catalog, per-project plan, start (with dry run), listing, advance and cancel of executions (EP-08.06). |
| `ui/public/css/design/27-workflows.css` | Panel, workflow list, action bar and executions table (EP-08.06). |
| `ui/public/css/design/28-workflows-plan.css` | Plan, steps, skills, gates and states of the Workflows tab; split from `27-workflows.css` for the 300-line limit. |
