---
domain: tools
module: rastreio
feature: gate
summary: Traceability gate G1-G9 (rastreio.yml vs code, tests, Postman, regras.md, layer map), extracted into modular ESM files.
paths: [tools/lib/audit-layers-rastreio.js, tools/audit-layers-drift.js, tests/audit-layers-rastreio.test.js, tools/rastreio/**, tests/rastreio-gate.test.js, tests/rastreio-config.test.js, tests/helpers/rastreio-fixture.js, tests/fixtures/rastreio/**, docs/rastreio-gate/**]
keywords: [audit-layers-drift, rastreio, config, pytest, adapter, gate, G1, G2, G3, G4, G5, G6, G7, G8, G9, rastreabilidade, baseline, junit, karma, postman, regras.md]
updated: 2026-11-10
---
# Traceability gate (rastreio)

Run: `node tools/rastreio/cli.mjs --config <rastreio.config.json> [--root <project dir>] [--features a,b] [--json]`. Exit 0 ok, 1 gate errors, 2 invalid config; warnings do not block. Read-only.
Config (D1): `projects/<slug>/rastreio.config.json` (local, projects/ is untracked); copies for tests live in `tests/fixtures/rastreio/`. Paths are relative to the project root; the file is validated up front with one message per problem.
Plan and decisions D1-D4: `docs/rastreio-gate/`. Phase 1 was a pure move and phase 2 swapped the built-in preset for the config file: output stays byte-identical to the legacy script (`saude/dispensacao/tools/doc-features/rastreio.mjs`), text and `--json`.
Files are `.mjs` (ESM) on purpose: the source and the vendored `js-yaml` are ESM, so the move needs no rewrite. Gates receive a context (`ctx`) and a per-feature state (`f`), and never read fixed paths.

| File | Responsibility |
|---|---|
| `tools/rastreio/cli.mjs` | Arguments, feature selection, text/JSON output, exit code. |
| `tools/rastreio/config.mjs` | Loads and validates `rastreio.config.json` (docs, ids, file names, status line text, stacks) and returns the normalized object gates read. |
| `tools/rastreio/carrega.mjs` | Builds `ctx`: one index per configured stack, Postman requests and cross-feature lookups (`idsDe`, `rnPorSlug`). |
| `tools/rastreio/verifica.mjs` | Runs the gates over one feature in the legacy order. |
| `tools/rastreio/util.mjs` | `_status.md` header parser, glob matching, file reads. |
| `tools/lib/audit-layers-rastreio.js` | Used by `tools/audit-layers-drift.js`: counts `testes.grupos` by status, rules without `rn`, and runs the gate (`--rastreio-config`) to report G9 per feature. |
| `tests/audit-layers-rastreio.test.js` | Counting units plus a provoked G9 defect through the auditor CLI. |
| `tools/rastreio/gates/entradas.mjs` | G1 entry without proof, G3 broken links, G4 missing test or request. |
| `tools/rastreio/gates/regras.mjs` | G2 rule without code or proof, G3 YAML vs regras.md, G4 missing code file. |
| `tools/rastreio/gates/g6.mjs` | G6 (warning) module test without a link. |
| `tools/rastreio/gates/g7.mjs` | G7 reused id (discontinued, wrong prefix, duplicated across features). |
| `tools/rastreio/gates/status.mjs` | G8 (warning) stale count and G5 placeholder id in `_status.md`. |
| `tools/rastreio/gates/g9.mjs` | G9 mapa-camadas.json vs rastreio (`rn`, `sem_mapa`, `sem_rn`). |
| `tools/rastreio/adapters/index.mjs` | Adapter registry (`junit`, `karma`, `pytest`), per-stack indexes and code-reference resolution by prefix. A new stack is one file plus one registry line. |
| `tools/rastreio/adapters/junit.mjs` | Java test index and `Class#method` / `method_*` check (entry fields `junit`, `it`). |
| `tools/rastreio/adapters/pytest.mjs` | Python test index and `file.py#test_name` / `test_*` check (entry field `pytest`). |
| `tools/rastreio/adapters/karma.mjs` | Spec index and `file.spec.ts#title` / `#describe:Name` check. |
| `tools/rastreio/adapters/postman.mjs` | Request names from `*.postman_collection.json`. |
| `tools/rastreio/vendor/js-yaml.mjs` | Vendored YAML parser (MIT, license alongside); the harness has no YAML dependency. |
| `tests/rastreio-config.test.js` | Config validation (missing, invalid, unknown stack, bad paths) and portability on the `pytest-project` fixture (prefix BR, pytest stack, G1/G4/G6/G7/G8). |
| `tests/fixtures/rastreio/pytest-project/` | Small Python project with 2 features used to prove the gate runs on another stack by configuration alone. |
| `tests/fixtures/rastreio/saude-dispensacao.config.json` | Config of the real project, used by the baseline and defect tests. |
| `tests/rastreio-gate.test.js` | Frozen 22-feature baseline plus one provoked defect per gate. `RASTREIO_RUNNER=legacy` runs the old script instead. |
| `tests/helpers/rastreio-fixture.js` | Builds a throwaway project and runs the selected gate. |
| `tests/fixtures/rastreio/saude-dispensacao-baseline.json` | Frozen `--json` output of the real project. |
| `docs/rastreio-gate/` | Executive summary, execution plan and `02-diagramas.md` (four Mermaid diagrams ready for the canvas board). |
