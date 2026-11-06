---
domain: frontend
module: web
feature: app-header
summary: Standard header (brand + nav) shared by every screen, with slots for screen-only items.
paths: [ui/public/js/shared/app-header.js, ui/public/css/app-header.css, ui/public/css/components/08-mobile-declutter.css, ui/public/img/harness-logo.png, ui/public/img/favicon.png, tests/app-header.test.js]
keywords: [header, nav, brand, topbar, slot, layout, standard, hamburger]
updated: 2026-11-06
---
# Standard app header

Every page declares `<header data-app-header data-current="<id>">`; `app-header.js` adds the brand and the nav (home, overview, diario, consumo, deploy, office) and marks the current screen. Screen-only items stay in the HTML as `data-slot="left"` (after the brand) and `data-slot="right"` (after the nav). Adding a screen means one entry in `NAV_ITEMS`.

| File | Responsibility |
|---|---|
| `ui/public/js/shared/app-header.js` | `NAV_ITEMS`, pure `renderBrand`/`renderNav`/`renderMenuToggle`, hamburger wiring, and `mountAppHeader` (self-mounts on load). |
| `ui/public/css/app-header.css` | Only owner of header layout: 761-960px two rows (brand/project/actions, then full-width nav with labels); up to 760px the hamburger panel (not office), icon-only nav with screen-reader labels and 44px targets; office HUD token mapping. |
| `ui/public/css/components/08-mobile-declutter.css` | Home on phones: 3-column sync buttons, engine and group chips as single scrollable rows. |
| `ui/public/img/harness-logo.png`, `ui/public/img/favicon.png` | Harness logo (192 px, header brand) and favicon (64 px) used by every page. |
| `tests/app-header.test.js` | Nav render, hamburger toggle, wiring in the pages, accessible nav labels, 44px targets and no bare `header` CSS rules. |

Exclusive slots: index (project select, Celular, presence strip, Scrum 360, Studio, Conversar), office (HUD, sound, sensitivity, scene prefs, project dropdown, avatar), overview (total badge), deploy (Hostinger badge).
