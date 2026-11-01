# Harness Leca: office features with no main UI screen (read-only inventory)

I compared office code (`office-state.js`, `office/`, `office3d/`, `office2d/`, drawer views) against `index.html`, `app.js`, `overview.js`, `design*.js` and `modules/`. I did not edit any code. "Main UI" here means `/` (index) plus the linked pages `/overview`, `/diario` and `/deploy`.

| Feature | Office file | Data source / API | Main UI equivalent | Recommendation |
|---|---|---|---|---|
| **Usage / Consumo panel (telemetry)** | `office3d/orchestration/tab-usage.js` → `modules/usage-panel.js` | `GET /api/project/:slug/usage/summary` (30 s polling) | **No.** `mountUsagePanel` is only mounted inside the office | **Add page** (or a Design tab) |
| **Central de Sessões (sessions telemetry)** | `office-orchestration-panel.js` → `modules/central-sessions.js` | `/api/project/:slug/sessions/stream` (SSE) + Central read model | **No.** `mountCentral` is only imported by the office panel | **Add page** |
| Orchestration overview (integration status, latency, proven executions) | `office3d/orchestration/tab-overview.js`, `office/office-engine-summary.js` | `/api/orchestration/stream` (SSE `state`) | No | Add tab (inside the new telemetry page) |
| SSE event timeline (last 100 events) | `office3d/orchestration/tab-timeline.js` | `/api/orchestration/stream` (SSE `event`) | No | Add tab |
| Execution / agent detail views | `tab-overview.js` (`renderExecutionDetails`, `renderAgentDetails`) | orchestration stream | No | Add tab, as a detail pane |
| Operations: sync project, run extraction routine | `office3d/orchestration/tab-control.js`, `office-state.js` | `POST /api/orchestration/operations` | Partial. `overview.js` can sync (`/api/project/:slug/sync`, `/api/sync`); the extraction trigger is office-only | Add tab, or a button in Overview |
| Capabilities / disabled-ops audit | `tab-control.js`, `office-state.js` | `GET /api/orchestration/capabilities` | No | Add tab; low priority |
| Per-engine live presence (LEDs, poses, working/idle) | `office/office-agent-telemetry.js`, `office-telemetry-source.js`, `office-projection-client.js` | `/api/project/:slug/projections` + `sessions/stream`; fallback `/api/agents/active` (10 s polling) | Partial. `modules/engine-activity-badge.js` exists, but I found no file that imports it | Add a status strip in the index header |
| Agent desk dossier (engine activity, recent sessions) | `office/office-desk-dossier.js`, `office-engine-activity-format.js` | projections, journal, `/api/engines` | Partial. Chat list with engine filter in `index.html` | Add tab (engine profile) |
| Desk chat (quick prompt to one engine) | `office/office-desk-interaction.js` | `POST /api/chat` (streaming) | Yes. `modules/chat.js` / "Conversar com o Projeto" | No need |
| Saved-chat window | `office/office-chat-window.js` | Chat Center | Yes. `modules/chat.js` | No need |
| File cabinet journal | `office/office-cabinet-journal.js` | `/api/project/:slug/journal` | Yes. `/diario` (`modules/diario-page.js`) | No need |
| Whiteboard (memory + instructions) | `office-drawer-views.js` (`whiteboard`) | `/api/project/:slug` | Yes. `projects-load.js`, `projects-sync.js` dialog | No need |
| Datacenter / deploy status | `office/office-datacenter-status.js` | `GET /api/deploy/status` | Yes. `/deploy` (`deploy/deploy-status.js`) | No need; maybe a status chip on index |
| War screen: Scrum projection | `office3d/war-screen/war-screen-scrum.js`, `office/war-screen-projection-model.js` | `/api/project/:slug/scrum` | Yes. Design tab `scrum` | No need |
| War screen: agents column | `war-screen-agents.js` | `/api/agents/active` + orchestration state | No | Covered by the presence strip |
| War screen: tasks/workflows columns | `war-screen-tasks.js`, `war-screen-workflows.js` | projectData, journal, **plus hardcoded items** (`TASK-BG01`, `TASK-BG02`, `extrair-pendentes.md`) | Partial. Design tabs `workflows` / `routines` | No need; the fake data is a separate issue (see Q1) |
| HUD: project progress %, task count, activity feed | `office/office-hud-controller.js` | projectData / scrum / events | Partial. `/overview` gives a per-project summary | Add a small card to Overview |
| Functional lighting (idle/active/attention/alert/offline) | `office/lighting-presets.js`, `office-lighting*.js`, `office3d/lighting-rig.js` | Worked out from agent state | No (it is a visual mirror of the system's state) | No need. Optionally reuse the state as a global status dot |
| Workspace menu (templates, custom layouts) | `office/workspace-menu.js`, `window-manager/workspace-*.js` | screen-state `office` (windowLayout, workspaces) | No | No need (the windowing exists only in the office) |
| Taskbar | `window-manager/taskbar.js`, `office-app.js` | Window store | No | No need |
| View modes, scene quality, shortcuts, audio, camera | `office/view-modes.js`, `scene-preferences.js`, `office-shortcuts.js`, `office-audio.js` | localStorage / screen-state | No | No need (only matters inside the scene) |
| 3D browser monitor | `office3d/browser-screen.js` | Loads `/` inside the scene | n/a | No need |
| Coffee bar, sofa | `office-drawer-views.js` | Chat count only | n/a | No need (decorative) |

## Top 8 gaps, highest priority first
1. **Usage / Consumo panel.** The only screen that shows token usage and cost (by day, model, session, main vs subagent) is buried in an office drawer tab. It is already modular, so it can be mounted on a new main-UI page.
2. **Central de Sessões.** The canonical sessions list and Kanban (merged projection, live SSE) has no route in the main UI.
3. **Orchestration overview.** Integration status, latency and proven executions are office-only.
4. **Live engine presence in index.** There is no live "who is working" indicator in the main UI. `engine-activity-badge.js` looks unused (I didn't confirm this).
5. **SSE event timeline and execution detail.** Without these there is no audit or debug view of orchestration events outside the office.
6. **Operations trigger for the extraction routine.** `POST /api/orchestration/operations` can only be reached from the office.
7. **HUD project progress and activity feed.** These could become a small card in `/overview`.
8. **Capabilities audit.** Low value, but it is the only place that explains why cancel and pause are unavailable.

Items 1, 2, 3 and 5 could share one new page (for example "Telemetria" / "Orquestração") whose tabs reuse the existing `office3d/orchestration/tab-*.js` renderers. Those renderers currently mix inline styles with HTML and would need light refactoring first.

## Open questions
1. Should the hardcoded war-screen items (`TASK-BG01/02`, `extrair-pendentes.md`) be removed? They break the "no fictitious data" rule shown elsewhere in the office.
2. Where should usage go: a new top-level page (`/consumo`), a Design tab, or a section of `/overview`? Should it be per project only, or also cover all projects?
3. Should the Central de Sessões stay one per project, or also have a view across all projects?
4. Is `engine-activity-badge.js` (CommonJS `require`) dead code, or used by a built island in `ui/web/`? I didn't check `ui/web/`.
5. Should operations triggered from a new main-UI page go through the same unsaved-changes guard and confirm dialog (`shared/confirm-dialog.js`)?
6. Is the office meant to stay a "visual mirror" with the main UI as the source of every function? If so, the office should keep no exclusive features.
