---
title: harness-gates execution plan
adr: ADR-016
status: proposta
updated: 2026-11-12
---

# harness-gates: execution plan

Decision record: [ADR-016](../harness-evolution/03-decisions/ADR-016-harness-gates-prototype-code-fidelity.md).
Priority: `saude-dispensacao`. Second project: `57multimarcas`.
Route: complete (new files, new contract). Code changes go in worktrees, one branch per slice.

## Slices

| # | Slice | Delivers | Done when |
|---|---|---|---|
| 1 | Standalone package | `tools/gates/` engine wrapping the current `tools/rastreio`; `gates pack` and `gates sync`; `harness-gates.lock`; integrity gate | The dispensacao team runs G6, G7, G9 with `node tools/harness-gates/cli.mjs` on a machine without the Harness |
| 2 | Inventory contract and static pilot | Inventory schema; adapters `html-prototipo` and `angular-template`; gates G10, G11; pilot on step 1 of `nova-prescricao` | G10 reports the 2026-11-12 stale items on the pre-fix map and is green on the fixed one |
| 3 | Derived status | G12; the map `st` comes from gate results; `revalidar_em` for manual statuses; panel reads the derived status | A typed `implementado` that contradicts G10 fails the gate |
| 4 | Second project | `gates adopt`; adapter `react-jsx`; config draft for `57multimarcas` in warning mode | `57multimarcas` runs G10 and G11 and the contract needed no breaking change, or the change is recorded |
| 5 | Rendered geometry | Plugin with headless Chrome; G13 at 1024, 768, 375 px; on demand and nightly | G13 confirms the 168 px emission field and the first delivery button on the dispensacao form |

Slices 1 to 3 are the dispensacao critical path. Slice 4 starts only after slice 2, because it validates the
contract. Slice 5 can run in parallel with 3.

## Scope of each slice

### Slice 1
- Move the engine entry point so no code reads `HARNESS_DIR`; paths come from `--config` and `--root`.
- `pack` copies the engine and writes `VERSION` and `harness-gates.lock` (content hash of every packed file).
- Integrity gate: recompute the hash and fail on mismatch with a message that names the edited file.
- `sync` replaces the packed copy by the current Harness version and rewrites the lock.
- Replace `saude/dispensacao/tools/doc-features/rastreio.wrapper.mjs` by the packed CLI (project repo change, needs
  the owner's go-ahead because it lives outside the Harness).
- Golden test: the same repo and config give the same output through the Harness CLI and the packed CLI.

### Slice 2
- Schema `inventario-tela.schema.json`: per screen, a list of fields with `campo`, `rotulo`, `placeholder`, `tipo`,
  `obrigatorio`, `ordem`, `icone`, `acao`, `estado`.
- `html-prototipo`: reads the declared prototypes (`design/design.json`) and the `data-campo` attribute.
  The source HTML is never changed; only a derived inventory is written.
- `angular-template`: reads `.html` templates, resolves `formControlName` and `idExterno`, and follows the DS
  component inputs that carry label, placeholder, icon and required (`ds-text-field`, `busca-typeahead`,
  `pro-datepicker`, `ds-checkbox`, `ds-radio-group`, buttons).
- G10 rules: not declared and different = error; declared and equal = `defasada` (stale); declared and different
  = pass; present on one side only = reported with the side.
- G11: the map stores the hash of each cited file; a changed hash without a new `revisado_em` on the item warns.
- Severity from config; the pilot starts in `aviso`.

### Slice 3
- G12 compares the typed `st` with the G10 result per field and fails on disagreement.
- Manual `st` requires `motivo` and `revalidar_em`; an expired date is reported.
- The panel API returns the derived status next to the stored one.

### Slice 4
- `gates adopt --repo <path>` detects the stack from `package.json` and the source layout, and writes a draft
  `harness-gates.json`.
- `react-jsx` adapter reads JSX props (`label`, `placeholder`, `required`, `name`) and the project component
  library mapping from the config.
- Reports contract gaps found on `57multimarcas` in an addendum to the ADR.

### Slice 5
- Plugin boundary: the engine calls it only when `gates.g13.enabled` is true; Chrome is not a hard dependency.
- Probes computed layout, not pixels: width, height, visible, disabled, icon present, with a tolerance.
- Needs the app in a demo mode with mocked API; the mode is a project responsibility.

## BDD for the pilot (slice 2)

```gherkin
Feature: G10 prototype x code inventory

  CP-01 Undeclared difference fails
    Given the prototype field "Emissao da receita" is 168 px wide and the code field is full width
    And the map has no entry in "diferencas" for it
    When G10 runs
    Then it reports an error naming the field and both values

  CP-02 Declared difference passes
    Given the prototype shows "Voltar" and the code shows "Cancelar" on step 1
    And "diferencas" records the PO decision of 2026-10-13
    When G10 runs
    Then the field passes

  CP-03 Stale declaration is reported
    Given "diferencas" says the first delivery field has no calendar icon
    And the code template renders the icon
    When G10 runs
    Then it reports the item as stale

  CP-04 Field present on one side only
    Given the prototype has "Buscar no e-SUS" and the code has no matching field
    And "diferencas" declares it as so-no-prototipo
    When G10 runs
    Then the field passes and the side is shown as prototype only

  CP-05 Changed cited file without review
    Given a map item cites "origem-receita-form.component.html"
    And the file hash differs from the one stored in the map
    When G11 runs
    Then it warns that the item needs review

  CP-06 Packed copy edited locally
    Given tools/harness-gates was edited after pack
    When the integrity gate runs
    Then it fails and names the edited file
```

## Risks

| Risk | Mitigation |
|---|---|
| DS components hide label or placeholder behind inputs | The adapter reads the component input names from the DS catalog and the config lists unknown components as `a-confirmar`, never as equal |
| Prototype has no `data-campo` today | Slice 2 derives it from the numbered pins and writes a mapping file; the source HTML stays untouched |
| Lock-pinned copies drift between projects | `gates sync --check` in CI lists projects behind the Harness version |
| Gates noisy on day one | Start every gate in `aviso`; promote per project |
| Second project exposes contract gaps | Slice 4 is explicit and records breaking changes before the contract is declared stable |

## Out of scope for now
- Pixel or screenshot comparison.
- Auto-fixing the code or the prototype from a gate result.
- Panel payload splitting (listed separately; ignored for now by decision of the user).

## Status

| Slice | State |
|---|---|
| 1 | Done and merged (2026-11-12). Installed in `saude/dispensacao/tools/harness-gates`. |
| 2 | Done on branch `feat/harness-gates-inventory`: contract, adapters `html-prototipo` and `angular-template`, G10, G11, pilot on step 1 of `nova-prescricao`. Format in `02-pairing-format.md`. Field order is not compared yet. |
| 3 to 5 | Not started. |
