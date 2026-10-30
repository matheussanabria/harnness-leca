---
domain: office
module: hq
feature: lighting
summary: DAI HQ functional lighting presets, manager, DOM target, 3D light rig, styles and tests.
paths: [ui/public/js/office/lighting-presets.js, ui/public/js/office/office-lighting*.js, ui/public/js/office3d/lighting-rig.js, ui/public/css/office/15-lighting.css, tests/office-lighting.test.js]
keywords: [lighting, presets, idle, active, alert, offline, light-rig, prefers-reduced-motion]
updated: 2026-10-30
---
# Office HQ Lighting

| File | Responsibility |
|---|---|
| `ui/public/js/office/lighting-presets.js` | Pure catalog of 5 modes (`idle`, `active`, `attention`, `alert`, `offline`) with 3D lights, CSS variables and state precedence (EP-03.06). |
| `ui/public/js/office/office-lighting.js` | Observable current-mode state, pluggable targets, signature and recalculation from agents (EP-03.06). |
| `ui/public/js/office/office-lighting-dom.js` | Writes `data-office-lighting` and CSS variables to filter the 3D viewport and 2.5D canvas (EP-03.06). |
| `ui/public/js/office3d/lighting-rig.js` | Creates the seven scene lights and applies preset color/intensity without recreating the scene (EP-03.06). |
| `ui/public/css/office/15-lighting.css` | Filters, vignette and transitions of functional lighting, honoring `prefers-reduced-motion` (EP-03.06). |
| `tests/office-lighting.test.js` | Catalog, precedence, manager, DOM target and 3D rig (EP-03.06). |
