---
domain: frontend
module: design
feature: props-panel
summary: Atelier properties panel: position/layout, appearance, typography, code tabs, highlight, formatter and matching CSS.
paths: [ui/public/js/modules/prototype-props-*.js, ui/public/js/modules/prototype-code-*.js, ui/server/services/prototype-css-match.service.js, tests/prototype-code-format.test.js, tests/prototype-css-match.test.js, ui/public/js/modules/prototype-props-*.js, ui/public/js/modules/prototype-bridge-props.js]
keywords: [properties, props panel, typography, appearance, code tab, highlight, format, css match]
updated: 2026-10-30
---
# Atelier Properties Panel

| File | Responsibility |
|---|---|
| `ui/public/js/modules/prototype-props-panel.js` | Figma-style panel controller (with prototype-props-view.js and prototype-props-model.js) (align, offset, rotation, size, flex, gap, padding, margin); live preview, saves `px-<pid>` class and `styles/proto.css`. |
| `ui/public/js/modules/prototype-props-style-view.js` | Opacity, radius, fill and stroke colors (DS tokens), border, shadow (`--shadow-*` or custom) and blur; tokens come via `prototype-bridge-props.js`. |
| `ui/public/js/modules/prototype-props-type-model.js` | Pure rules: family (DS tokens), weight, line height, letter spacing and alignment. |
| `ui/public/js/modules/prototype-props-type-view.js` | Typography section: font, size, weight, line, letters, alignment, case, decoration and text color tokens. |
| `ui/public/js/modules/prototype-props-code.js` | CSS, HTML, React and Angular tabs of the selected element with copy; Expand opens a large modal. |
| `ui/public/js/modules/prototype-code-highlight.js` | Light HTML, CSS and JS/TS/JSX highlighting with `tk-*` classes; escapes all code. |
| `ui/public/js/modules/prototype-code-format.js` | `formatHtml` and `formatCss`: 2-space indent, one declaration per line, long tags one attribute per line. |
| `ui/server/services/prototype-css-match.service.js` | Scans `design/ds/components.css` and `styles/proto.css` and returns rules using the element classes (CSS tab). |
| `tests/prototype-code-format.test.js` | Covers CSS/HTML indentation, long tags, `pre`/`style` blocks and idempotence. |
| `tests/prototype-css-match.test.js` | Covers block splitting, class matching without prefix confusion and file joining. |

- Tokens come from the iframe through `prototype-bridge-props.js`, which is not part of this map file.
| `ui/public/js/modules/prototype-props-view.js` | Renders the Position and Layout panel sections from the model. |
| `ui/public/js/modules/prototype-props-model.js` | Pure rules of the panel (no DOM): turns typed values into CSS declarations and reads computed values. |
