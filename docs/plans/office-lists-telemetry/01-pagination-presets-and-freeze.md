# Plan: pagination with page-size presets and fixing the Central sessions freeze

This is a read-only review; I changed no files. File references were checked against the current code.

## Causes of the freeze (Central render path, `ui/public/js/modules/central-sessions.js`)
1. **Two full rebuilds per SSE event.** `central-live.js` calls `updateStatus({lastUpdatedAt})` on every message. That fires `onStatusChange`, which calls `rebind()` (rebuild the whole `innerHTML` and re-bind all listeners) just to update the badge. Then `onEvent` calls `loadCentral` and runs `rebind()` again.
2. **No coalescing or request control.** A burst of N events starts N `listSessions(limit:200)` calls at the same time, and their results can arrive out of order. The 5 s cache is skipped whenever a filter or search is set, and `force` never deduplicates calls already in flight.
3. **The server scans the whole event log on every request.** `session-registry-orchestrator.service.js` calls `projectSessions(slug)` each time, and `event-projector` reads the full log in pages of 1000.
4. **Every keystroke in search runs `onChange`, which rebuilds everything.** This also drops focus from the input. Selecting a row refetches all 200 sessions plus the detail.
5. **The Kanban pages first and groups second** (25 cards in total, split across lanes). The page is wrong, and it still renders every card's markup.

## Settings data model (new screen in `ui/server/services/screen-state/registry.js`)
`tela("lists", "Listas", "global", "/office", "fa-list", { pageSizes: objeto(4096), laneLimits: objeto(2048), kanbanAutoFallback: booleano() })`
- `pageSizes`: `{ "<listKey>": 5|10|25|50 }`. Only preset values are accepted, both on read and on write.
- `laneLimits`: `{ "central:<laneId>": n }`, the extra cards loaded with "show more" (reset per session is an option).
- List keys: `central`, `cabinet`, `scrum-backlog`, `scrum-epics`, `workflows`, `workflow-runs`, `routines`, `routines-history`, `artifacts`.
- Constants in `pagination.js`: `DEFAULT_PAGE_SIZE = 5`, `PAGE_SIZE_PRESETS = [5, 10, 25, 50]`, `KANBAN_LANE_LIMIT = 5`, `KANBAN_FALLBACK_MAX = 100` (threshold still to confirm).

## Changes by file
- `ui/public/js/shared/pagination.js` (S): default 5 and the presets. `renderPager` gets an optional `<select data-page-size>`, shown whenever total > 5 (not only when there are 2+ pages). `bindPagers` handles that change: save the size, go to page 1, then call `onChange`. `pagedHtml` uses `getPageSize(key)` and drops the per-call `pageSize`. The file stays pure.
- `ui/public/js/shared/pagination-prefs.js` (new, S): `hydratePageSizes()` via `loadScreen("lists")` before the first render, a synchronous cache behind `getPageSize`/`setPageSize`, and saving through `patchScreen` (which already debounces).
- `ui/public/js/shared/screen-state-migrate.js` (S): check whether `isKnownScreen`/`screenScope` come from the catalog. If the list is hard-coded, add `lists`.
- `ui/public/js/office/office-cabinet-journal.js`, `design-scrum-backlog.js`, `design-workflows-view.js`, `design-routines.js`, `design-artifacts.js` (S each): remove the fixed sizes (20/25/9/12/10/15) and use the list keys. The cabinet moves from `bindPager` to `bindPagers`.
- `ui/public/js/modules/central-sessions-view.js` (M): remove `CENTRAL_PAGE_SIZE`. Split the render into `renderCentralShell` (header, toolbar, filters, empty slots) and `renderCentralContent`. Use the server page instead of slicing on the client. Hide the pager in Kanban.
- `ui/public/js/modules/central-sessions-kanban.js` (new, M): group first, then cap each lane (`KANBAN_LANE_LIMIT` plus anything loaded with "show more"). Each lane gets a `button[data-lane-more]` with the count of hidden cards. If total > `KANBAN_FALLBACK_MAX`, render the list with a notice ("Too many sessions for the Kanban (N)") and a "Show Kanban anyway" button.
- `ui/public/js/modules/central-sessions-sync.js` (new, M): a refresh scheduler with 500 ms trailing debounce (max wait 2 s), one request in flight with `AbortController`, and a pause when `document.hidden`. A cheap signature (ids + `updatedAt`) skips the content render when nothing changed.
- `ui/public/js/modules/central-sessions.js` (M): `onStatusChange` only replaces the `.central-live-badge` node. `onEvent` goes through the scheduler. The content and detail areas update separately. Listeners use event delegation, bound once on the container. Search is debounced at 250 ms and the input is never re-rendered. To stay under 250 lines, move the listeners into `central-sessions-listeners.js`.
- `ui/public/js/modules/central-sessions-api.js` (S): send `limit` = page size and `cursor` = `(page-1)*size`, plus `signal`. The header summary reads `payload.totals` instead of running `summarize()` over the 200 sessions.
- `ui/server/controllers/canonical-session.controller.js` (S): pass `cursor` through (only `limit` is passed today). Optionally add a `laneLimit` parameter.
- `session-registry-orchestrator.service.js` (S): default limit drops to 5. Optional: support `laneLimit` (first N per `workflowStatus`) and return `totals.byLane`.
- `ui/server/services/events/event-projector.js` (M): cache `projectSessions(slug)` by log size and mtime so unchanged logs are not re-read.
- `ui/public/css/design/23-central-sessoes.css` (S): styles for the size selector, the "show more" button and the fallback notice, using FontAwesome icons only.

## Tests
- `tests/shared-pagination.test.js`: default 5; size not in the presets falls back to 5; selector shown when total > 5 even with one page; changing size goes back to page 1.
- `tests/pagination-prefs.test.js` (new): hydrate, synchronous read, save via a fake `patchScreen`, separate keys.
- Screen-state tests (`screen-state-store/http`): `lists` accepted, out-of-range values dropped, `isStorageKeyCovered` still passes.
- `tests/central-sessions-view.test.js`: per-lane limit, "show more" adds cards, fallback above the threshold, "Show Kanban anyway" option.
- `tests/central-sessions-ui.test.js`: 20 events produce 1 fetch and 1 render; a status change touches only the badge; an aborted fetch is ignored; search keeps focus; unchanged signature means no render.
- `tests/central-sessions-projection.test.js`: `limit`/`cursor`/`totals` with 500 sessions; the cache invalidates when the log grows.
- Performance smoke test: 500 sessions in the fake DOM, render under a set budget.

## Ordered tasks
1. S: page-size constants and selector in `pagination.js`, plus tests.
2. S: `lists` screen in the registry and the client-side `pagination-prefs.js`, plus tests.
3. S: move the 6 lists to list keys and remove the fixed sizes.
4. M: Central quick fixes: badge-only update, event scheduler, abort, debounced search. This removes most of the freeze, so do it first among the Central work.
5. M: split the Central render into shell and content, with delegated listeners.
6. M: Kanban per-lane limit, "show more", fallback, plus tests.
7. S/M: server pagination (`limit`/`cursor` from the client, totals in the header).
8. M: cache the event-projector projection.
9. Optional, M: server-side `laneLimit` / `totals.byLane`.

## Open questions
- **Q1:** Should page sizes be global (per user) or per project? The plan assumes global.
- **Q2:** "Every list": do the overview (server default 10), the diary (10/25/50) and the chats (`pageSize`) also move to 5 and the same presets?
- **Q3:** Fallback threshold: is 100 cards right, and should choosing "Show Kanban anyway" be remembered?
- **Q4:** Should lanes added with "show more" be saved, or reset each session?
- **Q5:** With server pagination, does the Kanban fetch per lane (`workflowStatus`) or keep one request with a cap? This depends on how `groupByLane` maps statuses to lanes.
- **Q6:** Is the freeze also in the office canvas while the panel is hidden? If so, also pause the scheduler while the tab is inactive.
