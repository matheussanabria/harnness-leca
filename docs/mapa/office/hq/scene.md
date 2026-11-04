---
domain: office
module: hq
feature: scene
summary: DAI HQ virtual office scene, 3D and 2.5D engines, war screen, object catalog, agent state and telemetry.
paths: [ui/public/js/office-3d.js, ui/public/js/office3d/**, ui/public/js/office-war-screen.js, ui/public/js/office-2d.js, ui/public/js/office2d/**, ui/public/js/office/*.js, ui/public/js/shared/pagination.js, ui/public/js/shared/pagination-prefs.js, tests/shared-pagination.test.js, tests/pagination-prefs.test.js, tests/office-2d-parity.test.js, tests/war-screen-projection.test.js, tests/office-scrum-refresh.test.js, ui/public/js/office-screen*.js, ui/public/js/office-3d-controls.js]
keywords: [office, three.js, 3d, 2.5d, isometric, war-screen, kanban, scrum, avatar, catalog, telemetry]
updated: 2026-11-01
---
# Office HQ Scene

Immersive virtual office (`ui/public/office.html`): 3D Three.js engine, retro 2.5D isometric engine and the war room screen.

| File | Responsibility |
|---|---|
| `ui/public/js/office-3d.js` | Three.js facade that orchestrates the 3D scene, cameras, renderers and avatars. Mixin `ui/public/js/office-3d-controls.js` holds the controls. |
| `ui/public/js/office-war-screen.js` | 1920x1080 tactical panel facade; defaults to orchestration and shows Kanban only on explicit selection (EP-05.06). |
| `ui/public/js/office3d/war-screen/` | War screen submodules: `war-screen-helpers.js`, `war-screen-workflows.js`, `war-screen-tasks.js`, `war-screen-agents.js`, `war-screen-tabs.js`, `war-screen-scrum.js`. |
| `ui/public/js/office3d/war-screen/war-screen-tabs.js` | Physical tabs beside the screen with texture, active highlight, selection by click or `E` (EP-05.06). |
| `ui/public/js/office/war-screen-tabs-model.js` | Orchestration/Kanban tab catalog and preset normalization without replacing current content (EP-05.06). |
| `ui/public/js/office3d/war-screen/war-screen-scrum.js` | Draws active sprint, visible lanes, cards, points and impediments on the canvas (EP-05.06). |
| `ui/public/js/office/war-screen-projection-model.js` | Pure transform of Scrum data into lanes and metrics, with no DOM and no file writes (EP-05.06). |
| `ui/public/js/office-2d.js` | Decoupled retro isometric engine facade with action context, sit/stand and screen focus (EP-03.08). |
| `ui/public/js/office2d/` | 2.5D submodules: `map-objects.js`, `player-controller.js`, `iso-furniture.js`, `iso-scene-renderer.js`, `action-bridge.js`, `iso-object-renderers.js`, `iso-parity-furniture.js`. |
| `ui/public/js/office2d/action-bridge.js` | Translates `seat` and `screen_focus` into isometric scene callbacks without duplicating the dispatcher (EP-03.08). |
| `ui/public/js/office2d/iso-object-renderers.js` | Maps canonical IDs and legacy aliases to isometric drawings (EP-03.08). |
| `ui/public/js/office2d/iso-parity-furniture.js` | Draws workstation, monitor, war screen with current preset and war room chairs (EP-03.08). |
| `ui/public/js/office/office-object-catalog.js` | Single canonical source of 2.5D and 3D objects, FontAwesome icons only, zero emojis, WindowManager binding (EP-03.01). |
| `ui/public/js/office/office-action-dispatcher.js` | Standard contract for 5 action types (`window`, `drawer`, `seat`, `screen_focus`, `custom`), contextual sound, legacy support (EP-03.02). |
| `ui/public/js/office/office-scrum-refresh.js` | Refetches the Scrum every 30 s and when the tab regains focus; fires `dai:scrumChanged` only when `scrumSignature` (sprint, lanes, stories, impediments) changed, so the war screen no longer stays stale. Started by `office-state.js`. |
| `ui/public/js/office/office-agent-state.js` | Canonical catalog of 4 engines and 6 states, validation and change signature for 2.5D and 3D (EP-03.05). |
| `ui/public/js/office/office-agent-telemetry.js` | Maps chat runs, periodic activity and transient states to LEDs, balloons, Avatar3D poses and pad color (EP-03.05). |
| `tests/office-2d-parity.test.js` | 2D coverage of the catalog, canonical IDs, seat/focus actions, player state and limits (EP-03.08). |
| `tests/office-scrum-refresh.test.js` | Signature rules, applied-once refresh, hidden tab, errors and project switch in flight. |
| `tests/war-screen-projection.test.js` | Non-destructive tabs, active sprint, lanes, metrics, structural integration and limits (EP-05.06). |
| `ui/public/js/office/office-cabinet-journal.js` | Paginated file-cabinet journal list for the drawer, with the global page-size preset (`bindPagers`); re-exported by `office-drawer-views.js`. |
| `ui/public/js/shared/pagination.js` | Pure pagination helpers: `DEFAULT_PAGE_SIZE=5`, `PAGE_SIZE_PRESETS=[5,10,25,50]`, `renderPager` with size selector shown when total > 5, `bindPagers` handles size change (save, go to page 1), `pagedHtml` reads from `getPageSize(key)`. Used by Central, cabinet, Scrum, workflows, routines and artifacts. |
| `ui/public/js/shared/pagination-prefs.js` | Global page-size preferences (screen `lists`): hydrates via `loadScreen`, synchronous cache, saves through `patchScreen`, only preset values accepted. |
| `tests/shared-pagination.test.js` | Pager math, keyed pages, size selector, markup (FontAwesome, no emoji), paginated Central, cabinet, Scrum backlog/epics and the `lists` screen sanitizing. |
| `tests/pagination-prefs.test.js` | Hydrate, save and clean page sizes. |
| `ui/public/js/office-screen.js` | Office screen facade; mixins `office-screen-*.js` in the same folder. |
| `ui/public/js/office3d/world-*.js` | World builders; mixins `office3d/war-room-*.js` and `office3d/workspace-*.js`. |

- Lighting of the scene lives in `lighting.md`; HUD, view modes and accessibility live in `hud.md`.
