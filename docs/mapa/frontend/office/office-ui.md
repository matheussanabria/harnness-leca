---
domain: frontend
module: office
feature: office-ui
summary: Window Manager modules and the 2.5D isometric office (object catalog, engine) in the frontend.
paths: [ui/public/js/window-manager/*.js, ui/public/js/office/*.js, ui/public/js/office/catalog/*.data.js, ui/public/js/office-2d.js, ui/public/js/types/window-manager.d.ts]
keywords: [window-manager, office, isometric, taskbar, docking, workspace, focus]
updated: 2026-10-30
---
# Window Manager and Office UI

| File | Responsibility |
|---|---|
| `ui/public/js/window-manager/docking-manager.js` | Pure layout functions, docking in screen zones, snap detection and tab group manager. |
| `ui/public/js/window-manager/layout-persistence.js` | Versioned serialization, `resourceId`, validation, confinement and canonical apply with ID remapping. |
| `ui/public/js/window-manager/responsive-layout.js` | Breakpoint resolution (mobile/tablet/desktop), adaptive fullscreen and reactive sync. |
| `ui/public/js/window-manager/workspace-presets.js` | Compatible facade and CRUD of custom workspaces per project. |
| `ui/public/js/window-manager/workspace-templates.js` | Immutable catalog of Development, Planning, Quality and Operations, with compatible legacy IDs. |
| `ui/public/js/window-manager/workspace-session.js` | Links named layouts to the central project, tracks the active workspace and publishes observable snapshots without DOM. |
| `ui/public/js/window-manager/workspace-persistence.js` | Persists a versioned envelope of layout, filters and resources per project and rejects corruption before touching the store. |
