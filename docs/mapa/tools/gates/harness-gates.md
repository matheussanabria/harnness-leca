---
domain: tools
module: gates
feature: harness-gates
summary: harness-gates (ADR-016): lock-pinned gate engine for any project, plus prototype x code gates G10 and G11.
paths: [tools/gates/**, tests/harness-gates-pack.test.js, tests/harness-gates-fidelidade.test.js, tests/harness-gates-g12.test.js, tests/harness-gates-prototipo.test.js, tests/harness-gates-propose.test.js, docs/harness-gates/**, docs/harness-evolution/03-decisions/ADR-016-harness-gates-prototype-code-fidelity.md]
keywords: [harness-gates, gates, pack, sync, check, lock, packed, fidelidade, G10, G11, pareamento, inventario, prototipo, angular, rastreio, ADR-016]
updated: 2026-11-12
---
# harness-gates

Install and verify in a project: `node tools/gates/pack.mjs pack|sync|check --repo <dir>`. The project then runs
`node tools/harness-gates/cli.mjs [fidelidade]` with no Harness. Decision: ADR-016. Format: `docs/harness-gates/02-pairing-format.md`.
The traceability engine it wraps is mapped in `docs/mapa/tools/rastreio/gate.md`.

| Path | What it does |
|---|---|
| `tools/gates/pack.mjs` | harness-gates installer (ADR-016, slice 1): `pack`, `sync` and `check --repo <dir>` ship the engine into <repo>/tools/harness-gates as a lock-pinned copy; `--config` copies a config once. |
| `tools/gates/packed-cli.mjs` | Entry point of the packed copy (becomes `cli.mjs`): checks integrity (exit 3 if edited), finds `harness-gates.json` or `rastreio.config.json`, runs the engine without the Harness. |
| `tools/gates/prototipo.mjs` | `snapshot` copies a Harness prototype (proto.json and screen HTML, no assets) into the repo with a hash file and registers its relative path in `harness-gates.json`; `check` reports a changed source or an edited copy. Lets the team run G10 without the Harness. |
| `tests/harness-gates-prototipo.test.js` | CP-S4-01..04: copy contents, check on change and on edit, G10 from the repo alone, usage errors. |
| `tools/gates/hash.mjs` | SHA-256 of the packed files with CRLF normalized, lock name and version id; shipped inside the copy. |
| `tools/gates/integridade.mjs` | Compares a packed folder with its lock and lists edited, missing and extra files; shipped inside the copy. |
| `tests/harness-gates-pack.test.js` | CP-S1-01..12: pack layout, packed CLI equal to the Harness CLI, tamper detection, CRLF, sync, behind-version check, refusals, usage errors. |
| `tools/gates/fidelidade/cli.mjs` | G10 and G11 runner (ADR-016, slice 2): reads the config `fidelidade` block and each feature `pareamento.json`, prints findings by level, `--registrar-revisao` stores hashes. Also reachable as `cli.mjs fidelidade` in the packed copy. |
| `tools/gates/fidelidade/html-parse.mjs` | Tolerant HTML parser shared by both adapters: quoted attributes, void tags, Angular `@if/@for` blocks (`cond`), interpolation removed. |
| `tools/gates/fidelidade/adapter-prototipo.mjs` | Inventory of a prototype screen from the DIS HTML (label[for] or ds-info__label, ds-input-wrap, ds-field__row); selectors `#id`, `texto:`, `legend:`, `rotulo:` (read-only info cells). |
| `tools/gates/fidelidade/adapter-angular.mjs` | Inventory from Angular templates: DIS components, raw inputs and buttons, icons resolved from the sibling .ts, widths from the sibling .css. |
| `tools/gates/fidelidade/compara.mjs` | G10 decision: differences between two items against the declared ones (declared, not declared, stale, mismatch, dynamic, presence, confirmed on screen). |
| `tools/gates/fidelidade/g11.mjs` | G11: hash of cited code files against the stored review; records a new review. |
| `tools/gates/fidelidade/g12.mjs` | G12 (slice 3): derives the status of each map field from G10 and checks the typed `ui.st`; manual statuses need `motivo` and `revalidar_em`. `--derivar` writes `status-derivado.json` for the panel. |
| `tests/harness-gates-g12.test.js` | CP-S3-01..06: contradiction, agreement, stale `diverge`, missing motivo/date, expired date, `--derivar` plus panel overlay. |
| `tools/gates/fidelidade/propose.mjs` | `propor`: drafts a pairing screen by matching prototype and code inventories (label+placeholder, label, placeholder, key); lists unmatched and run-time-labelled fields; `--comparar` scores the draft against a hand-made pairing. Also `cli.mjs propor` in the packed copy. |
| `tools/gates/fidelidade/candidatos.mjs` | Lists pairable items on each side (fields, buttons, legends, checkbox labels, headings); prototype chrome is skipped. |
| `tools/gates/fidelidade/propose-score.mjs` | Scores a draft against an existing pairing (right, swapped, missed, extra). |
| `tests/harness-gates-propose.test.js` | CP-P1..6: matching, selectors for titles and checkboxes, no button x field pairs, scoring, packed subcommand, usage errors. |
| `tools/gates/fidelidade/util.mjs` | Icon, text, width and Angular boolean normalization. |
| `tests/harness-gates-fidelidade.test.js` | CP-01..10: undeclared, declared, stale and mismatched differences, presence, icon by .ts, G11 and CRLF, unpaired elements, parser, packed subcommand, bad config. |
| `docs/harness-gates/02-pairing-format.md` | Format of the `fidelidade` config block and of `pareamento.json`, selectors, compared attributes, decision table. |
| `docs/harness-gates/01-execution-plan.md` | Plan for harness-gates (ADR-016): five slices (standalone package, inventory contract and static pilot, derived status, second project, rendered geometry), BDD for G10 and G11, risks. Priority saude-dispensacao, then 57multimarcas. |
| `docs/harness-evolution/03-decisions/ADR-016-harness-gates-prototype-code-fidelity.md` | Decision: Harness owns engine, inventory contract and gate catalog (G10 onward); projects own config; delivery as a lock-pinned copy runnable without the Harness. |
