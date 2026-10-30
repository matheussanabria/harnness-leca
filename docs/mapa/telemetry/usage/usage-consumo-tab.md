---
domain: telemetry
module: usage
feature: usage-consumo-tab
summary: Consumo tab of the orchestration center: usage panel formatters, view model, rendering, polling and styles.
paths: [ui/public/js/modules/usage-*.js, ui/public/js/office3d/orchestration/tab-usage.js, ui/public/css/office/20-usage-panel.css, tests/usage-tab-*.test.js]
keywords: [consumo, usage, panel, tab, view-model, polling, css]
updated: 2026-10-30
---
# Consumo tab

| File | Responsibility |
|---|---|
| `ui/public/js/modules/usage-format.js` | Panel formatters: compact K/M/B with exact title, cost, share percent; null renders as n/d. |
| `ui/public/js/modules/usage-view-model.js` | Builds the view model: cards, main vs subagent split, per-day buckets, models, sessions, coverage, notices. |
| `ui/public/js/modules/usage-view.js` | HTML sections of the consumption panel. |
| `ui/public/js/modules/usage-render.js` | Composes loading, error, disabled, empty and ready states of the panel. |
| `ui/public/js/modules/usage-api.js` | Fetches `/usage/summary` for day, model and session groupings with an abort signal. |
| `ui/public/js/modules/usage-panel.js` | Panel controller: 30 s polling only while visible, abort, window selector, retry. |
| `ui/public/js/office3d/orchestration/tab-usage.js` | The Consumo tab of the Orchestration Center (render, setup, unmount). |
| `ui/public/css/office/20-usage-panel.css` | Panel styles using the office dark theme tokens. |
| `tests/usage-tab-model.test.js` | Pure logic tests: formatters, view model, split math, null-never-zero. |
| `tests/usage-tab-panel.test.js` | Fake-DOM panel tests: states, polling stop when hidden, abort, retry. |
