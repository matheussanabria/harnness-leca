---
domain: frontend
module: web
feature: app-header
summary: Standard header (brand + nav) shared by every screen, with slots for screen-only items.
paths: [ui/public/js/shared/app-header.js, ui/public/css/app-header.css, tests/app-header.test.js]
keywords: [header, nav, brand, topbar, slot, layout, standard]
updated: 2026-11-06
---
# Standard app header

Every page declares `<header data-app-header data-current="<id>">`; `app-header.js` adds the brand and the nav (home, overview, diario, consumo, deploy, office) and marks the current screen. Screen-only items stay in the HTML as `data-slot="left"` (after the brand) and `data-slot="right"` (after the nav). Adding a screen means one entry in `NAV_ITEMS`.

| File | Responsibility |
|---|---|
| `ui/public/js/shared/app-header.js` | `NAV_ITEMS`, pure `renderBrand`/`renderNav`, and `mountAppHeader` (self-mounts on load). |
| `ui/public/css/app-header.css` | Shared header styles and the only owner of header layout: <=960px two rows (brand/project/actions, then full-width nav), <=760px icon-only nav with screen-reader labels and 44px targets, office HUD token mapping. |
| `tests/app-header.test.js` | Nav render (one current, all links, no emoji) and wiring in the six pages. |

Exclusive slots: index (project select, Celular, presence strip, Scrum 360, Studio, Conversar), office (HUD, sound, sensitivity, scene prefs, project dropdown, avatar), overview (total badge), deploy (Hostinger badge).
