---
id: ADR-016
titulo: harness-gates, automated prototype x code fidelity gates owned by the Harness and runnable without it
status: proposta
data: 2026-11-12
historias: []
tags: [harness-evolution, adr, harness-gates, rastreio, prototype, traceability]
---

# ADR-016: harness-gates, prototype x code fidelity gates

## Context

The layers map (`doc/sistema/features/<slug>/mapa-camadas.json`) records, per screen field, whether the code
matches the prototype (`implementado`, `diverge`, `so-no-prototipo`, ...). Those statuses are typed by hand.
On 2026-11-12 the `nova-prescricao` map was found stale in five fields (lupa icon, emission width, first delivery
button, responsible block, footer actions) and nothing raised an alert.

What exists today:
- `tools/rastreio` gates G6, G7, G9: map x rules (RN) x tests.
- `tools/audit-layers-drift.js`: map x real code for APIs, DTOs, cited components and tests.
- No gate compares the prototype with the code.

Two coupling problems:
- `saude/dispensacao/tools/doc-features/rastreio.wrapper.mjs` needs `$HARNESS_DIR`, so the team cannot run any gate
  without the Harness. The wrapper is documented as "NOT wired yet".
- The project configuration lives in `projects/<slug>/rastreio.config.json`, inside the Harness, away from the code
  it describes.

A second defect fixed on the same day shows the same pattern: two sources of truth for one screen (the published
canvas HTML and `mapa-camadas.json`) with the stale one winning. Gates must check one declared source.

## Decision

1. **Name and ownership.** The family is called `harness-gates` and lives in `tools/gates/` of the Harness.
   The Harness owns the engine, the inventory contract (schema), the adapter interface and the gate catalog
   (ids G10 onward). A project owns its configuration, prototype, map and the decisions recorded in `diferencas`.
   Existing gates G6, G7 and G9 move under the same engine without a rewrite.

2. **Engine without Harness paths.** Plain Node (`node:*` built-ins plus the already vendored `js-yaml`). No
   Harness path inside the code: everything comes from `--config` and `--root`.

3. **Normalized inventory.** Adapters turn a prototype and a code base into the same JSON per screen
   (`campo`, `rotulo`, `placeholder`, `tipo`, `obrigatorio`, `ordem`, `icone`, `acao`, `estado`). Gates compare
   inventories only and never know the stack. Adapters at the start: `html-prototipo`, `angular-template`;
   next: `react-jsx` (needed by 57multimarcas, React 19). A rendering probe (headless Chrome) is an optional plugin.

4. **Project config inside the project repo.** `harness-gates.json` is versioned next to the code. The Harness
   finds it through the project `repo` field (`mcp.json`). For a repo without it, the Harness keeps a draft copy
   under `projects/<slug>/` until the team adopts it. `gates adopt --repo <path>` detects the stack and writes a draft
   in warning mode, so any repo can be brought into the Harness.

5. **Distribution by lock-pinned copy.** `gates pack --repo <path>` writes `tools/harness-gates/` into the
   project: engine, `VERSION`, and `harness-gates.lock` with a content hash. The team runs
   `node tools/harness-gates/cli.mjs` with no `HARNESS_DIR`. An integrity gate fails when the copy was edited
   locally; engine changes are born only in the Harness and shipped by `gates sync`.

6. **Catalog (initial).**
   | Id | Gate | Kind |
   |---|---|---|
   | G10 | Prototype x code inventory. A difference not declared in `diferencas` is an error. A declared difference the code no longer has is reported as stale. | static |
   | G11 | Hash of the files cited by a map item changed without the item being reviewed. | static |
   | G12 | Field status in the map agrees with G10 (no typed `implementado` against evidence). | static |
   | G13 | Rendered geometry of mapped fields (width, visible, disabled, icon) at 1024, 768 and 375 px. | dynamic, on demand |

7. **Severity is per project, per gate** (`aviso` or `erro`) in `harness-gates.json`. A new gate starts as a
   warning and is promoted when the project is clean.

8. **Derived status.** From G12, the map `st` of a field comes from gate results. A manual status needs a reason
   and a `revalidar_em` date.

9. **Pairing key.** Code side: `formControlName` or `idExterno`. Prototype side: a `data-campo` attribute taken
   from the numbered pins that the prototype already has.

10. **File map as a packed gate (added 2026-11-16).** `tools/gates/mapa/` ships in the pack (`engine/mapa`) and the
    packed CLI gets a `mapa` subcommand: `find`, `check [--estrito]`, `orfaos`, `build [--write]`. It answers
    "which feature owns this file": every covered file has one owner, the most specific `paths` glob wins (CODEOWNERS
    style) and a tie is an error. Project specifics (aliases, repositories, what must be covered, where the entries
    live, size limits) come from a `mapa` block in `harness-gates.json`; the engine knows no project. When the block
    has `fontesStatus`, `check` also compares, file by file, the owner given by the map with the owner given by the
    `fontes_*` globs of each `_status.md`, using the same glob as G6 (`rastreio/util.mjs`), so the map and the
    traceability gates cannot drift apart. Origin: `saude-dispensacao/tools/mapa`, which this replaces.
    Rollout: a warning in the doc-gate first, `--estrito` once the project is clean (it was 533/533 on 2026-11-13).

## Alternatives considered

| Alternative | Pros | Contras |
|---|---|---|
| Keep the wrapper that calls the Harness | No packaging work | The team cannot run gates alone; paths hardcoded to a machine |
| npm package | Standard update flow | No internal registry today; extra release process |
| Git submodule | Single source | Submodule friction; pins to Harness history, not to a released version |
| Gates only in the project repo | Simple for the team | Not reusable; the Harness stops owning the architecture |
| Pixel-diff screenshots | Catches visual drift | Noisy; breaks on fonts and data; replaced by geometry comparison (G13) |
| Pairing by label text | No markup changes | A renamed label looks like a missing field |

## Consequences

- The team gets fast local gates; the Harness keeps one engine and one contract for all projects.
- Reusing a project in the Harness means pointing `repo` at it and running `gates adopt`.
- Costs: a pack/sync/lock process to maintain; a `data-campo` attribute on the prototype side; the first adoption
  of each project is manual (config draft review).
- Risk: 57multimarcas is React 19 and has its own feature docs layout, so the first React adapter will expose
  contract gaps. That is why a second project is part of the plan, not an afterthought.
- Priority: `saude-dispensacao` first, `57multimarcas` second.
- Migration: `rastreio.wrapper.mjs` is replaced by the packed CLI; `projects/saude-dispensacao/rastreio.config.json`
  moves to the project repo once slice 1 passes.
