---
domain: frontend
module: web
feature: presence-strip
summary: Header strip in the main UI showing which engines (Claude, Gemini, OpenCode) are working right now.
paths: [ui/public/js/modules/presence-strip.js, ui/public/css/components/07-presence-strip.css, tests/presence-strip.test.js]
keywords: [presence, engines, active, header, agents-active, live]
updated: 2026-11-02
---
# Presence strip

Read-only strip in the `index.html` header, fed by `GET /api/agents/active` (10 s polling while the tab is visible). A failed read shows n/d for every engine, never idle. `modules/engine-activity-badge.js` is CommonJS (tests only) and cannot be loaded by the browser, so it is not used here.

| File | Responsibility |
|---|---|
| `ui/public/js/modules/presence-strip.js` | Pure renderer (active, idle, unknown per engine) and the mount with polling, abort and teardown. |
| `ui/public/css/components/07-presence-strip.css` | Strip styles: pulse dot for active engines, reduced-motion and narrow-screen rules. |
| `tests/presence-strip.test.js` | Render states, n/d on failure, mount lifecycle and index/boot wiring. |

Mount point: `#presenceStrip` in `ui/public/index.html`, mounted from `ui/public/js/boot.js` after the app loads.
