---
domain: frontend
module: design
feature: atelier
summary: Atelier prototype UI: view, state, context, messages, multi-select, navigation, canvas, layers, layout, catalog.
paths: [ui/public/js/modules/prototype-atelier*.js, ui/public/js/modules/prototype-motion-*.js, ui/public/css/design/41-prototype-motion.css, tests/prototype-motion-player.test.js, ui/public/js/modules/prototype-canvas-mode.js, ui/public/js/modules/prototype-layer-tree.js, ui/public/js/modules/prototype-workspace-layout.js, ui/public/js/modules/prototype-catalog.js, ui/public/js/modules/prototype-multiselect-model.js, ui/public/js/modules/prototype-nav-resolve.js, ui/public/js/modules/prototype-bridge-links.js, ui/public/js/modules/prototype-bridge-flags.js, tests/prototype-bridge-flags.test.js, tests/prototype-nav-wiring.test.js, ui/public/js/modules/prototype-inspector-toggle.js, tests/prototype-atelier-*.test.js, tests/prototype-nav-resolve.test.js, tests/studio-state.test.js, tests/chat-engine-settings.test.js]
keywords: [atelier, motion, player, timeline, prototype, canvas, layers, multiselect, navigation, screens, resolver, iframe, state, adoption, sidebar, catalog]
updated: 2026-11-21
---
# Atelier Prototype UI

| File | Responsibility |
|---|---|
| `ui/public/js/modules/prototype-workspace-layout.js` | Resizable panels (4 areas), drag splitters, collapse and persistence. |
| `ui/public/js/modules/prototype-catalog.js` | Merges local HTML artifacts and editable prototypes, prefers executable inspection over raw `.dc.html`, lists MCP components; cards have delete. |
| `ui/public/js/modules/prototype-atelier-view.js` | Renders the Atelier visual composition; exports screen options and version list reused by the light refresh. |
| `ui/public/js/modules/prototype-atelier-sidebar.js` | Attaches and returns `#studioSidebar` to Studio across re-renders, reapplies collapse, reports whether chat is inside Atelier. |
| `ui/public/js/modules/prototype-atelier.js` | Controller (state and events); light refresh updates screens, version and iframe in place when chat files are applied. |
| `ui/public/js/modules/prototype-atelier-ctx.js` | Shared `ctx` (prototype, screen, node, tree, multi-selection) and `host` (post, reload, details, move, tree), no import cycles. |
| `ui/public/js/modules/prototype-atelier-multi.js` | Layer selection, selection bar, batch group/ungroup/delete/duplicate, Ctrl+Z/Y/G/D and Delete shortcuts. |
| `ui/public/js/modules/prototype-atelier-messages.js` | Handles iframe `HARNESS_PROTO_*` messages (selection, tree, shortcuts, reorder, ready, screen switch). |
| `ui/public/js/modules/prototype-atelier-state.js` | Normalizes, reads and writes the `prototypes` screen (prototype, screen, node, inspector, layout, viewport) and logs actions (EP-14.08). |
| `ui/public/js/modules/prototype-atelier-adoption.js` | Reopens the saved prototype once, reapplies panels and viewport, persists screen, node, inspector and width changes (EP-14.08). |
| `ui/public/js/modules/prototype-atelier-inspector-tabs.js` | Switches Both, Layers and Properties in the Atelier inspector. |
| `ui/public/js/modules/prototype-atelier-canvas.js` | Glue wiring the header Canvas/Start buttons to canvas mode; exposes message routing, `postMessage` and reload. |
| `ui/public/js/modules/prototype-canvas-mode.js` | Canvas mode facade: mounts engine, interactions, toolbar and Play; routes bridge messages by `event.source`. |
| `ui/public/js/modules/prototype-layer-tree.js` | Navigable hierarchical model, node search, expand/collapse and two-way sync with the preview. |
| `ui/public/js/modules/prototype-multiselect-model.js` | Pure rules: Ctrl toggles, Shift ranges, groups only siblings; Ctrl+G groups into a real `<div data-group>`, Ctrl+Shift+G ungroups. |
| `ui/public/js/modules/prototype-nav-resolve.js` | Pure resolver: `goto:orbit`, `screens/orbit.html`, `./screens/orbit.html`, `orbit.html` and `orbit` (dropping `#`/`?`) become a screen ID; reports screen, planned, external or none. |
| `ui/public/js/modules/prototype-inspector-toggle.js` | Inspector button toggles outlines and selection; when off, screens run live (play mode) in single screen and canvas. |
| `tests/prototype-atelier-split.test.js` | Runs multi-select and iframe messages for real with a minimal DOM. |
| `ui/public/js/modules/prototype-bridge-links.js` | Iframe bridge script: a click on `a[href]` that is not `#`, external or `data-action` becomes `HARNESS_PROTO_GOTO { target }`; the parent resolves it with `prototype-nav-resolve.js`. |
| `ui/public/js/modules/prototype-bridge-flags.js` | Iframe bridge script: the layer-tree eye and lock toggle `data-hidden` / `data-locked` on the element and send `HARNESS_PROTO_FLAG`; the Atelier saves it with the `setAttr` edit, and the sandbox CSS hides `[data-hidden="true"]` in preview, Play and export. |
| `tests/prototype-bridge-flags.test.js` | Runs the flags script with a minimal DOM: toggle on and off, message sent, other messages ignored, script listed in the bridge. |
| `tests/prototype-nav-wiring.test.js` | Embedded export runtime vs the ESM resolver, tab buttons, export without emoji, first-screen render fallback and the bridge links script. |
| `tests/prototype-nav-resolve.test.js` | Covers every accepted navigation format, planned screens, external links, anchors/empty and invalid IDs. |
| `tests/studio-state.test.js` | Covers Studio state normalization, patches and restoration. |
| `tests/prototype-atelier-state.test.js` | Covers Atelier state, prototype reopening and field limits in the registry (EP-14.08). |
| `tests/prototype-atelier-chat.test.js` | Covers chat return and reattach even after the node leaves the document. |
| `tests/chat-engine-settings.test.js` | Covers persistence of engine, model and effort in the `chats` screen state. |
| `ui/public/js/modules/prototype-motion-state.js` | Pure motion player state (EP-24.03): ready/time/ended, frame step, time format, screen-reader text, keep-time rule on reload. |
| `ui/public/js/modules/prototype-motion-player.js` | Motion button and transport bar under the preview: shown only after the iframe runtime sends READY, HARNESS_MOTION_* messages, keyboard, persisted `motionOpen`. |
| `ui/public/css/design/41-prototype-motion.css` | Styles of the motion transport bar (same slate tokens as the Atelier buttons). |
| `tests/prototype-motion-player.test.js` | State rules (CP-09, CP-10) and the real modules in Chrome (CP-08, keyboard, ARIA). |
