---
domain: frontend
module: web
feature: diagram-model
summary: Pure Mermaid diagram model (EP-21.03): detection, validation with line, sanitized render, exports, API client.
paths: [ui/web/src/features/diagram/*.ts, ui/web/src/features/canvas/apiBase.ts, tests/diagram-*.test.js]
keywords: [diagram, mermaid, validate, render, sanitize, svg, png, mmd, adr-014, canvas, line, front matter]
updated: 2026-11-22
---
# Diagram model (EP-21.03)

Pure model of the `diagram` Canvas kind (`mermaid@1`, ADR-014). Only `validate.ts` and `render.ts` import `mermaid`, both lazily; `render.ts` is the only one that imports `dompurify`. Mermaid needs a DOM to parse (plain Node fails with `DOMPurify.addHook is not a function`), so the real library is tested in Chrome.

| File | Responsibility |
|---|---|
| `ui/web/src/features/diagram/types.ts` | `DiagramData` (mermaid@1), supported types, themes, 64 KB cap, `Detection` and `ValidationResult`. |
| `ui/web/src/features/diagram/detect.ts` | Type from the header line (skips front matter, blank lines, `%%` comments and directives); refuses mindmap and other families. |
| `ui/web/src/features/diagram/lineMap.ts` | Maps the line Mermaid reports (counted after its cleanup) back to the line the user typed. |
| `ui/web/src/features/diagram/errors.ts` | Short Portuguese messages with source line, token, fragment and expected tokens; size, empty and refusal messages. |
| `ui/web/src/features/diagram/config.ts` | Secure Mermaid config (strict, no html labels), one-time `ensureInitialized`, unique render ids, the `MermaidLike` shape. |
| `ui/web/src/features/diagram/validate.ts` | `createValidator(load)`: size, header, then lazy `mermaid.parse`; never throws. |
| `ui/web/src/features/diagram/render.ts` | `createRenderer(load, loadPurify)`: render to SVG, sanitize with DOMPurify (SVG profile), size from the viewBox, cleanup after failure. |
| `ui/web/src/features/diagram/svg.ts` | SVG helpers: size from the viewBox, standalone file text, data URL. |
| `ui/web/src/features/diagram/exportName.ts` | Safe download names for svg, png, mmd and md. |
| `ui/web/src/features/diagram/exportText.ts` | `.mmd` text and the Markdown block with a fence longer than any backtick run in the source. |
| `ui/web/src/features/diagram/exportRaster.ts` | PNG export through a canvas (browser only), scaled down past 8192 px. |
| `ui/web/src/features/diagram/data.ts` | Builds and reads the stored payload; rejects anything that is not valid mermaid@1. |
| `ui/web/src/features/diagram/api.ts` | Typed client for `kind: "diagram"` boards (list, create, get, update with rev, remove). |
| `ui/web/src/features/canvas/apiBase.ts` | Shared Canvas client plumbing extracted from `board/api.ts`: `BoardApiError`, `failure`, `createCanvasHttp`. |
| `tests/diagram-detect.test.js` | CP-01 to CP-03: header detection and refusals. |
| `tests/diagram-errors.test.js` | CP-04 and CP-05: error messages, the 12 measured line-mapping cases, the 64 KB limit, validator behavior with a fake library. |
| `tests/diagram-export.test.js` | CP-06: export names and texts, SVG helpers, payload, and the server's own kind check. |
| `tests/diagram-api.test.js` | Diagram client and the unchanged board client over the shared base. |
| `tests/diagram-boundary.test.js` | CP-07: where Mermaid and DOMPurify may be imported, secure config in place, 250-line cap, no emoji. |
| `tests/diagram-browser.test.js` | Real Mermaid and DOMPurify in Chrome: CP-04 lines, CP-08 sanitizing and failure cleanup, PNG export. |
