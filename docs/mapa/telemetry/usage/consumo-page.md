---
domain: telemetry
module: usage
feature: consumo-page
summary: Standalone /consumo page: provider quota gauges, daily trend, 9Router combo table and OpenCode table with as-of times.
paths: [ui/public/consumo.html, ui/public/css/consumo.css, ui/public/js/consumo/*.js, tests/consumo-page.test.js]
keywords: [consumo, page, quota, gauge, combos, opencode, 9router, pagination, stale, estimated]
updated: 2026-11-02
---
# Consumo page (/consumo)

Read-only page fed by `GET /api/usage/quotas`, `/api/usage/combos`, `/api/usage/opencode` and, when `?p=<project>` is set, the project daily summary. Each source fails on its own and shows an unavailable chip. Combo and OpenCode tables show a Cache column (cache reads and share) and an input:output ratio; 9Router `promptTokens` already includes cached reads (counters come from the `tokens` JSON column), while OpenCode `tokens.input` excludes them, so its share uses input + cache.

| File | Responsibility |
|---|---|
| `ui/public/consumo.html` | Page shell (header, sections, module bootstrap); route added in `static.controller.js`, link in `index.html`. |
| `ui/public/css/consumo.css` | Page styles: gauges, tables, trend bars, pager (dark and light tokens). |
| `ui/public/js/consumo/consumo-api.js` | Parallel fetch of the six sources (quotas, combos, OpenCode, Gemini, routing, trend) with per-source error and abort. |
| `ui/public/js/consumo/consumo-model.js` | Pure view model: quota cards (percent, level, estimated, stale), combo and OpenCode rows, as-of chips, trend. |
| `ui/public/js/consumo/consumo-view.js` | Escaped HTML renderers; tables paginated with `shared/pagination.js` keys `consumo-combos` and `consumo-opencode`. |
| `ui/public/js/consumo/consumo-page.js` | Controller: hydrates page sizes, 30 s polling while visible, repaint on page change without refetch. |
| `tests/consumo-page.test.js` | Model, escaping, no-emoji and per-source failure tests. |
