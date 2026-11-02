# Next chat prompt: consumption telemetry

Paste the block below into a new Claude Code chat in this repository.

```
Continue the consumption-telemetry work for the 3D office / Harness Leca (repo: harness-leca).

## State (already done)
- Merged into main: pagination (presets 5/10/25/50, global prefs), Kanban fixes, Central sessions batching, removal of fake war-screen items, quota foundation, 9Router reader.
- Branch feat/usage-opencode (worktree .claude/worktrees/usage-opencode) holds the OpenCode reader plus this file. It is NOT merged yet: ask the user before merging, pushing or removing the worktree.
- Backend endpoints, all read-only, in ui/server/controllers/central-events.controller.js and its routes file:
  - GET /api/usage/quotas -> { generatedAt, quotas[] (QuotaSnapshot + stale flag), plans[] }. Codex limits come from rollouts. Claude Pro, Codex Plus and Gemini Pro are manual plans from quota-plans-config.js (optional file coordination/usage-plans.json). Only the primary Codex rate limit is read; "secondary" is ignored.
  - GET /api/usage/combos -> 9Router stats per combo/provider/model from %APPDATA%\9router\db\data.sqlite (usageHistory has no combo column; combo is filled only when model == a combos.name; all real rows have status ok, so failures are 0).
  - GET /api/usage/opencode -> per provider/model, layout v2 (session_message) preferred over v1, calls via provider "9router" are marked viaRouter and excluded from total (they are already in the 9Router feed).
- Code: ui/server/services/usage-ingest/ (quota-*.js, codex-quota-normalizer.js, 9router-*.js, opencode-*.js). Map: docs/mapa/telemetry/usage/usage-ingest.md.

## Pending, in this order
1. Merge feat/usage-opencode (ask first).
2. Claude quota: manual config only (Claude Pro), shown with an "estimated" badge. No statusLine hack.
3. Gemini/Antigravity: only 9Router feed tokens plus transcript activity counts; quota unknown or manual (Gemini Pro).
4. Failures and fallbacks of 9Router: instrument our own dispatcher (hia-chat-dispatcher.service.js) because the DB has no failure data.
5. UI: office panel provider strip with gauges, and a new main-UI "Consumo" page (combo table, trend chart, "as of" times, stale warnings). Reuse shared/pagination.js for tables. Optionally refresh prices.json (needs user review).
6. Inventory of office-only features (docs/plans/office-lists-telemetry/03): top gaps are Usage panel, Central de Sessoes, orchestration overview, live engine presence, SSE timeline, extraction trigger, HUD progress, capabilities audit. Items 1, 2, 3 and 5 could share the "Consumo/Telemetria" page.
7. Optional: server-side pagination for Central sessions, paginate design-board cards and sprint kanban lanes.

## Rules
- Do all code in a separate git worktree on its own branch (git worktree add .claude/worktrees/<slug> -b <branch> main). Never edit the main checkout. Ask before removing a worktree.
- Commit in the worktree only; do not push or open PRs unless asked. Commit messages end with the Co-Authored-By trailer required by the session.
- Read MAPA.md and use `node tools/mapa.js find <words>` before exploring. Update docs/mapa in the same task and run `node tools/mapa.js check`.
- Files 150-250 lines (hard cap 300). No emojis: FontAwesome fa-solid/fa-regular only. English for code, comments and docs.
- Privacy: never read apiKey, providerConnections.data, apiKeys.key, message text, titles or paths. Use explicit column/json-key allow-lists; tests must use sentinel values (add an "allow-secret" comment on fake key-like lines, or the pre-commit secret scanner blocks the commit).
- Pre-commit runs affected tests. A hook blocks commits on main.
- Cost saving: delegate bounded work to subagents (Sonnet for sensitive or judgment-heavy parts such as DB readers and quota logic, Haiku for mechanical UI, tests and map rows). The 9Router combo harness-implementacao timed out repeatedly; harness-planejamento works for plans. Verify every subagent result yourself (node --check, node --test tests/usage-*.test.js tests/central-events-http.test.js, mapa check) before committing.
- The central-events-http test asserts the exact route count (currently 11 on feat/usage-opencode); update it when adding routes.
- Do not run anything on the claude engine for extraction or consolidation without an explicit request.

Start by confirming the state with `git worktree list`, `git branch -vv` and `git log --oneline -5`, then ask the user whether to start with step 1 or jump to the UI.
```
