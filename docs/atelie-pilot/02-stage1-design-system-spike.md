# Atelier quality pilot - Stage 1, spike 1: Design System source

Date: 2026-10-24. Read-only spike. No production code changed. Answers decision 4 of `01-stage0-audit.md`.

Source file (outside the repo): `Downloads/Framework de componentes próprio/Design System v2.dc.html` (317,769 bytes, 1,257 lines). Sibling files in that folder: `Codificadores Design System.dc.html`, `57Multimarcas Protótipo.dc.html`, `Portfolio Protótipo.dc.html`, `support.js`, `assets/`, `screenshots/`, `uploads/`.

Legend: **[Fact]** observed by running code or reading the file. **[Estimate]** derived, assumption stated. **[Gap]** not verified.

## 1. Result

**The source can be read. The existing extractor cannot read it as is, but a small second reader is enough.**

| Question | Answer |
|---|---|
| Is there a `window.DOCS`? | [Fact] No. The data is a class field `DOCS = [ ... ]` inside `class Component extends DCLogic`, in a `<script type="text/x-dc" data-dc-script>` block (lines 641-1255). `tools/ds-docs/extract.js` searches for `window.DOCS=` and throws. |
| Does it have the same shape? | [Fact] Yes. Each entry has `id, name, states, desc, html, css, ng, react`, the fields the existing import tooling already works with. |
| How many components? | [Fact] 50 (for example Button, Alert, Accordion, Header, Footer, Table, Form fields, Modal, Tabs, SideNav, Stepper, AppShell, Card, charts). |
| Can the array be read safely? | [Fact] Yes. A bracket-matching slice of 71,330 characters evaluated in an empty `vm` context in 2 s or less, giving 50 entries. The file is the user's own; the evaluation has no globals. |
| Any entry that is not plain text? | [Fact] Two: `piechart` and `barchart`. Their `html/css/ng/react` fields are objects keyed by variant (the `VARS` list: Pizza/Rosca, Vertical/Horizontal), and the literal references `this` for them. The other 48 are strings. |
| Where do the tokens live? | [Fact] Not as a static `:root` block. Two palettes are defined in `PROJ` (`cod` = Codificadores, `m57` = 57Multimarcas) with `main, dark, head, area, surf, muted, bgSoft, accentDark, accentLight`. The `:root` text is assembled from the chosen palette in template strings (lines 1219 and 1240). |
| Semantic token names used by components | [Fact] `--primary-interactive` (27 uses), `--neutral-light`, `--neutral-background`, `--neutral-base`, `--primary-headings`, `--highlight-focus`, `--neutral-muted`, `--neutral-dark`, `--danger-*`, `--warning-base`, `--success-*`, `--primary-dark`, `--primary-background`, `--font-display`, `--font-sans`, `--chart-*`. |
| External dependencies | [Fact] 42 `ext-resource-dependency` entries (PNG documentation images such as colour scales, grid, typography, logos), plus `./support.js`. These illustrate the documentation and are not needed to extract components. |

## 2. Prompt budget

[Estimate] 4 characters per token.

| Content | Characters | Tokens |
|---|---|---|
| Compact index: id, name, states, up to 8 class names per component (50 lines) | 4,283 | about 1,100 |
| `html` + `css` of the 48 string components, all together | 24,390 | about 6,100 |
| Baseline prompt input (measured, Stage 0) | not applicable | 23,474 |

Reading: the index alone is cheap (under 5% of the baseline input). Sending the full HTML and CSS of every component is also affordable, but it grows with the catalog. Recommended shape for Stage 1: always send the index and the token list, and send full markup only for the components the briefing or the plan step selects.

## 3. Proposed extraction design

1. A small reader, `tools/ds-docs/extract-dc.js`, that finds `DOCS = [`, matches brackets with quote and template-string awareness, and evaluates the slice in an empty `vm` context. It returns the same entry shape the existing importer expects.
2. Variant components (`piechart`, `barchart`): keep the default variant as `html/css` and record the variant names, or skip them in the first iteration.
3. Tokens: build `design/ds/tokens.css` from the chosen `PROJ` palette plus the semantic names above. This needs the template at lines 1219 and 1240 read once to copy the exact primitive-to-semantic mapping. [Gap] Not read in this spike.
4. Output goes through the existing importer so the sandbox, catalog and history keep working unchanged: `design/ds/components/<name>/`, `registry.json`, `tokens.css`, `components.css`.
5. A compact index file (`design/ds/ds-index.md`) generated at import time is what the prompt reads.
6. Tests with a small fixture copy of the file shape, not the 318 KB original, so the suite does not depend on a path in `Downloads`.

## 4. Risks and gaps

- [Gap] The Design System file is outside the repo and its path is machine-specific. The import must take the path as an argument, and the generated `design/ds/` is project data (gitignored under `projects/*`), so the source file is not committed.
- [Gap] `ng` and `react` snippets were not inspected. The Atelier renders plain HTML and CSS, so they are not needed for the pilot.
- [Gap] Component quality, accessibility and visual fit of the extracted markup were not evaluated.
- Licence or confidentiality of the file contents was not assessed. The 57Multimarcas palette suggests brand material; the generated prototypes use fictional content, but the Design System itself is real.

## 5. Decisions (2026-10-24)

| # | Decision |
|---|---|
| 1 | Create a new palette for the "Torra Nova" brand instead of using `cod` or `m57`. The Design System components and semantic token names stay; only the palette values change. |
| 2 | Variant charts (`piechart`, `barchart`): skipped in the first iteration. |
| 3 | Render review uses `playwright-core` as an optional dev dependency, driving the installed Microsoft Edge (`channel: "msedge"`). |
| 4 | Commit the spike document. |

The original options, kept for the record:

1. **Palette for the pilot:** Codificadores (`cod`, blue `#4264cd`) or 57Multimarcas (`m57`, red `#e5202e`). The briefing "Torra Nova" is a warm, artisanal coffee brand; neither palette fits it naturally. Options: keep it as a constraint test (the Design System wins, per the plan's premise), or choose a briefing that suits the palette. Recommendation: keep Torra Nova, because the plan states that the project's Design System prevails, and the comparison then measures adherence and identity under a real constraint.
2. **Variant charts:** skip in the first iteration (recommended) or support variants.
