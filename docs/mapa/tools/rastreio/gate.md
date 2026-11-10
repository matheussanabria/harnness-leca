---
domain: tools
module: rastreio
feature: gate
summary: Traceability gate G1-G9 (rastreio.yml vs code, tests, Postman, regras.md, layer map), extracted into modular ESM files.
paths: [tools/rastreio/**, tests/rastreio-gate.test.js, tests/helpers/rastreio-fixture.js, tests/fixtures/rastreio/**, docs/rastreio-gate/**]
keywords: [rastreio, gate, G1, G2, G3, G4, G5, G6, G7, G8, G9, rastreabilidade, baseline, junit, karma, postman, regras.md]
updated: 2026-11-10
---
# Traceability gate (rastreio)

Run: `node tools/rastreio/cli.mjs --root <project dir> [--features a,b] [--json]`. Exit 1 on any error; warnings do not block. Read-only.
Plan and decisions D1-D4: `docs/rastreio-gate/`. Phase 1 is a pure move: output is byte-identical to the legacy script (`saude/dispensacao/tools/doc-features/rastreio.mjs`), text and `--json`.
Files are `.mjs` (ESM) on purpose: the source and the vendored `js-yaml` are ESM, so the move needs no rewrite. Gates receive a context (`ctx`) and a per-feature state (`f`), and never read fixed paths.

| File | Responsibility |
|---|---|
| `tools/rastreio/cli.mjs` | Arguments, feature selection, text/JSON output, exit code. |
| `tools/rastreio/config.mjs` | Project facts (paths, file names, id prefix, stacks). Phase 1 has only the saude-dispensacao preset; phase 2 loads `projects/<slug>/rastreio.config.json`. |
| `tools/rastreio/carrega.mjs` | Builds `ctx`: indexes (JUnit, Karma, Postman) and cross-feature lookups (`idsDe`, `rnPorSlug`). |
| `tools/rastreio/verifica.mjs` | Runs the gates over one feature in the legacy order. |
| `tools/rastreio/util.mjs` | `_status.md` header parser, glob matching, file reads. |
| `tools/rastreio/gates/entradas.mjs` | G1 entry without proof, G3 broken links, G4 missing test or request. |
| `tools/rastreio/gates/regras.mjs` | G2 rule without code or proof, G3 YAML vs regras.md, G4 missing code file. |
| `tools/rastreio/gates/g6.mjs` | G6 (warning) module test without a link. |
| `tools/rastreio/gates/g7.mjs` | G7 reused id (discontinued, wrong prefix, duplicated across features). |
| `tools/rastreio/gates/status.mjs` | G8 (warning) stale count and G5 placeholder id in `_status.md`. |
| `tools/rastreio/gates/g9.mjs` | G9 mapa-camadas.json vs rastreio (`rn`, `sem_mapa`, `sem_rn`). |
| `tools/rastreio/adapters/junit.mjs` | Java test index and `Class#method` / `method_*` check. |
| `tools/rastreio/adapters/karma.mjs` | Spec index and `file.spec.ts#title` / `#describe:Name` check. |
| `tools/rastreio/adapters/postman.mjs` | Request names from `*.postman_collection.json`. |
| `tools/rastreio/vendor/js-yaml.mjs` | Vendored YAML parser (MIT, license alongside); the harness has no YAML dependency. |
| `tests/rastreio-gate.test.js` | Frozen 22-feature baseline plus one provoked defect per gate. `RASTREIO_RUNNER=legacy` runs the old script instead. |
| `tests/helpers/rastreio-fixture.js` | Builds a throwaway project and runs the selected gate. |
| `tests/fixtures/rastreio/saude-dispensacao-baseline.json` | Frozen `--json` output of the real project. |
| `docs/rastreio-gate/` | Executive summary, execution plan and `02-diagramas.md` (four Mermaid diagrams ready for the canvas board). |
