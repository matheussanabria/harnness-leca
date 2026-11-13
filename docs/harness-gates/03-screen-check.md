---
title: harness-gates screen check (G13, command "tela")
adr: ADR-016
status: aceita
updated: 2026-11-13
---

# Screen check: one medicamento on the rendered screen

`tela` opens the running app, picks one medicamento and checks the DIS "etapa 2" screen in three ways. It needs a
running app, Chrome and `playwright-core`; it never changes data (the screen only calculates a preview).

```
node tools/harness-gates/cli.mjs tela --roteiro doc/pops/roteiros/<roteiro>.json --entrar     # once: sign in, session saved
node tools/harness-gates/cli.mjs tela --roteiro doc/pops/roteiros/<roteiro>.json [--medicamento <nome>] [--saida <arquivo>]
```
In the Harness: `node tools/gates/g13/cli.mjs ...` (same options). Exit: 0 ok, 1 errors found, 2 bad usage or setup.

## What it checks
| Check | Source of truth | Level |
|---|---|---|
| Registry cells (Disp. máx. mensal, Validade máx., Modo de entrega, Intervalo entre retiradas) | The registry record the screen itself received (`GET /api/medicamentos`), restated in `oraculo.mjs` | erro |
| Dynamic fields: which calculation fields appear, their labels, the notices | Rules for that medicamento in `oraculo.mjs` (packaging, no-calculation mode, long stay, no interval) | erro |
| Layout: width, height, visible, disabled, rendered label at 1024, 768 and 375 px | The prototype, rendered from the offline export `prototipo.html` | aviso |

Estoque is shown but not asserted: it comes from another endpoint. Text is compared strictly (accents and case count).
A field the oracle says does not apply to the medicamento is skipped in the layout check (`quando` in the roteiro).

## Roteiro
A JSON file per test case; the format is documented in `tools/gates/g13/roteiro.mjs`. `caso.medicamento` is the name or
code to type in the lookup; `caso.valores` are the test values typed in the calculation fields (by `formControlName`).
`itens` pairs prototype selectors with code keys, like `pareamento.json`.

## Session
`--entrar` opens Chrome; the person signs in (the tool never types credentials) and the session is saved to
`~/.harness-gates/sessao-<nome>.json`, outside any repository. Treat that file like a password: do not copy or commit it.
It lasts as long as the single sign-on keeps the session; sign in again when it expires.

## Prototype render
`node tools/gates/prototipo.mjs snapshot ... --exportar <Harness project dir>` also writes `prototipo.html`
(styles and fonts embedded). Only the Harness can build it; the team then runs the check without the Harness.

## Limits
The person opens the screen (patient, etapa 1, etapa 2); automated navigation to etapa 2 is not built. One medicamento
per run. The oracle restates the display rules of the screen: when the screen changes on purpose, change `oraculo.mjs` in
the Harness and sync the package.
