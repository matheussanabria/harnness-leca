---
domain: frontend
module: canvas
feature: canvas-board-island
summary: Excalidraw whiteboard React island (EP-19.04): API client, pure helpers, lazy editor chunk, Design view canvas-board.
paths: [ui/web/src/islands/canvas-board/**, ui/web/src/features/board/**, ui/web/build/excalidraw-assets.ts, tests/board-feature.test.js, tests/board-chat-bridge.test.js, tests/canvas-server-methods.test.js]
keywords: [canvas, board, excalidraw, island, autosave, assets, rev, conflict, export, png, svg, lazy, fonts]
updated: 2026-11-04
---
# Canvas Board Island (story 19.04, old label 16.04)

Design view `#/canvas-board`, shown in the canvas workspace (props `embedded: true`, board in `params[0]` chosen by the side catalog; the navigation links render nothing). Standalone it still lists boards and reads `#/canvas-board/<id>`.
Excalidraw (MIT, 0.18.1) is only imported by `ExcalidrawCanvas.tsx`, reached through `React.lazy`, so the island entry stays small.
Fonts are copied to `dist/excalidraw/fonts` and `window.EXCALIDRAW_ASSET_PATH` points there. Board `data` is `{schema:"excalidraw@1", elements, appState subset, files}`;
images are uploaded as assets and only `{ref:"<sha256>.<ext>", mimeType, created}` is stored, rehydrated on open. SVG is export-only (assets reject SVG uploads).
Server gate: `ui/server.js` allows PUT and DELETE only under `/api/canvas/`, and `ui/server/config.js` `postOk` accepts octet-stream on the asset upload path.

| File | Responsibility |
|---|---|
| `ui/web/src/features/board/types.ts` | Board, summary, asset, manifest and scene types (no Excalidraw imports). |
| `ui/web/src/features/board/api.ts` | Typed fetch client: list, create, get, update (rev), remove, uploadAsset, assetUrl; `BoardApiError` with `isConflict` for 409. |
| `ui/web/src/features/board/sanitize.ts` | appState allowlist; volatile keys (collaborators, selection, scroll) never persisted. |
| `ui/web/src/features/board/assetRefs.ts` | Upload planning, data URL decoding, manifest pruning and ref validation. |
| `ui/web/src/features/board/serialize.ts` | `serializeScene`, `deserializeScene`, 4 MB guard (`assertWithinLimit`), foreign schema refusal. |
| `ui/web/src/features/board/signature.ts` | Cheap id:version signature so selection or scroll does not trigger saves. |
| `ui/web/src/features/board/autosave.ts` | Injectable debounced scheduler: dirty, saving, saved, error, conflict. |
| `ui/web/src/features/board/session.ts` | Save (upload new images, PUT with rev), serialized rename, `rehydrateFiles`. |
| `ui/web/src/features/board/exportName.ts` | Safe download file names. |
| `ui/web/src/islands/canvas-board/main.tsx` | Island entry. |
| `ui/web/src/islands/canvas-board/BoardIsland.tsx` | Picks list or editor from route params. |
| `ui/web/src/islands/canvas-board/BoardList.tsx`, `useBoardList.ts` | List, create, rename, delete with loading, empty and error states. |
| `ui/web/src/islands/canvas-board/BoardEditor.tsx` | Load states, title rename, save status, export buttons, conflict banner. |
| `ui/web/src/islands/canvas-board/useBoardLoad.ts`, `useBoardSave.ts` | Load plus rehydrate; autosave wiring and warnings. |
| `ui/web/src/islands/canvas-board/ExcalidrawCanvas.tsx`, `lazyCanvas.ts` | Lazy Excalidraw wrapper and asset path setup. |
| `ui/web/src/islands/canvas-board/exportActions.ts`, `dataUrl.ts`, `useShellTheme.ts`, `SaveStatus.tsx`, `board.css` | PNG/SVG export, browser helpers, theme follow (prefers-color-scheme), status UI, styles. |
| `ui/web/build/excalidraw-assets.ts` | Vite plugin copying Excalidraw fonts into `dist/excalidraw/fonts`. |
| `tests/board-feature.test.js`, `tests/board-chat-bridge.test.js` | node:test for the pure helpers, API client and session. |
| `tests/canvas-server-methods.test.js` | HTTP gate: PUT, DELETE and binary upload only for the Canvas API. |
| `ui/web/src/islands/canvas-board/nav.tsx` | `BoardNavContext` and `NavLink`: hash links standalone, buttons with internal navigation when embedded in the Design workspace. |
| `ui/web/src/features/board/chatBridge.ts` | Pure helpers of the chat bridge: `boardStatePayload` (summary of the drawing for the prompt), `normalizeBoardBlock` (fence removal, supported Mermaid types only, caps) and `placeBelow` (new diagram below existing content). |
| `ui/web/src/islands/canvas-board/applyMermaid.ts` | Converts Mermaid with `@excalidraw/mermaid-to-excalidraw` (lazy imports) and applies it as ONE undoable Excalidraw step, in replace or append mode. |
| `ui/web/src/islands/canvas-board/useBoardChatBridge.ts` | Hook: publishes `harness:canvas-state` (debounced, `kind: board`) and runs `harness:canvas-apply` blocks in order, with a short note for success or refusal. |
