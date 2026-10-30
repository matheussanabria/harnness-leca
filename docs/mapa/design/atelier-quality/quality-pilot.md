---
domain: design
module: atelier-quality
feature: quality-pilot
summary: Atelier quality pilot: approval plan, audit, drivers, render review, contrast repair, DC import, quality prompt.
paths: [docs/atelie-pilot/*, docs/atelie-resumo-executivo-plano-aprovacao.md, tools/atelier-pilot/**, tools/ds-docs/*.js, tools/import-dc-design-system.js, ui/public/js/modules/prototype-prompt-quality.js, ui/server/services/atelier-quality.service.js, ui/server/controllers/atelier-quality.controller.js, tests/atelier-*.test.js, tests/ds-dc-import.test.js]
keywords: [atelier, quality, pilot, render-review, contrast, design-system, dc, directions, briefing, baseline]
updated: 2026-10-30
---
# Atelier quality pilot (prototype quality: briefing, direction, render review)

| File | Responsibility |
|---|---|
| `docs/atelie-pilot/05-handoff-pending.md` | Pilot handoff: repository rules, what exists, pitfalls and what is still pending, so another engine can resume. |
| `docs/atelie-pilot/composite-spec-v2.txt` | Composite round spec (v2) used as the briefing input for the composite runs. |
| `tools/atelier-pilot/drivers/baseline-run.js` | Headless baseline: fresh-session prompt to OpenCode, parse, save with history. |
| `tools/atelier-pilot/drivers/compose2-run.js` | Driver for the composite round (v2 spec). |
| `tools/atelier-pilot/drivers/quality-run.js` | Headless run of the quality prompt flow. |
| `tools/atelier-pilot/drivers/revise-run.js` | Targeted revision round: sends code plus render-review findings back and saves a new prototype. |
| `tools/atelier-pilot/drivers/revise-patch.js` | Patch-style variant of the revision round. |
| `docs/atelie-resumo-executivo-plano-aprovacao.md` | Executive summary and approval plan for the pilot (scope, stages 0-4, acceptance criteria, risks). |
| `tools/ds-docs/extract-dc.js` | Reads ".dc.html" Design System files: evaluates the `DOCS = [...]` class field in an empty `vm`, picks a preview, lists classes and tokens. |
| `tools/ds-docs/dc-tokens.js` | Builds `tokens.css` from a palette (reporting missing tokens), the combined `components.css`, and the compact `ds-index.md`. |
| `tools/import-dc-design-system.js` | CLI importing a ".dc.html" Design System plus palette into `projects/<slug>/design/ds/` and `design.json`; exits 2 on missing tokens. |
| `ui/public/js/modules/prototype-prompt-quality.js` | Quality prompt for the Atelier: output rules, brief, Design System section, craft rules, `/directions` mode and client context loader. |
| `ui/server/services/atelier-quality.service.js` | Reads the opt-in flag (`atelier.qualityPrompt` in `profile.json`) and the imported DS; reports `flag-off` or `design-system-missing`. |
| `ui/server/controllers/atelier-quality.controller.js` | `GET /api/project/:slug/design/atelier/quality-context` (route in `design.routes.js`). |
| `tests/atelier-quality-prompt.test.js` | Covers the command parser, rules content, loader, service states and the bridge with the flag on and off. |
| `tools/atelier-pilot/review-checks.js` | In-page render review checks via `page.evaluate`: overflow, contrast, default-blue links, default font, touch targets, structure. |
| `tools/atelier-pilot/render-review.js` | Render review CLI: Edge through `playwright-core` at 360/390/768/1440 px, full-page screenshots, JSON report and severity summary. |
| `tools/atelier-pilot/contrast-fix.js` | Deterministic contrast repair, no model: keeps text polarity, moves text colour first, scopes rules to one `data-pid` by specificity. |
| `tools/atelier-pilot/apply-fix.js` | Applies the contrast repair to a COPY of a prototype, reviews it at four widths and prints fixes, skips and before/after counts. |
| `tests/atelier-contrast-fix.test.js` | WCAG reference ratios, polarity, background ownership, scoping without `!important`, skips and independent recomputation of fixes. |
| `docs/atelie-pilot/04-revision-rounds.md` | Revision rounds: full-file vs CSS patch vs deterministic repair, costs, why model patches failed on the hero button, recommended loop. |
| `tests/atelier-render-review.test.js` | Argument parsing, issue summary and four browser tests; the browser tests skip when Edge is unavailable. |
| `projects/57multimarcas/design/design.json` + `profile.json` | Project-local design catalog and Atelier profile: registers source artifacts, DS components, MCP name and the quality prompt opt-in. |
| `projects/57multimarcas/design/palette-57multimarcas.json` | Complete 57Multimarcas semantic-token palette used by the DC Design System importer. |
| `projects/57multimarcas/design/ds/` | Generated project-local Design System: 50 component HTML/CSS pairs, combined CSS, tokens and compact model-facing index. |
| `projects/57multimarcas/design/prototypes/*-inspecao/` | Generated inspection copies of the two raw ".dc.html" sources (template, logic, helmet, manifest, history, versions). |
| `docs/atelie-pilot/palette-torra-nova.json` | Torra Nova palette: the 26 tokens the DS components read, plus `overrides` CSS replacing source colours hardcoded for another brand. |
| `docs/atelie-pilot/briefing-torra-nova-v2.txt` | Fixed-content briefing for the flow comparison (prices, benefits, FAQ, two-screen flow) so both flows get identical text. |
| `tests/ds-dc-import.test.js` | Covers the reader, required tokens, palette gaps, index and the end-to-end import with a fixture. |
| `docs/atelie-pilot/03-stage1-prompt-runs.md` | Stage 1 spike 2: first quality prompt runs, the 32,000-token output cap, `--variant low`, contract checks and harness traps. |
| `docs/atelie-pilot/02-stage1-design-system-spike.md` | Stage 1 spike: how `Design System v2.dc.html` can be read (50 components, `DOCS` field), prompt budget and proposed extractor. |
| `docs/atelie-pilot/01-stage0-audit.md` | Stage 0: audit of prompt, agents, Design System path, render review and tests, the baseline run and proposed consumption ceiling. |
