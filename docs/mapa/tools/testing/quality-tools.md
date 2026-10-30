---
domain: tools
module: testing
feature: quality-tools
summary: Regression pipeline, type baseline check and Design System visual audit with their tests.
paths: [scripts/regressao.js, tools/types-baseline.js, ui/server/services/audit/design-system-audit.service.js, ui/public/js/modules/design-audit-ds.js, tests/design-system-audit.test.js, tests/regressao.test.js]
keywords: [regression, regressao, types baseline, design system audit, hardcoded colors]
updated: 2026-10-30
---
# Quality Tools

| File | Responsibility |
|---|---|
| `scripts/regressao.js` | Regression suite and pipeline that stops at the first failure (EP-11.05). |
| `tools/types-baseline.js` | Type baseline check used by the regression pipeline (EP-11.05). |
| `ui/server/services/audit/design-system-audit.service.js` | Design System visual audit: hardcoded colors, emojis and required tokens (EP-11.04). |
| `ui/public/js/modules/design-audit-ds.js` | Client module showing the Design System audit (EP-11.04). |
| `tests/design-system-audit.test.js` | Design System audit service. |
| `tests/regressao.test.js` | Regression pipeline. |
