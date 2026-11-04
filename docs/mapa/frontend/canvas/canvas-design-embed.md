---
domain: frontend
module: canvas
feature: canvas-design-embed
summary: Canvas islands as Design workspace views: loader target mount, design view hooks and the two Design tabs.
paths: [ui/public/js/modules/design-island-views.js]
keywords: [canvas, mindmap, board, design, embedded, island, loader, tabs, ep-19]
updated: 2026-11-04
---
# Canvas islands inside the Design workspace (EP-19)

`canvas-mindmap` and `canvas-board` are Design views (route screens in `ui/public/js/shared/router.js` `VIEW_SCREENS`, tabs in `ui/public/index.html`, registered in `ui/server/services/screen-state/registry.js`). `design.js` renders them through `design-canvas-workspace.js` (three-column workspace inside `#designViewContainer`); any other view or closing the Design unmounts them first. The loader (`island-loader.js`) accepts a target element as third argument of `mount`, passes `embedded: true` and never touches `#islandHost` in that case.

| File | Responsibility |
|---|---|
| `ui/public/js/modules/design-island-views.js` | `isIslandView`, `mountIslandView` (unmounts the previous root, clears the container, mounts with the container as target) and `unmountIslandView`. |
