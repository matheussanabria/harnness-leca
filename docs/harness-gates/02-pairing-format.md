---
title: harness-gates pairing file and fidelity config
adr: ADR-016
status: aceita
updated: 2026-11-12
---

# Pairing file and fidelity config (slice 2)

Gates G10 (prototype x code inventory) and G11 (review by hash) read two things: a `fidelidade` block in the
project config and one `pareamento.json` per feature. Run with
`node tools/gates/fidelidade/cli.mjs --config <harness-gates.json>` in the Harness, or
`node tools/harness-gates/cli.mjs fidelidade` in a project that has the packed copy.

## Config block (`harness-gates.json`)

```json
"fidelidade": {
  "features": "doc/sistema/features",
  "prototipos": { "dis-paciente": "<dir that holds proto.json>" },
  "severidade": { "G10": "aviso", "G11": "aviso" },
  "componentes": {
    "busca-typeahead": { "icone": "magnifying-glass" },
    "pro-datepicker": { "icone": "calendar", "placeholder": "dd/mm/aaaa" }
  }
}
```

- `prototipos`: id to folder. Relative paths resolve against `--root`; absolute paths work too. A project that runs
  the gates without the Harness needs the prototype folder inside its own repo: in the Harness run
  `node tools/gates/prototipo.mjs snapshot --repo <repo> --id <id> --from <proto dir> [--config-from <cfg>]`
  (copies proto.json and the screen HTML to `design/prototipos/<id>` and registers the relative path), and
  `... check` later to learn whether the Harness prototype moved on.
- `severidade`: `aviso` (default) or `erro`. Only `erro` makes the exit code 1. A broken pairing and a declaration
  that no longer matches the code always fail.
- `componentes`: what a project component shows by itself (default icon or placeholder), because the template
  does not repeat it.

## Pairing file (`<features>/<slug>/pareamento.json`)

```json
{
  "schema": 1,
  "telas": [{
    "id": "s1",
    "prototipo": { "id": "dis-paciente", "tela": "nova-prescricao" },
    "codigo": { "templates": ["src/.../origem-receita-form.component.html"], "estilos": [] },
    "campos": [
      { "id": "emissao", "proto": "#emissao", "codigo": "dataEmissao" },
      { "id": "primeira", "proto": "#primeira", "codigo": { "chave": "dataPrimeiraEntrega", "n": 2 } }
    ],
    "ignorarPrototipo": ["demo-com", "demo-sem"],
    "declaradas": [
      { "campo": "voltar", "atributo": "rotulo", "codigoValor": "Cancelar", "motivo": "decisão do PO (13/10/2026)" }
    ]
  }],
  "revisao": { "src/.../origem-receita-form.component.html": { "sha": "...", "revisado_em": "2026-11-12" } }
}
```

### Selectors
A code template entry may be a component `.ts` whose template is inline (a `template:` literal in the decorator), e.g. the DS `dispensation-item`.

| Side | Form | Meaning |
|---|---|---|
| prototype | `#id` | element with that `id` (input, select, textarea, button) |
| prototype and code | `texto:<text>` | button, label, link or span with exactly that text |
| prototype and code | `legend:<text>` | radio group legend |
| prototype and code | `rotulo:<text>` | read-only label cell of the DS info grid (`ds-info__label`), a `ds-subhead` or a `dis-item__title`; compares the label only, the value is run-time data. A label whose value cell holds an input is a field label and is not a cell |
| code | `titulo:<text>` | heading h1 to h4 with that text |
| code | `<key>` | element whose `formControlName`, `idExterno`, `id` or `name` is the key |
| code | `{ "chave", "n" }` | the nth match (1-based), for a field that appears in two `@if` branches |

### Compared attributes
`rotulo`, `placeholder`, `obrigatorio`, `desabilitado`, `icone`, `largura` (px) and `acao` (the button next to a
field: text and icon). Icons compare by bare name (`fa-calendar-days` and `faCalendarDays` are `calendar`). Width
comes from `style="width: Npx"`, `inputWidth="Npx"` or a class rule in the sibling `.css`. A value bound at run time
(`[label]="x"`) is reported as dynamic and never as equal.

Not compared yet: field order, rendered geometry (G13), and values typed by the user.

### Declared differences
A difference between prototype and code is allowed only when `declaradas` lists it:

| Situation | Result |
|---|---|
| Difference and a declaration | passes, counted as declared |
| Difference and no declaration | G10 finding, level from `severidade` |
| Declaration and no difference | G10 finding: stale declaration |
| Declaration with `codigoValor` and the code has another value | error, always |
| Field only on one side | needs `{ "atributo": "presenca", "lado": "so-prototipo" or "so-codigo" }` |

Prototype elements that are neither paired nor in `ignorarPrototipo` come out as one warning, so a new prototype
field cannot go unnoticed.

### Drafting a pairing (`propor`)
Instead of writing selectors by hand: `node tools/harness-gates/cli.mjs propor --prototipo <id> --tela <prototype screen> --templates <a.html,b.html> [--id s1] [--saida rascunho.json] [--comparar pareamento.json]`. It matches by label and placeholder (confidence alta), label or placeholder alone (media) and similar key (baixa); a field never pairs with a button; a field whose code label is bound at run time is listed as dynamic and never guessed. Measured on Nova prescricao against the hand-made pairing: 88% of the pairs reproduced on both screens, none swapped; what is left is a product decision (a different label on each side) or an element that exists on one side only. The draft is for review: copy the pairs you accept into `pareamento.json` (drop `confianca`, `motivo` and `chaves`).

### G12: derived status
Each pairing field may carry `"mapa": "<map field id>"` (default: the same id) to say which `campos[]` item of
`mapa-camadas.json` it feeds. G10 gives the status of a map field: `implementado` when every linked field
matches, `diverge` when any difference exists (declared or not). G12 then checks `ui.st`:

| Typed `ui.st` | G10 evidence | Result |
|---|---|---|
| implementado or diverge | derived status equals it | nothing |
| implementado or diverge | derived status differs | G12 finding, level from `severidade.G12` |
| any other (a-confirmar, so-no-prototipo, ...) or no paired field | none | manual: needs `ui.motivo` and `ui.revalidar_em`; a date before today is reported |

`--derivar` writes `<features>/<slug>/status-derivado.json` (`{ telas: { <tela>: { <campo>: status } } }`); the
Harness panel reads it and shows the derived status over the typed one. `--hoje AAAA-MM-DD` fixes the date (tests).

### G11
`revisao` holds the SHA-256 of each template and of the `.ts` and `.css` next to it (line endings normalized).
When a file changes, G11 asks for another review of the map items that cite it. After reviewing, record the new
state with `--registrar-revisao [--data AAAA-MM-DD]`; that is the only option that writes a file.
