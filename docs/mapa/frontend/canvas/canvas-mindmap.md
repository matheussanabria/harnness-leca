---
domain: frontend
module: canvas
feature: canvas-mindmap
summary: Mind-map React island (EP-19.03): pure tree model, commands, history, d3 layout, API client, autosave and editor UI.
paths: [ui/web/src/features/mindmap/*.ts, ui/web/src/islands/canvas-mindmap/*, tests/mindmap-*.test.js]
keywords: [mindmap, canvas, react, react-flow, d3-hierarchy, undo, autosave, island, ep-19]
updated: 2026-11-04
---
# Mind-map island (EP-19.03)

Design view `#/canvas-mindmap`, shown in the canvas workspace (props `embedded: true`, board in `params[0]` chosen by the side catalog, no list or back button). Standalone it still lists boards and reads `#/canvas-mindmap/<boardId>`. Boards use the Canvas REST API (kind `mindmap`, `data.schema = "mindmap@1"`).

| File | Responsibility |
|---|---|
| `ui/web/src/features/mindmap/types.ts` | Node, tree and board-data types; the tree is independent of any graphic ids. |
| `ui/web/src/features/mindmap/tree.ts` | Read-only tree helpers (lookup, parent, descendants, visible nodes). |
| `ui/web/src/features/mindmap/commands.ts` | Pure immutable commands: addChild, addSibling, outdent, reparent with cycle guard, deleteSubtree, rename, toggleCollapse, moveNode (manual dx/dy offset, applied to the subtree), resetOffsets. |
| `ui/web/src/features/mindmap/history.ts` | Undo/redo stack capped at 200 entries. |
| `ui/web/src/features/mindmap/serialize.ts` | Converts the tree to and from board `data`, validating untrusted input. |
| `ui/web/src/features/mindmap/layout.ts` | d3-hierarchy tidy-tree layout that hides collapsed subtrees. |
| `ui/web/src/features/mindmap/api.ts` | Typed client for the board endpoints; maps 409 to a conflict error that carries the current rev. |
| `ui/web/src/features/mindmap/useMindEditor.ts` | Hook joining tree state, commands and history. |
| `ui/web/src/features/mindmap/keymap.ts` | Keyboard shortcut table (Enter, Tab, Shift+Tab, Delete, F2, Space, undo, redo). |
| `ui/web/src/features/mindmap/useAutosave.ts` | Debounced save (800 ms) with saved, saving and conflict states. |
| `ui/web/src/islands/canvas-mindmap/main.tsx` | Island entry for the legacy loader. |
| `ui/web/src/islands/canvas-mindmap/MindmapIsland.tsx` | Route-aware root: board list or editor, loading and error states. |
| `ui/web/src/islands/canvas-mindmap/BoardList.tsx` | List, create and delete mind-map boards. |
| `ui/web/src/islands/canvas-mindmap/MindmapEditor.tsx` | Editor shell: toolbar, save status, conflict banner. |
| `ui/web/src/islands/canvas-mindmap/MindmapCanvas.tsx` | React Flow canvas fed by the layout and keymap; the dragged subtree moves together live. |
| `ui/web/src/islands/canvas-mindmap/FocusFollower.tsx` | Pans the canvas to the selected node at the current zoom when it leaves the comfortable area; positions come from the layout props. |
| `ui/web/src/islands/canvas-mindmap/MindNodeView.tsx` | Custom node with inline text editing and collapse toggle. |
| `ui/web/src/features/mindmap/toolbarState.ts` | Pure `toolbarState(doc, selectedId, history)`: which toolbar actions are enabled. |
| `ui/web/src/features/mindmap/useViewActions.ts` | Zoom in/out, fit and center-on-selection through `useReactFlow()`. |
| `ui/web/src/islands/canvas-mindmap/MindToolbar.tsx` | Floating action bar: structure, history, view and reset-positions groups with shortcut tooltips. |
| `ui/web/src/features/mindmap/useCopyStatus.ts` | Timed status message (auto-clears after 2.5 s) for the copy buttons. |
| `ui/web/src/islands/canvas-mindmap/AgentGroup.tsx` | Toolbar group with the Copy as Markdown and Copy as JSON buttons (context pack) and their status. |
| `ui/web/src/islands/canvas-mindmap/ToolbarButton.tsx` | One accessible icon button (title, aria-label, disabled, danger variant). |
| `ui/web/src/islands/canvas-mindmap/mindmap-toolbar.css` | Styles of the action bar. |
| `ui/web/src/islands/canvas-mindmap/mindmap.css` | Island styles. |
| `tests/mindmap-model.test.js`, `tests/mindmap-api.test.js`, `tests/mindmap-position.test.js`, `tests/mindmap-toolbar.test.js` | Model, history, serialization, manual position (dx/dy offsets) and API client tests (Node type stripping). |
