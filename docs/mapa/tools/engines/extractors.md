---
domain: tools
module: engines
feature: extractors
summary: Network and process libs, managed export writers, declarative memory libs (item, harvest, lint) and the memory hook.
paths: [tools/lib/network.js, tools/lib/ui-dev-guard.js, tests/ui-dev-guard.test.js, tools/lib/proc-manager.js, tools/lib/export/*.js, tools/lib/skill-mirror.js, tools/lib/layers/*.js, projects/_template/project.json, tools/layers.js, tests/layers.test.js, tests/skill-mirror.test.js, tools/lib/memory/**, .claude/hooks/load-project.ps1, tests/export-*.test.js, tests/memory-*.test.js, tests/remote*.test.js, tests/proc-manager-*.test.js, tools/lib/network-*.js, tools/lib/proc-manager-*.js, tools/lib/qrcode*.js, tools/lib/skills.js, tools/lib/skills/*.js, tools/import-gemini-chats.js, tools/lib/gemini-import/*.js]
keywords: [export, memory, harvest, lint, network, qr, proc-manager, envelope, hook, skills, qrcode, gemini-import]
updated: 2026-11-18
---
# Extractors, Network and Memory Libs

| File | Responsibility |
|---|---|
| `tools/lib/network.js` | Local IP discovery, ASCII/SVG QR Code generation and WebSocket proxies. Split into `network-*.js` (`network-store.js` keeps shared state). |
| `tools/lib/network-access.js` | Local interfaces, `isLocalhostRequest` (loopback socket, no proxy/tunnel headers, loopback Host), `isProxiedRequest`, `clientKey`, allowed hosts. |
| `tools/lib/network-auth.js` | Remote authorization: `authorizeRemote` (local, session or PIN), constant-time PIN check with attempt limiting; tunneled traffic never counts as local. |
| `tools/lib/network-session.js` | Signed `harness_session` cookie (HttpOnly, SameSite=Strict, per-process key bound to the PIN) replacing the raw PIN cookie. |
| `tools/lib/network-throttle.js` | Per-client and global PIN attempt limiter with temporary lockout. |
| `tests/remote.test.js`, `tests/remote-hardening.test.js` | Remote access, PIN, QR and the tunnel/proxy hardening regression tests. |
| `tools/lib/ui-dev-guard.js` | EP-23.01 guard: warns at startup when `--watch` runs in the main checkout (git dir equals common dir); never throws. |
| `tests/ui-dev-guard.test.js` | Guard tests with a temp git repo and worktree (GIT_* env stripped). |
| `tools/lib/proc-manager.js` | Per-project background process orchestrator. Split into `proc-manager-*.js` (`proc-manager-store.js` keeps shared state). |
| `tools/lib/proc-manager-persist.js` | Persists started services (pid, url, start time) in `temp/proc-manager-state.json` and re-adopts the ones still alive after the UI server restarts (`ui:dev` with `--watch`): wrapper pid first, else the listener on the service port, rejecting processes older than the service start. |
| `tests/proc-manager-persist.test.js` | Re-adoption, stop of an adopted service, dead or reused PIDs and pruning (uses a temp `HARNESS_ROOT`). |
| `tools/lib/export/managed-file.js` | Non-destructive export writes (EP-13.01): `harness:begin`/`harness:end` block, `harness:generated` rewrite, path validation. |
| `tools/lib/export/claude.js`, `gemini.js`, `local.js` | Plan what export writes per target (Claude `MEMORY.md` pointer, two-phase Gemini Knowledge Item). |
| `tools/lib/export/codex.js` | Codex and OpenCode target: managed block in `projects/<slug>/AGENTS.md` (instructions, memory index, working rules), capped at 24 KB. Codex reads it from the project cwd. |
| `tools/lib/layers/scan.js`, `resolve.js` | Effective skills, agents and workflows per project from three layers (DAI, `global/`, `projects/<slug>/`); the most specific wins by id; `project.json` `layers.disable` switches off inherited items. |
| `tools/lib/layers/writer.js` | Creates and removes items of the project layer (DAI formats: AGENT.md, SKILL.md, manifest.yaml + WORKFLOW.md); never overwrites, id validated, removal confined to the item folder. |
| `projects/_template/project.json` | Template: `workspace` (where a project keeps its repo skills) and `layers.disable` lists (skills, agents, workflows inherited from the DAI or global that this project switches off). `skills/`, `agents/` and `workflows/` folders ship beside it. |
| `tools/lib/layers/content.js` | Reads and saves the known text files of a project-layer item (SKILL.md, AGENT.md, manifest.yaml, WORKFLOW.md); 200 KB cap; the item must exist. |
| `tools/layers.js` | `show <slug> [--kind k] [--json]`: effective set with origin and overrides. `create <slug> <kind> <id>`: new item on the project layer. |
| `tools/lib/export/layers-block.js` | AGENTS.md section: project-layer items with description and path, inherited ones by id. |
| `tests/layers.test.js` | Layer precedence, disable, 00- skip, CLI and the AGENTS.md section. |
| `tools/lib/skill-mirror.js` | Mirrors (only `projects/<slug>`, or the working repo when `project.json` has `mirrorToWorkspace: true`) a project's `.agents/skills` (or `projects/<slug>/skills`) into `.claude/skills` for Claude Code; sidecar `.harness-managed` marks copies, the user's own skills are never touched, orphan copies are removed. |
| `tests/skill-mirror.test.js` | `project.json` workspace discovery, mirror create/update/skip/remove, dot-folder exclusion and the skills list in the AGENTS.md block. |
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
