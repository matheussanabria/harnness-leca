---
domain: tools
module: testing
feature: wm-tests
summary: Tests for the Window Manager, workspaces, station adapter, office catalog and chat execution sync.
paths: [tests/window-manager.test.js, tests/wm-*.test.js, tests/workspace-*.test.js, tests/office-*.test.js, tests/station-adapter*.test.js]
keywords: [tests, window-manager, workspace, focus, taskbar, drag, lifecycle, office]
updated: 2026-10-30
---
# Window Manager Tests

| File | Responsibility |
|---|---|
| `tests/window-manager.test.js` | Unit validation of the catalog, focus, zIndex layers and lifecycle. |
| `tests/wm-bootstrap.test.js` | Covers layout restoration by the bootstrap. |
| `tests/station-adapter-render.test.js` | Covers station rendering. |
| `tests/unsaved-dialog.test.js` | Covers the Save/Discard/Cancel dialog. |
| `tests/workspace-menu.test.js` | Covers the workspace menu. |
| `tests/wm-css-selectors.test.js` | Checks real CSS selectors used by the Window Manager. |
| `tests/wm-structure.test.js` | Checks structural limits of Window Manager files. |
| `tests/workspace-templates.test.js` | Validates workspace templates. |
| `tests/workspace-presets.test.js` | Validates preset CRUD. |
| `tests/workspace-session.test.js` | Validates the composite snapshot. |
| `tests/workspace-persistence.test.js` | Validates isolation and restoration of workspaces. |
| `tests/unsaved-changes.test.js` | Validates blocking of dirty transitions. |
| `tests/station-adapter.test.js` | Validates object mapping, side layout and floating toggle. |
| `tests/focus-manager.test.js` | Unit validation of input detection, window focus and Escape interception. |
| `tests/window-lifecycle.test.js` | Unit validation of minimize, restore, cleanup hooks and preservation. |
| `tests/taskbar.test.js` | Validates item model, click actions (toggle minimize/restore) and close. |
| `tests/drag-resize.test.js` | Unit validation of viewport confinement, drag, resize and double click. |
| `tests/office-object-catalog.test.js` | Validates immutable 2.5D/3D object schema, zero emojis, aliases and WindowManager integration (EP-03.01). |
| `tests/office-action-dispatcher.test.js` | Covers the 5 action types (window, drawer, seat, screen_focus, custom), contextual sound, backward compatibility (EP-03.02). |
| `tests/chat-execution-sync.test.js` | Validates canonical lifecycle (`idle`, `streaming`, `waiting_approval`, `cancelled`, `error`), reactive observability, granular cancel. |
