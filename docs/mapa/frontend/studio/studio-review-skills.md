---
domain: frontend
module: studio
feature: studio-review-skills
summary: Vibecoding Studio layout, views, state and code editor, plus memory review and skills manager modules.
paths: [ui/public/js/modules/studio*.js, ui/public/js/modules/design-view-state.js, ui/public/js/modules/review.js, ui/public/js/modules/skills*.js, ui/public/css/studio/05-source-editor.css, tests/studio-wiring.test.js]
keywords: [studio, preview, splitter, source-editor, design-view, review, memory, skills]
updated: 2026-10-30
---
# Studio, Review and Skills

| File | Responsibility |
|---|---|
| `ui/public/js/modules/studio.js` | Vibecoding Studio: app live preview, iframe with HMR, viewport switcher, mobile connection. Split into `studio-*.js`; `studio-store.js` holds shared state. |
| `ui/public/js/modules/studio-layout.js` | Pointer Events resizer with ARIA separator, keyboard, double-click reset (440px), per-project persistence. |
| `tests/studio-wiring.test.js` | Ensures runtime uses the `studio-layout.js` resizer, Design buttons in canvas and mobile drawer, Design workspace style (EP-06). |
| `ui/public/js/modules/studio-source.js` | Code editor: manual edit, language highlighting, line numbers, Ctrl+S, pending-change guard, `windowManager.unsaved`, hot-reload. |
| `ui/public/js/modules/studio-source-tree.js` | Collapsible directory tree for the Studio code editor. |
| `ui/public/js/modules/studio-source-highlight.js` | Per-language syntax highlighting for the Studio code editor. |
| `ui/public/css/studio/05-source-editor.css` | Styles for the Studio source editor. |
| `ui/public/js/modules/studio-views.js` | Switches Preview, Atelier and 2 Screens (Code opens as third column), normalizes aliases, lazy mount, per-project persistence, unsaved-code confirm. |
| `ui/public/js/modules/studio-state.js` | Normalizes and persists the `studio` screen (view, sidebar, code, viewport, Design view) and logs actions (EP-14.08, EP-14.12). |
| `ui/public/js/modules/design-view-state.js` | Reads `studio.designView/designOpen`, restores the Design tab at boot and saves view/open changes (EP-14.12). |
| `ui/public/js/modules/studio-adoption.js` | Reapplies saved Studio state to the DOM when opening the mode, idempotent per project (EP-14.08). |
| `ui/public/js/modules/studio-source-column.js` | Third column (chat, preview, code): toggle by Code button, drag resize, per-project width and state. |
| `ui/public/js/modules/review.js` | Memory review dialog: suggestions, promotion to `memory.md`, edit and discard. |
| `ui/public/js/modules/skills.js` | `.agents/skills` CRUD, `references/` viewer, DAI catalog and import. Split into `skills-*.js`; `skills-store.js` holds shared state. |
| `ui/public/js/modules/skills-state.js` | Hydrates and saves tab, filter and import source of skills on the `chats` screen (EP-14.12). |
