---
domain: tools
module: coverage
feature: scripts-quality
summary: Repository syntax and JSDoc type-check commands.
paths: [scripts/check.js, scripts/types.js]
keywords: [scripts, check, types, quality]
updated: 2026-11-16
---
# Scripts Quality Checks / Verificações de Qualidade

| File | Responsibility |
|---|---|
| `scripts/check.js` | Runs dependency-free repository JavaScript and JSON validity checks. / Verifica sintaxe JavaScript e JSON sem dependências. |
| `scripts/types.js` | Runs cached JSDoc TypeScript checks using a temporary tool install. / Executa checagens TypeScript de JSDoc com ferramentas em cache temporário. |
