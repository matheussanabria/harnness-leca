---
domain: backend
module: atelier
feature: handoff-export
summary: Atelier handoff export: ZIP with prototypes, design system, MCP source and agent guides for another engine.
paths: [ui/server/templates/handoff-preview-server.js, ui/server/services/zip-writer.service.js, ui/server/services/handoff-*.service.js, ui/server/controllers/handoff-export.controller.js, ui/public/js/modules/prototype-export-menu.js, ui/public/css/design/26-prototype-export.css, tests/handoff-bundle.test.js]
keywords: [export, handoff, zip, design system, mcp, atelier, share, bundle, agents]
updated: 2026-11-09
---
# Atelier handoff export

`GET /api/project/:slug/design/export/handoff?protos=<id,id|all>&ds=1&mcp=1` returns a ZIP that another person can open with Claude or any engine to keep prototyping with the same patterns.

| File | Responsibility |
|---|---|
| `ui/server/services/zip-writer.service.js` | Dependency-free ZIP writer (deflate, CRC32, UTF-8 names, rejects `..` and absolute names). |
| `ui/server/services/handoff-collect.service.js` | Walks folders (skips `node_modules`, `.history`, `.scratch`, versions, 5 MB file and 60 MB total caps), lists prototypes, resolves MCP server sources declared in `mcp.json`. |
| `ui/server/services/handoff-docs.service.js` | Generates `README.md`, `AGENTS.md`, `MAPA.md` and `.mcp.json` (relative paths, design system dir pointed at `./design-system`). |
| `ui/server/services/handoff-bundle.service.js` | Assembles the bundle: `prototypes/`, `standalone/`, `design-system/`, `mcp/`, `project/`, guides and `manifest.json`; validates ids and empty selections; with the design system on, it also adds the showcase prototype named in `design/ds/ds-config.json` (`vitrine`). |
| `ui/server/templates/handoff-preview-server.js` | Shipped inside the ZIP as `tools/preview-server.js`: zero-dependency local preview (`npm run preview`, port 4400, `--open`). |
| `ui/server/controllers/handoff-export.controller.js` | Reads query flags, loads project MCP config and design context, streams the ZIP (400 JSON on error). |
| `ui/public/js/modules/prototype-export-menu.js` | Atelier header Export button and options panel, `downloadHandoff` (blob download, toast on error). |
| `ui/public/css/design/26-prototype-export.css` | Styles for the export panel and the catalog export actions (44px targets on touch). |
| `tests/handoff-bundle.test.js` | ZIP round trip, traversal rejection, bundle content, id validation and `.mcp.json` rewriting. |

- The catalog shows a per-card export button and an export-all button in the section title (`prototype-catalog.js`, wired in `prototype-atelier.js`); both export the design system and MCP source too.
