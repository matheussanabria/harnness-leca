---
domain: office
module: hq
feature: hud
summary: DAI HQ entrypoint, camera controls, view modes, scene preferences, frame loop and accessibility.
paths: [ui/public/js/office-app.js, ui/public/js/office3d/camera-controller.js, ui/public/js/office/view-modes.js, ui/public/js/office/office-view-mode.js, ui/public/js/office/*scene-preferences.js, ui/public/js/office/frame-loop.js, ui/public/css/office/16-view-modes.css, ui/public/css/office/17-accessibility.css, tests/office-*.test.js, ui/public/office.html]
keywords: [hud, controls, camera, view-mode, diorama, accessibility, quality, dpr, frame-loop, no-emoji]
updated: 2026-10-30
---
# Office HQ HUD and Controls

| File | Responsibility |
|---|---|
| `ui/public/js/office-app.js` | Entrypoint of `ui/public/office.html`: boots 3D/2.5D engines, HUD, mouse sensitivity, shortcuts and view switching, with preferences from screen state (EP-14.10). |
| `ui/public/js/office3d/camera-controller.js` | 1st/3rd person camera, calibrated sensitivity (levels 1 to 10) and 1:1 smoothing. |
| `ui/public/js/office/view-modes.js` | Canonical modes `3d`, `diorama` and `2.5d`, legacy aliases, normalization and per-project persistence (EP-03.07). |
| `ui/public/js/office/office-view-mode.js` | Switches engines, keeps last 3D camera, restores project preference, sets `data-office-view` and `aria-pressed` (EP-03.07). |
| `ui/public/css/office/16-view-modes.css` | Visually distinguishes 3D, diorama and 2.5D in the bottom bar, honoring `prefers-reduced-motion` (EP-03.07). |
| `tests/office-view-modes.test.js` | Catalog, aliases, persistence, engine switching, restore and DOM (EP-03.07). |
| `tests/office-no-emoji.test.js` | Scans `office.html`, office JS and `ui/public/css/office` for emojis, requires FontAwesome, enforces 300-line limit (EP-03). |
| `ui/public/js/office/scene-preferences.js` | Pure quality/DPR/motion model, plus controller `office-scene-preferences.js` for `localStorage`, `matchMedia` and live region (EP-03.09). |
| `ui/public/js/office/frame-loop.js` | One `requestAnimationFrame` per engine, pausing on `visibilitychange`, resuming and disposing safely (EP-03.09). |
| `ui/public/css/office/17-accessibility.css` | Visible focus, quality/motion controls, `sr-only` and `prefers-reduced-motion` support (EP-03.09). |
| `tests/office-scene-accessibility.test.js` | Profiles, DPR, storage, controller, FrameLoop, HTML, shortcuts and limits (EP-03.09). |
| `ui/public/office.html` | Page of the DAI HQ immersive office; loaded by `office-app.js`. |
| `ui/public/js/office/office-scene-preferences.js` | Controller that binds native controls and `matchMedia` to the scene preferences model (EP-03.09). |
