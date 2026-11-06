# Pending items (shared by all chats)

Single ledger of open work. Any chat, in any project or engine (Claude, Codex, Gemini, opencode), must:
- read this file before starting follow-up work;
- add a row when it leaves something unfinished or finds a new issue;
- move a row to "Done" (with date) when it finishes it, instead of deleting it.

Ask the user before removing rows or files. Keep rows short; put detail in the linked file or chat.

Columns: ID | Area | Item | Origin (date, chat/project) | Status (`open`, `blocked`, `in-progress`)

## Open

| ID | Area | Item | Origin | Status |
|---|---|---|---|---|
| P-001 | codex | Restart Codex and run a test `git push` in a fresh session to confirm the PreToolUse hook (`~/.codex/config.toml`) really blocks. Only the wrapper was tested in isolation. | 2026-11-02 harness-leca | open |
| P-002 | codex | Open one `dai-agent-*` and one `dai-workflow-*` skill in Codex and confirm they load with a description. | 2026-11-02 harness-leca | open |
| P-003 | codex | Confirm the hook schema in the official docs (developers.openai.com/codex/hooks); only third-party sources were found and they disagree on `ask`. | 2026-11-02 harness-leca | open |
| P-004 | codex | Hook covers Bash only: file-write and secret-in-code checks do not apply in Codex. Decide whether to solve. | 2026-11-02 harness-leca | open |
| P-005 | codex | Guard `ask` is converted to `deny` (Codex has no confirm in PreToolUse), so risky actions are blocked instead of confirmed. Decide whether acceptable. | 2026-11-02 harness-leca | open |
| P-006 | codex | No parity for lifecycle hooks (pixel-agents) or plugins; Postman is only a note in `~/.codex/AGENTS.md`. | 2026-11-02 harness-leca | open |
| P-007 | codex | Add `trust_level` in `~/.codex/config.toml` for the DAI repo if Codex will run there. | 2026-11-02 harness-leca | open |
| P-008 | DAI repo | Uncommitted changes: `scripts/export_native.py` (importer fix) and regenerated `dist/`, mixed with older uncommitted edits in `.agents/`, `rules/`, `export_claude_code.py`. Split commits, open a PR, no commit on main. | 2026-11-02 harness-leca | open |
| P-009 | DAI repo | Run `python scripts/export_native.py --engines opencode,antigravity` and check they had the same empty-description / broken-link bug. Only Codex was regenerated. | 2026-11-02 harness-leca | open |
| P-010 | DAI repo | Add a frontmatter validation (or test) to `export_native.py` so empty descriptions and broken relative links are caught. | 2026-11-02 harness-leca | open |
| P-011 | cleanup | Remove `~/.codex/config.toml.bak-claude-sync` after validating P-001 (needs user confirmation). | 2026-11-02 harness-leca | open |
| P-012 | memory | Save via `node tools/memory.js save`: Codex gets DAI skills from `export_native.py`; hook `ask` becomes `deny`. Nothing saved yet. | 2026-11-02 harness-leca | open |
| P-013 | harness | Make the project hook (`.claude/hooks/load-project.ps1`) tell every chat to read/update `global/pendencias.md`. Needs the user's go-ahead because it touches instructions/hook. | 2026-11-03 harness-leca | open |
| P-021 | atelier | Merge branch `fix/atelier-storage-guard` (commit 0af3e94, worktree `.claude/worktrees/atelier-storage-guard`) into main: write_screen now rejects direct localStorage; then ask before removing the worktree. | 2026-11-03 harness-leca (app-compras fix) | open |
| P-022 | prototypes | Open app-compras v8 (`projects/harness-leca/design/prototypes/app-compras`) in the real preview and confirm all 10 screens work; only tested headless without localStorage. Backup of the earlier v5 working copy: `%TEMP%\bk-working-v5`. | 2026-11-03 harness-leca (app-compras fix) | open |
| P-023 | atelier | Agent prompt does not tell models the preview iframe blocks localStorage (only the guard error does). Consider adding the `LPS` wrapper to the prompt/design-system docs; `.versions/v6` and `v7` still hold the broken screens (left on purpose). | 2026-11-03 harness-leca (app-compras fix) | open |
| P-014 | scrum | Remove merged worktrees and branches: `trace-1807` + `feat/scrum-draft-duplicates`, `trace-doc11` + `docs/ep17-request-dedupekey`. Needs explicit user confirmation. | 2026-11-03 harness-leca (scrum trace) | open |
| P-015 | scrum | Decide on commit 992aa2a (18.07): no `Story:` link because of a blank line before `Co-Authored-By`. Suggested: accept, let story 18.11 treat it as a manual link. | 2026-11-03 harness-leca (scrum trace) | open |
| P-016 | scrum | User sends the EP-17 request (doc 11 section 7, items 1-8) to the owners of 17.05, 17.06, 17.07, 17.10. Never edit EP-17 documents. | 2026-11-03 harness-leca (scrum trace) | open |
| P-017 | scrum | Ask DAI owners for a trailer-format note in the `commit` skill (generated from DAI, read-only here); can ride on P-016. See `docs/scrum-traceability/12-CONVENCAO-TRAILER-STORY.md`. | 2026-11-03 harness-leca (scrum trace) | open |
| P-018 | memory | `tools/memory.js save` should reject descriptions over 140 chars before writing and let `--update` fix an invalid item (today it vanishes from the index). | 2026-11-03 harness-leca (scrum trace) | open |
| P-019 | scrum | UI for story 18.07: capture field with duplicate suggestions in the story drawer. Not requested yet. | 2026-11-03 harness-leca (scrum trace) | open |
| P-020 | scrum | Stories 18.01b onward wait for EP-17 (17.01, 17.05, 17.07(b)); ADR-012, ADR-013 and ADR-014 are still proposals. | 2026-11-03 harness-leca (scrum trace) | blocked |
| P-031 | tests | After the `tests/helpers/git-sandbox.js` merge, run the full `npm test` under fake `GIT_DIR`/`GIT_INDEX_FILE`; only the 5 git-using tests were verified. Also scan `scripts/` and `tools/` for code that spawns git without stripping `GIT_*` (only `tests/` was scanned). | 2026-11-03 harness-leca (test git isolation) | open |
| P-102 | canvas | Add a note to EP-17.08 (owns `ui/server/services/canvas/**`): the file store is already in main (one JSON per board with `rev`, content-addressed assets), so the importer targets that format. Do not edit EP-17 without the owners agreeing (see P-016). | 2026-11-03 harness-leca (canvas) | open |
| P-104 | canvas | Follow-ups: `readJsonBody` in `config.js` resets the connection above 5 MB instead of a clean 413 (shared code, own PR); asset garbage collection; many concurrent 25 MB uploads each held in RAM; symlink swap between check and read on asset GET (local-only). | 2026-11-03 harness-leca (canvas) | open |
| P-108 | canvas | Mind map: drag-to-reparent in the UI (model and cycle guard exist), board rename inside the editor, multi-selection, UI tests. Board: committed UI test (only throwaway scripts exist), CSP noise from font fallbacks, selected board per tab kept only in memory (registry field `selectedBoard` unused), possible loss of an edit under 800 ms when switching boards, dead standalone code in both islands (list and hash links; deep links to a board no longer work). | 2026-11-04 harness-leca (canvas) | open |
| P-109 | canvas | Validate the chat bridges with the real models (Gemini, Claude, OpenCode): do they obey the `<mindmap>` and `<board>` formats? Only simulated answers were tested. | 2026-11-04 harness-leca (canvas) | open |
| P-110 | cleanup | Remove merged Canvas worktrees `C:\Temp\hl-cv-*` (about 12) and their branches, plus `stash@{0}` (generated map index backup) and the stray empty `build-web.log` in `hl-cv-drag`. Needs explicit confirmation. | 2026-11-04 harness-leca (canvas) | open |
| P-111 | chat | The app server restarts (watch mode) cut in-flight chat turns and leave sessions `running` forever. Mark runs of a previous instance as interrupted on boot and tell the client. Not started. | 2026-11-04 harness-leca (canvas) | open |
| P-112 | deps | Bump transitive `katex` pinned at 0.18.11 (deprecated) to 0.19.0 and re-run `npm audit`. | 2026-11-04 harness-leca (canvas) | open |
| P-105 | coordination | EP-16 story frontmatter still says `planejada` although the 16.02 code is merged (`273e094`). Tell `opencode/qualidade`; do not edit their files. | 2026-11-03 harness-leca (canvas) | open |
| P-106 | cleanup | Remove merged Canvas worktrees `C:\Temp\hl-canvas`, `hl-assets`, `hl-sensors` (branches `feat/canvas-store`, `feat/canvas-assets`, `feat/hia-sensors`). Same confirmation as the other worktree-removal rows (P-014, P-038, P-049, P-050); ask once for all. | 2026-11-03 harness-leca (canvas) | open |
| P-107 | tooling | `gh` CLI is not installed, so PRs cannot be opened from the terminal. Optional install. | 2026-11-03 harness-leca (canvas) | open |
| P-032 | telemetry | Refresh `prices.json` (cost estimates depend on it). Draft only; user must review prices before use. Find the path with `node tools/mapa.js find pricing`. | 2026-11-03 harness-leca (usage telemetry) | open |
| P-033 | telemetry | Claude and Gemini quota gauges show n/d: ask the user for real plan limits and create `coordination/usage-plans.json` (format in `quota-plans-config.js`). | 2026-11-03 harness-leca (usage telemetry) | open |
| P-034 | telemetry | Visual check in a real browser of `/consumo` (incl. project panel), the office quota strip and the header presence strip; none was opened. | 2026-11-03 harness-leca (usage telemetry) | open |
| P-035 | telemetry | Optional server-side pagination for Central sessions; paginate design-board cards and sprint kanban lanes. Only if lists get slow. | 2026-11-03 harness-leca (usage telemetry) | open |
| P-036 | telemetry | Office-only screens still missing in the main UI (Central de Sessoes, orchestration overview, SSE timeline, extraction trigger, HUD card, capabilities audit). Proposed "Telemetria" page; not approved. Ask: page location, sessions per project vs all, unsaved-changes guard and confirm dialog. See `docs/plans/office-lists-telemetry/03-office-only-features.md`. | 2026-11-03 harness-leca (usage telemetry) | open |
| P-037 | telemetry | Register the telemetry work on the Scrum board (epic plus done/todo stories) via the app's Scrum API or a worktree, never by hand-editing `scrum.json`. Waiting for the user's choice. | 2026-11-03 harness-leca (usage telemetry) | open |
| P-038 | telemetry | Remove merged worktrees and branches: usage-opencode, usage-ui, usage-gemini, usage-failures, usage-office-strip, usage-project-panel, presence-strip, gitignore-temp-worktrees (feat/usage-*, feat/presence-strip, chore/gitignore-temp-worktrees). Needs explicit user confirmation. | 2026-11-03 harness-leca (usage telemetry) | open |
| P-039 | telemetry | Decide on dead browser code: `modules/engine-activity-badge.js` is CommonJS and used only by `tests/engine-monitor-ui.test.js`. | 2026-11-03 harness-leca (usage telemetry) | open |
| P-040 | telemetry | Check whether the P0 in `docs/harness-telemetria/10-handoff-pendencias.md` (raw Sessoes tab layout, 2026-10-25) is still open; that handoff is partly stale. | 2026-11-03 harness-leca (usage telemetry) | open |
| P-060 | atelier | The per-prototype map from "prompt 2" is not in the repo. `buildProtoMap` (`atelier-proto-map.service.js`) derives it from disk. If prompt 2 produces its own map, swap it in (one call in `atelier-proto-context.service.js`). | 2026-11-03 harness-leca (atelier proto map) | open |
| P-061 | atelier | The map adds about 132 tokens (2916 to 3048, +4.5%, chars/4 estimate) on top of the full file dump. A net reduction needs a smaller dump, which changes agent behavior. Decide whether to do it. | 2026-11-03 harness-leca (atelier proto map) | open |
| P-062 | scrum | Commit 470aed5 (`feat/scrum-draft-duplicates`) included `05-DECISOES-E-TRADEOFFS.md` that another session had staged in `trace-1807`. Confirm that session finished its edit. | 2026-11-03 harness-leca (atelier proto map) | open |
| P-063 | cleanup | More merged, clean worktrees and branches not covered by P-014, P-029, P-038 or P-041 (coord-worktree-field is in P-041): antigravity-bridge, atelier-proto-map, atelier-storage-guard, codex-thread-id, coord-sprint-args, test-git-isolation. Needs user confirmation. | 2026-11-03 harness-leca (atelier proto map) | open |
| P-050 | coordination | Remove merged worktree `.claude/worktrees/coord-worktree-field` and branch `feat/coordination-worktree-field` (ce9a83f, already in main). Needs explicit user confirmation. | 2026-11-03 harness-leca (coordination lanes) | open |
| P-051 | coordination | Visual check of the "Coordenacao" tab (Scrum & Projeto 360°) in a real browser; only `GET /api/project/harness-leca/coordination/lanes` was verified (200). Chrome extension was not connected. | 2026-11-03 harness-leca (coordination lanes) | open |
| P-052 | coordination | Tell the scrum-trace owner that the Coordenacao tab edited `ui/server/router.js` and `ui/public/js/modules/design-scrum-view.js` (shared files). Owner not identified; user to name them. | 2026-11-03 harness-leca (coordination lanes) | open |
| P-053 | coordination | Stale ledger lease: EP-13.01 is `claimed` by `claude/memoria` with a lease that expired 2026-10-22. Release or reassign it. | 2026-11-03 harness-leca (coordination lanes) | open |
| P-054 | scrum | Story 18.23 (advisory claim badge on Scrum cards from the ledger) stays on hold until EP-17 is realigned; covered by P-020. Coordenacao tab is the read-only substitute. | 2026-11-03 harness-leca (coordination lanes) | blocked |

## Done

| ID | Item | Date |
|---|---|---|
| D-006 | Canvas stories renumbered from 16.01-16.05 to EP-19 (19.01-19.05); ADR-011, index and memory updated (was P-101). | 2026-11-04 |
| D-007 | Canvas next stories delivered: mind-map island, board island, context pack, Design workspace, chat bridges (19.03-19.09; was P-103). | 2026-11-04 |
| D-001 | Fixed `export_native.py` (empty descriptions, missing skills/rules/limits, broken workflow links); regenerated and synced the 17 agent and 3 workflow skills to `~/.codex/skills`. | 2026-11-02 |
| D-003 | Canvas board store + REST (labelled 16.01) and content-addressed assets (labelled 16.02) merged into main; 1781 tests passed. | 2026-11-01 |
| D-002 | Installed `dai_guard` hook for Codex (`~/.codex/hooks/dai/`) and registered it in `config.toml`; added shared guidelines to `~/.codex/AGENTS.md`. | 2026-11-02 |
| D-004 | Merged `feat/atelier-proto-map`: compact prototype map plus 12-hex content hash in the Atelier AI context (`atelier-proto-map.service.js`, nav graph helpers, `tests/atelier-proto-map.test.js`). | 2026-11-03 |
| D-005 | Committed and merged `test/coordination-sprint-args` (sprint argument parsing and wave separation tests). | 2026-11-03 |
