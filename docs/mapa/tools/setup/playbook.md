---
domain: tools
module: setup
feature: playbook
summary: Factory playbook built from docs/playbook plus the DAI repo: stages, agents, agent x stage matrix, artifact examples.
paths: [tools/playbook.js, tools/lib/playbook/*.js, tools/lib/playbook/template/*, docs/playbook/*.json, docs/playbook/examples/*, tests/playbook.test.js]
keywords: [playbook, factory, dai, agents, stages, matrix, examples, sdlc, phases, generator, bilingual]
updated: 2026-11-09
---
# Software-factory playbook

One data source, two readers. `docs/playbook/` holds the bilingual (pt/en) content; the DAI repository supplies the stages, agents and who executes or supports each stage. The generator joins them into a single HTML page. The DAI path is always a parameter (`--dai` or `DAI_PATH`).

| File | Responsibility |
|---|---|
| `tools/playbook.js` | CLI: `check` validates the data against DAI, `build --out <file>` writes the page. |
| `tools/lib/playbook/load.js` | Loads `docs/playbook`, checks both languages, rejects emoji, compares stage order, phase and trigger with DAI. |
| `tools/lib/playbook/dai-source.js` | Read-only DAI reader: feature-delivery manifest (states, executor, support) and `.agents/` cards. |
| `tools/lib/playbook/build-page.js` | Joins data, DAI reading and templates; escapes the JSON for the script block. |
| `tools/lib/playbook/template/shell.html`, `page.css`, `render.js` | Page shell, styles and the browser renderer (language and theme toggles). |
| `docs/playbook/*.json` | Content by section: ui, layers, blocks, phases, stages, gates, boilerplate, principles, example, gaps, reference. |
| `docs/playbook/examples/` | One synthetic artifact per stage (fictional supplier registration) and `map.json` stage to file. |
| `tests/playbook.test.js` | Reader, validation, matrix and escaping tests with a throwaway DAI folder. |

- Stage ids and phase ids in `stages.json` and `phases.json` must match the DAI manifest; `check` fails otherwise.
- Phase 2 (not built yet): render the same data as an Atelier prototype under `projects/<slug>/design/prototypes/`.
