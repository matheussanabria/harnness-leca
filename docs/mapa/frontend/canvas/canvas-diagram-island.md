---
domain: frontend
module: canvas
feature: canvas-diagram-island
summary: Mermaid diagram island (EP-21.04): text editor, live preview, autosave with rev, conflict, export, Design tab.
paths: [ui/web/src/islands/canvas-diagram/**, ui/web/src/features/diagram/templates.ts, ui/web/src/features/diagram/preview.ts, ui/web/src/features/diagram/exportPlan.ts, ui/web/src/features/diagram/session.ts, ui/web/src/features/canvas/autosave.ts, ui/public/js/modules/design-canvas-diagram-templates.js, ui/public/js/modules/design-canvas-catalog.js, ui/public/js/modules/design-canvas-api.js, ui/public/js/modules/design-canvas-workspace.js, ui/public/css/design/07-canvas-catalog.css, tests/diagram-editor-*.test.js]
keywords: [canvas, diagram, mermaid, island, preview, autosave, rev, conflict, export, templates, design tab, catalog, race]
updated: 2026-11-23
---
# Canvas Diagram Island (story 21.04)

Design view `#/canvas-diagram`, shown in the canvas workspace (embedded; the side catalog picks the diagram in `params[0]` and its "+" button opens a menu with the six types). The island is the editor only: text on the left, live preview on the right, save status, export. Mermaid is never imported statically; `features/diagram/{render,validate}.ts` load it on first use, so the Design tab costs nothing until the island opens.
The canvas chat mode is OFF for this view until 21.05 (`design-canvas-workspace.js` passes a null chat context for `kind: diagram`): the chat bridge treats every non board kind as a mind map.

| File | Responsibility |
|---|---|
| `ui/web/src/features/diagram/preview.ts` | Preview engine: validate then render; a run overtaken by a newer one resolves `null` (the stale-render race), keeps the last valid render for the dimmed preview and the export. |
| `ui/web/src/features/diagram/exportPlan.ts` | What each export produces (svg, png, mmd, markdown); svg and png use the last valid render and carry a notice when the text has an error. |
| `ui/web/src/features/diagram/session.ts` | Save session: holds the server `rev`, `save`, `rename`, `adopt` (keep my text after a conflict). |
| `ui/web/src/features/diagram/templates.ts` | The six starter templates (ER label quoted). Mirrored by `design-canvas-diagram-templates.js`, parity checked by a test. |
| `ui/web/src/features/canvas/autosave.ts` | Debounced autosave scheduler, shared with the board (`features/board/autosave.ts` re-exports it). |
| `ui/web/src/islands/canvas-diagram/main.tsx`, `DiagramIsland.tsx` | Island entry; empty pane when no diagram is selected. |
| `ui/web/src/islands/canvas-diagram/DiagramEditor.tsx` | Load states, title rename, type pill, error bar, layout. |
| `ui/web/src/islands/canvas-diagram/useDiagramLoad.ts`, `useDiagramSave.ts`, `usePreview.ts` | Load and read the `mermaid@1` payload; autosave and conflict wiring; debounced preview per diagram id. |
| `ui/web/src/islands/canvas-diagram/SourceEditor.tsx`, `PreviewPane.tsx`, `ExportMenu.tsx`, `SaveStatus.tsx`, `diagram.css` | Text with line gutter, preview (dimmed when stale), export menu plus copy Markdown, status and conflict banner, styles. |
| `ui/public/js/modules/design-canvas-diagram-templates.js` | Legacy-shell copy of the templates, starter payload and menu markup for the catalog. |
| `ui/public/js/modules/design-canvas-catalog.js`, `design-canvas-api.js`, `design-canvas-workspace.js` | Catalog kind `diagram` (type menu), `create(kind, title, data)`, workspace view entry. |
| `ui/public/css/design/07-canvas-catalog.css` | Styles of the type menu. |
| `tests/diagram-editor-preview.test.js`, `-export.test.js`, `-session.test.js` | Pure logic with fakes: race, export plan, session rev, templates (CP-03 to CP-05, CP-07 to CP-09). |
| `tests/diagram-editor-wiring.test.js` | Tab registration, catalog and workspace, template parity, lazy Mermaid (CP-07, CP-11, CP-12). |
| `tests/diagram-editor-browser.test.js` | Real Chrome and real server: create, error line, persistence, export, two-tab conflict, theme (CP-01, 02, 05, 06, 08, 10, 12). |
