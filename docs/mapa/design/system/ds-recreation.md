---
domain: design
module: system
feature: ds-recreation
summary: Recreating the Design System from the published HTML (window.DOCS) as editable Atelier components and prototypes.
paths: [tools/import-ds-docs.js, tools/ds-docs/extract.js, tools/ds-docs/components.js, tools/ds-docs/screen-transform.js, tools/ds-docs/patient-flow.js, tools/ds-docs/capture-site.js, tools/ds-docs/docs-site.js, tools/ds-docs/docs-live.js, tools/ds-docs/search-screen.js, tools/ds-docs/showcase.js, tools/ds-docs/writer.js, tools/ds-docs/dc-showcase.js, tools/ds-docs/data/dis-design-system.site.json]
keywords: [design-system, ds, window.DOCS, import, vitrine, patient-flow, showcase, capture, playwright, dc]
updated: 2026-10-30
---
# Design System recreation from published HTML

`dis-design-system.html` carries `window.DOCS` (component source, tokens and screen models); the generator turns it into editable Atelier artifacts.

| File | Responsibility |
|---|---|
| `tools/import-ds-docs.js` | CLI (`--source --project --root --out --assets --site --force --force-protos --dry-run`): writes `ds/tokens.css`, `ds/components.css`, registry components and the two prototypes. |
| `tools/ds-docs/extract.js` | Reads `window.DOCS` from the HTML (JSON closed by braces, respecting strings) and lists the screen models. |
| `tools/ds-docs/components.js` | One registry component per DS item (html, css, props, category, tokens used). |
| `tools/ds-docs/screen-transform.js` | Transforms screen HTML: `data-pid`, `data-component`, `goto:` navigation, data URI images, isolated scripts. |
| `tools/ds-docs/patient-flow.js` | `dis-paciente` prototype: 8 navigable screens, `head.html` (`harnessGoto` bridge, in-memory sessionStorage) and `proto.css`. |
| `tools/ds-docs/capture-site.js` | Playwright capture of the rendered DS site (top bar, menu, CSS, each page with code tabs open); writes `tools/ds-docs/data/dis-design-system.site.json`. |
| `tools/ds-docs/docs-site.js` | `dis-ds-vitrine` prototype as a navigable site: top bar, side menu with `goto:`, one screen per page and code tabs (uses the capture). |
| `tools/ds-docs/docs-live.js` | Header and script that hydrate the vitrine demos with the DS React bundle (cdnjs) in play mode and restore static HTML in the inspector. |
| `tools/ds-docs/search-screen.js` | Search patient screen of the modular flow: form, expected/late tabs, tables with "Show more", filter, click leads to the Overview. |
| `tools/ds-docs/showcase.js` | Simple vitrine (no capture) and `snippetsFor`, which builds the canvas code blocks. |
| `tools/ds-docs/writer.js` | Writes files, converts images to data URI and updates `design/design.json`. |
| `tools/ds-docs/dc-showcase.js` | Builds an editable screen per `.dc.html` DS component, registry manifests, source snippets and component references for related dynamic artifacts. |
| `projects/<slug>/design/ds/components.css` | Aggregated component CSS; the renderer injects it only in prototypes with `metadata.dsComponents: true`. |
| `projects/<slug>/design/prototypes/dis-paciente/` | Editable patient flow (overview, new prescription, medications, deliveries, success, history, programs, notes). |
| `projects/<slug>/design/prototypes/dis-ds-vitrine/` | DS vitrine: each component on its own screen, for use on the canvas. |

- `tools/import-dc-design-system.js` (the `.dc.html` importer, with optional vitrine arguments) is listed in `../atelier-quality/quality-pilot.md`.
