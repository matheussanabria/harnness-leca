---
domain: frontend
module: chat
feature: core-shared
summary: Frontend bootstrap, shared state, screen-state client, hash router, per-screen state, API client, projects, groups.
paths: [ui/public/js/app.js, ui/public/js/shared/*.js, ui/public/js/modules/projects.js, ui/public/js/modules/services.js, ui/public/js/deploy/*.js, tests/screen-*.test.js, ui/public/index.html, ui/public/overview.html, ui/public/js/boot.js, ui/public/js/overview.js, ui/public/css/overview.css, ui/public/css/overview-projects.css, ui/public/js/overview-sync.js]
keywords: [bootstrap, state, screen-state, router, api, sse, markdown, dom, projects, groups, services, deploy, office, diario, partials, boot]
updated: 2026-10-31
---
# Core and Shared Frontend

| File | Responsibility |
|---|---|
| `ui/public/js/app.js` | ES Modules entry point; registers on `window` for compatibility and sets up global bindings. |
| `ui/public/js/shared/dom.js` | DOM helpers: `$`, `esc`, `clean`, `fmt`, `autoGrow`, `copyToClipboard`, `openDlg`, toasts. |
| `ui/public/js/shared/markdown.js` | Markdown and parsers: `md(t)`, `parseChat(src)`, `renderChat(src)`, `parseFrontmatter(content)`. |
| `ui/public/js/shared/markdown-code.js` | Extracts `<arquivo caminho="...">` blocks and backticks, rendering `.code-block-card`. |
| `ui/public/js/shared/state.js` | Reactive `state`, conversations screen hydration (filters, view, page, draft, groups, active chat), action registry, color palette (EP-14.07). |
| `ui/public/js/shared/project-selection.js` | Resolves precedence, syncs URL/storage/backend and publishes confirmed project switches. |
| `ui/public/js/shared/screen-state.js` | `loadScreen`, `patchScreen`, `logAction`: hydrate before render, memory cache, 400 ms debounce, `sendBeacon` on `pagehide`, `localStorage` fallback, retry (EP-14.06). |
| `ui/public/js/shared/screen-state-migrate.js` | Mirrors server scopes and `migraDe`, reads and removes old `localStorage` keys on first load, filtered by project (EP-14.06). |
| `ui/public/js/shared/router.js` | Hash routes for app screens (`#/chats`, `#/studio`, `#/scrum`, `#/layers`, `#/board`, `#/audit`, `#/artifacts`, `#/routines`, `#/prototypes/<proto>/<tela>`), including island screens (e.g., `#/lab`): `parseRoute`, `buildRoute`, `createRouter`, `routeTo`. |
| `ui/public/js/modules/route-apply.js` | `createRouteApplier`: opens the screen a route points to, at boot (direct link, F5) and on Back/Forward. |
| `tests/screen-router.test.js` | Covers route parse/build, legacy links, history, route application, four wiring points and registry addresses. |
| `ui/public/js/deploy/deploy-state.js` | Pure deploy state rules: initial config, server data normalization, registry-accepted patch; history from `/api/deploy/history` (EP-14.10). |
| `ui/public/js/office-screen-state.js` | Hydrates office HUD, mouse sensitivity, view mode, window layout/state and workspaces, with a sync adapter for legacy controllers (EP-14.10, EP-14.12). |
| `ui/public/js/office/office-session-storage.js` | Sync storage over `office.windowLayout/windowState/workspaces`, debounced writes via the state client, boot hydration (EP-14.12). |
| `ui/public/js/diario-state.js` | Pure rules for diary filters, sorting and pagination kept in screen state instead of the query string (EP-14.10). |
| `ui/public/js/modules/diario-page.js` | Wires the diary screen to persisted state: filters, dates, engine, order, page size, pagination, show closed (EP-14.12). |
| `tests/screen-state-adoption-14-10.test.js` | Covers deploy, office, overview and diary using screen state and no old `localStorage` keys (EP-14.10). |
| `tests/ep14-12-adoption.test.js` | Covers Design view, artifacts, routines, skills, canvas, office session and diary page in screen state (EP-14.12). |
| `ui/public/js/shared/unsaved-changes.js` | Registers pending changes per project/workspace and blocks transitions with a structured error. |
| `ui/public/js/shared/api.js` | Fetch wrappers and SSE stream reader (`readSSEStream`). |
| `ui/public/js/modules/projects.js` | Listing and projects: `load(slug)`, search, engine filters, sorting, pagination, conversation mapping. Split into `projects-*.js`; `projects-store.js` holds shared state. |
| `ui/public/js/modules/groups.js` | Context groups: create, edit, subgroups, color tags and LLM auto-classification suggestions. Split into `groups-*.js`; `groups-store.js` holds shared state. |
| `ui/public/js/modules/services.js` | Dev processes: start/stop local dev servers and log stream in a modal. |
| `ui/public/js/deploy/` | Deploy screen: `main.js` entry, `deploy-*.js` (incl. `deploy-state.js`) and `deploy-store.js`; config in screen state, history only in `/api/deploy/history` (EP-14.10). |
| `ui/public/index.html` | Page shell; blocks live in `ui/public/partials/` and `ui/public/js/boot.js` loads them before `app.js`. |
| `ui/public/overview.html` | Overview page; styles in `ui/public/css/overview.css`, list logic in `ui/public/js/overview.js`. |
| `ui/public/js/overview.js` | Overview list: one row model rendered as table (>=1024px) and cards (below), list states (loading, error, empty) and click delegation. |
| `ui/public/js/overview-sync.js` | Overview sync: per-project sync (JSON) and the system-wide sync stream (SSE) with its log. |
| `ui/public/css/overview-projects.css` | Cards/table switch at 1024px, card layout, list states and 44px touch targets below 1024px. |
| `ui/public/js/shared/island-loader.js` | Legacy side JS that reads `/dist/islands.js`, injects CSS, mounts/unmounts React islands in `#islandHost`; shows a notice when the build is missing. |
