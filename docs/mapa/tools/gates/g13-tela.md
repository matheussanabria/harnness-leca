---
domain: tools
module: gates
feature: g13-tela
summary: harness-gates G13 screen check: one medicamento on the rendered DIS screen (registry cells, dynamic fields, layout).
paths: [tools/gates/g13/**, tests/harness-gates-g13.test.js, docs/harness-gates/03-screen-check.md]
keywords: [g13, tela, screen check, oraculo, roteiro, medicamento, cadastro, playwright, chrome, sessao, geometria, pop]
updated: 2026-11-13
---
# G13 screen check

Run `node tools/gates/g13/cli.mjs --roteiro <roteiro.json>` (or `cli.mjs tela` in the packed copy). Needs the app, Chrome and
playwright-core. Format and limits: `docs/harness-gates/03-screen-check.md`. The packed copy ships this folder as `engine/g13`.

| Path | What it does |
|---|---|
| `tools/gates/g13/cli.mjs` | Entry point: `--entrar` saves the sign-in session; otherwise picks the medicamento, fills the test values, reads the screen and compares. Exit 0, 1 (errors) or 2 (setup). |
| `tools/gates/g13/oraculo.mjs` | Pure rules: registry cells and calculation fields expected for one registry record (units, plural, classification order, packaging, no-calculation mode, long stay, no interval). |
| `tools/gates/g13/confere.mjs` | Pure comparisons: registry cells (strict text), dynamic fields and notices, layout against the prototype with tolerances. |
| `tools/gates/g13/sonda.mjs` | Functions that run inside the page and only read: cells, labels, notices, preview, geometry. |
| `tools/gates/g13/navegador.mjs` | The only browser code: loads playwright-core on demand, launches installed Chrome, saves the session outside the repo, captures the registry lookup answers. |
| `tools/gates/g13/passos.mjs` | The interactions: choose the medicamento in the lookup, render and measure the prototype export. |
| `tools/gates/g13/roteiro.mjs` | Reads and validates a roteiro (test script) with clear messages. |
| `tools/gates/g13/relatorio.mjs` | The text a person reads at the end: expected against shown, findings by theme, approved or rejected. |
| `tests/harness-gates-g13.test.js` | CP-G13-01..08: oracle rules, comparisons, roteiro validation, in-page probes in Chrome, packed subcommand. |
| `docs/harness-gates/03-screen-check.md` | What it checks, the roteiro, the session file, the prototype render and the limits. |
