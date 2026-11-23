---
domain: frontend
module: web
feature: launcher
summary: Launcher island at /funcionalidades: features grouped by scope, project picker with Sem projeto, e2e (EP-25.05).
paths: [ui/public/launcher.html, ui/web/src/features/launcher/*.ts, ui/web/src/islands/launcher/*, scripts/e2e-launcher.js, tests/launcher-model.test.js]
keywords: [launcher, funcionalidades, features, manifest, escopo, scope, sem projeto, picker, island, ep-25]
updated: 2026-11-23
---
# Launcher (stories 25.01 and 25.05)

Page `/funcionalidades` (nav item "Recursos") hosts the `launcher` island through the shared loader. The island reads `GET /api/features` with the `X-Harness-Project` header (`none` selects the personal workspace) and groups the manifest by scope. Opening a feature follows its `rota`; for a project it first calls `POST /api/project/active` so legacy pages, which still read `projects/.active`, follow.

| File | Responsibility |
|---|---|
| `ui/public/launcher.html` | Page shell with the shared header (`data-current="launcher"`) and the island root. |
| `ui/web/src/features/launcher/model.ts` | Pure model: grouping by scope, header value, picker options, highlight wrap, card action, stored-project check. |
| `ui/web/src/features/launcher/api.ts` | Typed client: features for a scope, project list, active-project sync; fetch injectable. |
| `ui/web/src/features/launcher/storage.ts` | Remembers the chosen project in localStorage, tolerant of blocked storage. |
| `ui/web/src/islands/launcher/main.tsx` | Island entry for the loader. |
| `ui/web/src/islands/launcher/LauncherIsland.tsx` | Screen: heading, picker, loading, error and groups; Ctrl+K; toast for blocked cards. |
| `ui/web/src/islands/launcher/useLauncher.ts` | State: projects, scope, manifest and retry; drops a remembered project that no longer exists. |
| `ui/web/src/islands/launcher/ScopePicker.tsx` | Combobox and listbox with search, arrows, Enter, Esc, click outside and focus return. |
| `ui/web/src/islands/launcher/FeatureCard.tsx` | Card; blocked cards stay focusable (aria-disabled) with the reason and a link to pick a project. |
| `ui/web/src/islands/launcher/launcher.css` | Styles on the shell variables; warning colour adapts to light and dark; bottom sheet under 600 px. |
| `scripts/e2e-launcher.js` | Headless Edge run of CP-01 to CP-07 with screenshots at 1440, 768 and 390 px (`npm run e2e:launcher`). |
| `tests/launcher-model.test.js` | Model, client and storage unit tests (CP-01, CP-02, CP-04 to CP-06). |

- The manifest, its validator and the route are mapped in `docs/mapa/backend/core/feature-manifest.md`.
- Features with `estado: "planejada"` (Ateliê, mapa mental, quadro livre, diagramas) show "Em breve" until stories 25.06 and 25.10 flip them to `ativa`.
