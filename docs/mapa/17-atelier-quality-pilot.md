## 17. Atelier quality pilot (prototype quality: briefing, direction, render review)

| Caminho | Responsabilidade |
|---|---|
| `docs/atelie-resumo-executivo-plano-aprovacao.md` | Executive summary and approval plan for the Atelier quality pilot (scope, stages 0-4, acceptance criteria, risks). |
| `tools/ds-docs/extract-dc.js` | Reader for ".dc.html" Design System files: finds the `DOCS = [...]` class field, evaluates it in an empty `vm` context, splits variant components, lists class names and the tokens each component needs from the project. |
| `tools/ds-docs/dc-tokens.js` | Builds `tokens.css` from a project palette (reporting missing tokens), the concatenated `components.css`, and the compact `ds-index.md` the prompt reads. |
| `tools/import-dc-design-system.js` | CLI: imports a ".dc.html" Design System plus a palette into `projects/<slug>/design/ds/`; exit code 2 when the palette misses tokens. |
| `ui/public/js/modules/prototype-prompt-quality.js` | Quality prompt for the Atelier: English output rules, brief, Design System section, craft rules, the `/directions` mode (two first-fold alternatives) and the client loader for the quality context. |
| `ui/server/services/atelier-quality.service.js` | Reads the opt-in flag (`design/profile.json` → `atelier.qualityPrompt: true`) and the imported Design System (`ds-index.md`, `tokens.css`); reports `flag-off` or `design-system-missing` instead of falling back silently. |
| `ui/server/controllers/atelier-quality.controller.js` | `GET /api/project/:slug/design/atelier/quality-context` (route in `design.routes.js`). |
| `tests/atelier-quality-prompt.test.js` | Covers the command parser, rules content, loader, service states and the bridge with the flag on and off (legacy prompt unchanged). |
| `tools/atelier-pilot/review-checks.js` | In-page checks for the render review (self-contained, runs through `page.evaluate`): sideways overflow, text contrast on the real background, default-blue links, default font, touch targets, structure. |
| `tools/atelier-pilot/render-review.js` | Render review CLI: drives the installed Edge through `playwright-core` at 360/390/768/1440 px, writes full-page screenshots and a JSON report, and summarises issues by severity. Fails with a clear message when Edge or the package is missing. |
| `tests/atelier-render-review.test.js` | Argument parsing, issue summary, and four browser tests (clean page, overflow only at narrow width, contrast on a real background, default link/font/touch target); the browser tests skip when Edge is unavailable. |
| `docs/atelie-pilot/palette-torra-nova.json` | Torra Nova palette: the 26 tokens the Design System components read (warm roast tones, teal focus accent). |
| `tests/ds-dc-import.test.js` | Covers the reader (brackets and quotes in strings, variants, empty context), required tokens, palette gaps, index and the end-to-end import with a fixture. |
| `docs/atelie-pilot/03-stage1-prompt-runs.md` | Stage 1 spike 2: first runs of the quality prompt (valid and invalid), the 32,000-token output cap and `--variant low`, contract checks per model, harness traps and cleanup. |
| `docs/atelie-pilot/02-stage1-design-system-spike.md` | Stage 1 spike: how the external `Design System v2.dc.html` can be read (50 components, `DOCS` class field), prompt budget and proposed extractor. |
| `docs/atelie-pilot/01-stage0-audit.md` | Stage 0: audit of the current prompt, agents, Design System path, render review and tests, the baseline run (tokens, time, files) and the proposed consumption ceiling. |
