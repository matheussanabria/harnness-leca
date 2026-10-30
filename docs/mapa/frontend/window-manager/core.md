---
domain: frontend
module: window-manager
feature: core
summary: Hybrid Window Manager core - registry, store, facade, bootstrap, focus, lifecycle, taskbar, drag and resize.
paths: [ui/public/js/window-manager/*.js, ui/public/js/types/window-manager.d.ts, ui/public/css/office/12-taskbar.css]
keywords: [window-manager, registry, store, zindex, focus, taskbar, drag, resize, lifecycle]
updated: 2026-10-30
---
# Window Manager Core

| File | Responsibility |
|---|---|
| `ui/public/js/types/window-manager.d.ts` | Types and interfaces (`WindowModule`, `WindowInstance`, `WindowState`). |
| `ui/public/js/window-manager/window-registry.js` | Registry of 11 default modules with metadata, titles and FontAwesome icons. |
| `ui/public/js/window-manager/window-store.js` | Reactive store of open windows, zIndex, singleton vs multi-instance and listeners. |
| `ui/public/js/window-manager/window-manager.js` | Public facade of the Window Manager (`open`, `close`, `focus`, `minimize`, `maximize`). |
| `ui/public/js/window-manager/wm-bootstrap.js` | Creates `LayoutPersistenceManager` and `ResponsiveLayoutManager`, restores project layout, debounced saves. |
| `ui/public/js/window-manager/window-store-focus.js` | Picks the visible top window; split out to keep `window-store.js` under the line limit. |
| `ui/public/js/window-manager/window-store-instance.js` | Builds window instances; split out to keep `window-store.js` under the line limit. |
| `ui/public/js/window-manager/focus-manager.js` | Focus rules, WASD/arrow movement blocking, zIndex layers and Escape key. |
| `ui/public/js/window-manager/window-lifecycle.js` | Close cleanup hooks, memory release and transient state preservation. |
| `ui/public/js/window-manager/taskbar.js` | Taskbar component with focus control, minimize toggle and close. |
| `ui/public/js/window-manager/drag-resize.js` | Viewport-confined bounds, header drag and resize handle. |
| `ui/public/css/office/12-taskbar.css` | Dark glassmorphism style for active and minimized windows with FontAwesome. |

- Office-side wiring (controller, workspace menu, station adapter) lives in `windows.md`.
- Tests for these modules live in `tests-wm.md`.
