---
domain: tools
module: pacote-revisao
feature: pacote-revisao
summary: Builds the stand-alone review package (story board and layers map) and checks it for staleness.
paths: [tools/pacote-revisao.js, tools/pacote-revisao/**, tests/pacote-revisao.test.js, tests/pacote-revisao-botao.test.js, tests/pacote-revisao-docs.test.js, docs/features/pacote-revisao/**, docs/features/pacote-revisao-botao/**, ui/server/controllers/pacote-revisao.controller.js, ui/public/js/modules/design-scrum-review-package.js, ui/public/css/design/39-scrum-review-package.css]
keywords: [pacote, revisao, review package, quadro, kanban, mapa em camadas, snapshot, defasagem, drift, check, build, zip, vite, prototipo, gates, botao, scrum, endpoint]
updated: 2026-11-16
---
# pacote-revisao

`node tools/pacote-revisao.js build --project <slug> [--out <dir>] [--zip]` writes `quadro-historias.html`, `mapa-camadas.html`
and `.pacote-revisao.json` into the package folder (it never copies or deletes `doc/`; the folder content is curated by hand).
The Scrum tab has a "Gerar pacote de revisão" button next to "Sincronizar Jira" (only for projects with the config; an amber dot means never generated or stale).
`check --project <slug> [--com-deriva] [--json] [--estrito]` writes nothing and says what is stale.
Config: `projects/<slug>/pacote-revisao.json` (stories, columns, epics and the dated manual adjustments). Needs `HARNESS_PROJECTS_DIR` in a worktree.

The map is the real Harness layers module (ui/public) bundled with Vite and the data embedded; the prototype iframe uses `srcdoc`.
The documentation reader (see `docs/mapa/frontend/canvas/layers-docs.md`) is embedded too: `<pasta>/doc` only, so a reference to a project document left out shows "não incluído no pacote" and `check` warns DOC_FORA_DO_PACOTE.
Manual facts live in the config, each with `desde` and `motivo`: `statusForcado`, `correcoes` (map text and diff rows), `esconderNoPrototipo`.
`check` flags an adjustment as stale when the source already has the fact (STATUS_ABSORVIDO, CORRECAO_ABSORVIDA) or the target is gone
(ESCONDER_ORFAO, SELETOR_ORFAO), and flags the package as behind when a source hash changed (PACOTE_DEFASADO). `--com-deriva` also runs `tools/audit-layers-drift.js`.

| Path | What it does |
|---|---|
| `tools/pacote-revisao.js` | CLI: `build` and `check`, project and repo resolution, zip. |
| `tools/pacote-revisao/config.js` | Reads and validates the project config; every manual adjustment needs `desde` and `motivo`. |
| `tools/pacote-revisao/board-data.js` | Story data from the local scrum snapshot, story-to-field links and the files present in the package folder. |
| `tools/pacote-revisao/board-html.js` | Renders the board HTML from the template with safe embedded JSON. |
| `tools/pacote-revisao/board-template.html` | Jira-style board: columns by status, cards with epic chip and assignee, side panel with files and field links. |
| `tools/pacote-revisao/map-data.js` | Screens and prototype HTML as the Harness serves them, applies `correcoes` and `esconderNoPrototipo`. |
| `tools/pacote-revisao/map-bundle.js` | Vite bundle of the Harness layers module into one HTML file with the back-to-board bar. |
| `tools/pacote-revisao/map-entry.template.js` | Browser entry of the bundle: embedded data, hash links `#screen/field` and `#doc/<path>#<anchor>`, no network. |
| `tools/pacote-revisao/docs-data.js` | Documentation reader in the package: embeds `<pasta>/doc` (confined, no secrets per the project `.gitignore`, no Postman), indexes the whole project doc/, aligns path case, lists cited documents left out (`DOC_FORA_DO_PACOTE`). |
| `tests/pacote-revisao-docs.test.js` | CP-D1..6: what is embedded, case alignment, documents left out, the check warning, "não incluído no pacote" in the reader and chips, manifest groups. |
| `tools/pacote-revisao/manifest.js` | Source fingerprints written at build time and compared by `check`. |
| `tools/pacote-revisao/check.js` | The staleness findings and the selector matcher (id, class, attribute, `:has`, alternatives). |
| `tests/pacote-revisao.test.js` | CP-01..11: config, corrections, check findings, selector matcher, safe board HTML, CLI usage. |
| `docs/features/pacote-revisao/02-bdd.feature` | BDD scenarios CP-01..12 (CP-12 is manual: real build opens without the Harness). |
| `tools/pacote-revisao/context.js` | Project, repo, config and output folder resolution shared by the CLI and the server; `hasConfig`. |
| `tools/pacote-revisao/status.js` | Cheap package state (generated at, stale source groups) without Vite or Jira. |
| `ui/server/controllers/pacote-revisao.controller.js` | `GET` state and `POST` build of `/api/project/:slug/pacote-revisao`; runs the CLI in a child process, one at a time (409 if busy). |
| `ui/public/js/modules/design-scrum-review-package.js` | The Scrum tab button: hidden without config, tooltip with the state, toast with folder and zip after the build. |
| `ui/public/css/design/39-scrum-review-package.css` | Button styles and the amber stale dot. |
| `tests/pacote-revisao-botao.test.js` | CP-01..06: endpoint state, busy and failure answers, button texts. |
| `docs/features/pacote-revisao-botao/02-bdd.feature` | BDD scenarios CP-01..07 (CP-07 is manual: click in the browser). |
