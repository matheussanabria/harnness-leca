---
domain: tools
module: engines
feature: extractors
summary: Network and process libs, managed export writers, declarative memory libs (item, harvest, lint) and the memory hook.
paths: [tools/lib/network.js, tools/lib/proc-manager.js, tools/lib/export/*.js, tools/lib/memory/**, .claude/hooks/load-project.ps1, tests/export-*.test.js, tests/memory-*.test.js, tools/lib/network-*.js, tools/lib/proc-manager-*.js, tools/lib/qrcode*.js, tools/lib/skills.js, tools/lib/skills/*.js, tools/import-gemini-chats.js, tools/lib/gemini-import/*.js]
keywords: [export, memory, harvest, lint, network, qr, proc-manager, envelope, hook, skills, qrcode, gemini-import]
updated: 2026-10-30
---
# Extractors, Network and Memory Libs

| File | Responsibility |
|---|---|
| `tools/lib/network.js` | Local IP discovery, ASCII/SVG QR Code generation and WebSocket proxies. Split into `network-*.js` (`network-store.js` keeps shared state). |
| `tools/lib/proc-manager.js` | Per-project background process orchestrator. Split into `proc-manager-*.js` (`proc-manager-store.js` keeps shared state). |
| `tools/lib/export/managed-file.js` | Non-destructive export writes (EP-13.01): `harness:begin`/`harness:end` block, `harness:generated` rewrite, path validation. |
| `tools/lib/export/claude.js`, `gemini.js`, `local.js` | Plan what export writes per target (Claude `MEMORY.md` pointer, two-phase Gemini Knowledge Item). |
| `tools/lib/export/data.js` | Collects `memory.md`, `memory/` items, `instructions.md`, chat counts and resolves target dirs (env-overridable in tests). |
| `tools/lib/export/housekeeping.js` | `--report` (bytes and tokens per target) and `--prune` (lists old files; removes only with `--yes`). |
| `tools/lib/memory/item.js` | Memory item contract (EP-13.02): parse, deterministic serialization, normalization, hash, slug, frontmatter validation. |
| `tools/lib/memory/harvest/` | Native memory harvest (EP-13.08): `claude.js`, `gemini.js` and `index.js` orchestrator with dedupe and guard. |
| `tools/lib/memory/lint.js`, `lint-report.js`, `run-lint.js` | Periodic cleanup and audit of declarative memory (EP-13.09): duplicates, dead paths, orphan links, aging, index cap. |
| `.claude/hooks/load-project.ps1` | Two-phase instructions and memory injection via `<memoria_recuperada>` envelope, tag-injection neutralization, `HARNESS_MEMORY_FORMAT=legacy` fallback. |
| `tests/export-managed-file.test.js` | Managed file export writes. |
| `tests/export-context.test.js` | Export data collection and target resolution. |
| `tests/memory-item.test.js` | Memory item contract. |
| `tests/memory-harvest.test.js` | Native memory harvest. |
| `tests/memory-lint.test.js` | Memory lint engine. |
| `tools/lib/qrcode.js` | QR Code facade; `qrcode-*.js` in the same folder (encode, gf, matrix, render); `qrcode-store.js` holds shared state. |
| `tools/lib/skills.js` | Skills facade; modules in `tools/lib/skills/`: `frontmatter`, `targets`, `reader`, `writer`, `templates`, `recognized`, `catalog-web`, `catalog-api`. |
| `tools/import-gemini-chats.js` | Gemini chat importer; modules in `tools/lib/gemini-import/` (`text`, `sessions`). |
