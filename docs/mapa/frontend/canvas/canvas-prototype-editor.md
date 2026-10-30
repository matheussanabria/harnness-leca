---
domain: frontend
module: canvas
feature: canvas-prototype-editor
summary: Prototype editing panel, bridge scripts, layer drag, style/reorder services and prototype deletion.
paths: [ui/public/js/modules/prototype-*.js, ui/server/services/prototype-*.service.js, tests/prototype-*.test.js]
keywords: [prototype, delete, bridge, props, layers, style, reorder, trash]
updated: 2026-10-30
---
# Prototype Editor, Panel and Deletion

| File | Responsibility |
|---|---|
| `ui/server/services/prototype-delete.service.js` | `deletePrototype`: moves the folder to `design/prototypes/.trash/<id>-<timestamp>` and removes the `design/design.json` entry; artifact entries leave only the index. |
| `tests/prototype-delete.test.js` | Covers recoverable trash, design.json removal keeping the rest, artifact-only entries, folders without entry and invalid ids. |
| `ui/public/js/modules/prototype-delete-model.js` | Confirmation text, next item to open after deleting and route URL; no DOM. |
| `ui/public/js/modules/prototype-delete-dialog.js` | Own confirmation modal (Esc/Cancel/Delete), calls `POST .../prototypes/:id/delete` and fires `harness:design-index-changed`. |
| `tests/prototype-delete-model.test.js` | Covers text, next-item choice and URL. |
| `tests/dev-script.test.js` | Ensures `npm run ui:dev` and `ui:dev:remote` use `node --watch` (no dependency) and watch only existing server folders. |
| `tests/prototype-code-highlight.test.js` | Covers syntax highlight colors and escaping. |
| `ui/public/js/modules/prototype-props-code-model.js` | Pure rules for code tab: tabs, text per tab and component/file lines. |
| `tests/prototype-props-code.test.js` | Covers `pickCode` and `fileLines`. |
| `tests/prototype-props-type.test.js` | Covers the typography model. |
| `ui/public/js/modules/prototype-edit-api.js` | Queued call to `edit/apply` (setStyles and moveTo) used by the panel, canvas drag and layer tree. |
| `ui/public/js/modules/prototype-layer-drag.js` | Drag and drop in the layer tree: reorders before, after or inside the target layer. |
| `ui/public/js/modules/prototype-bridge-props.js`, `ui/public/js/modules/prototype-bridge-drag.js` | Iframe scripts: read measures and `px-*` rule, preview styles, drag elements on canvas with snap line (`HARNESS_PROTO_REORDER`). |
| `ui/public/js/modules/prototype-bridge-multi.js` | Iframe script (uses `window.__harnessBridge`): multi-select outline, Shift/Ctrl click, Esc and Ctrl+Z/Y/G, Delete, Ctrl+D shortcuts sent to parent; split for the 250-line limit. |
| `ui/server/services/prototype-style.service.js` | Validates allowed properties, creates the `px-<pid>` class, writes the rule to the proto stylesheet and removes conflicting inline style. |
| `ui/server/services/prototype-reorder.service.js` | Moves a node by `data-pid` before, after or inside another, never into itself. |
| `tests/prototype-style.test.js`, `tests/prototype-props-model.test.js`, `tests/prototype-bridge-scripts.test.js` | Styles, reorder with undo, panel rules and bridge script order/limits. |
