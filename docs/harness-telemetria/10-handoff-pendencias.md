# Telemetry program: handoff for the next agent (any engine)

Written 2026-10-25. Read this first, then `docs/harness-telemetria/00-plano-consolidado.md` and `MAPA.md` (index) before opening code.
State: `main` == `origin/main` at 042b32f when written. Telemetry and all parallel fronts are merged except `docs/split-mapa-16`.

## Working rules (from the user)
- Claude only plans/reviews. Executions go to FREE OpenCode models (`opencode/deepseek-v4.1-flash-free`, `opencode/glm-5.3-flash-free`). Other engines: work in an isolated worktree, never in the shared main folder.
- One worktree + one new branch from main per task: `git worktree add C:/Temp/hl-<name> -b <branch> main`.
- The USER commits and merges (a hook blocks commits on main). Prepare the commands, do not commit on main.
- Never delete files, branches, stashes or worktrees without explicit chat confirmation. Remove a worktree only if clean and merged (`git worktree remove`, no `--force`).
- Do not run the `claude` engine unless asked (quota). Do not touch other chats' worktrees (`hl-atelier-composite`, `ep*`).
- English only, no emojis (FontAwesome icons only), files under 300 lines, update `docs/mapa/*.md` when files are created/moved/removed.
- Guard test runs: `timeout 400 node --test --test-timeout=120000 "tests/*.test.js"`. Close sqlite stores with `closeStore(slug)` before removing temp dirs (Windows EPERM).

## P0: Sessions tab layout is raw (user feedback, 2026-10-25)
Where: Central de Orquestracao, tab "Sessoes" (`ui/public/js/office3d/orchestration/central-sessions-*.js`, CSS under `ui/public/css/office/`). Rendered from the server projection (see `docs/harness-telemetria/07-sessions-tab-from-projection.md`).
Problems seen in the screenshot:
- The list is a plain text grid: columns overlap/collide (Workflow, Execution, Attention, Origin run into each other), no row separation, no alignment, text wraps and overflows.
- Session title shows `claude e108ead2 claude:e108e` (title, id and short id concatenated with no spacing or hierarchy).
- Filters (Motor, Execucao, Workflow, Atencao, Vinculo) are unstyled native selects on one line; the search box and "Atualizar" button look unstyled.
- Header summary is one long sentence; the Lista/Kanban toggle is unstyled.
- Repeated values ("Sem workflow", "Atividade desconhecida", "Sem sinal recente", "Sem atencao") dominate every row: they carry no information and should be muted or hidden when neutral.
- Floating dock overlaps the bottom rows.
Target: reuse the look of the "Consumo" tab (cards, `20-usage-panel.css` tokens, dark theme, pill tabs). Suggested design:
- Row = card/table with fixed column widths; title bold on line 1, muted id and engine below; engine as a colored badge; relation (observed/inferred) as a small badge with FontAwesome icon.
- Status as one compact pill (processing / idle / no recent signal / concluded / failed), colored; attention shown only when it needs attention.
- Neutral states muted (low-contrast) or omitted; origin ("external"/"Harness chat") as a small icon + relative time ("5 min ago") with full date in the tooltip.
- Filters as a styled toolbar (segmented controls/chips) above the table, summary as 3 small stat chips (sessions, need attention, inferred link).
- Pagination or virtual limit (89 rows today, 535 chats overall); bottom padding so the dock does not cover rows.
- Keep it accessible (contrast, keyboard focus) and responsive. No emojis.
Constraints: no new giant file; split render/filters/styles into small modules; add/adjust tests next to the existing `central-sessions-*` tests; update the map.
Verification: needs a real browser (the Chrome extension was not connected in earlier sessions). The user will check visually; provide the URL/command.

## P1: merge and cleanup
1. Merge branch `docs/split-mapa-16` (commit 3b3a7fc, adds `docs/mapa/18-telemetry-usage-workflows.md`). Until then `docs/mapa/16-telemetry-program.md` is 20715 B (over the ~20 KB limit).
2. After that merge, add a map row for THIS file (`docs/harness-telemetria/10-handoff-pendencias.md`) to `docs/mapa/18-telemetry-usage-workflows.md`. It was not added yet because 16 is over the limit and 18 is not on main.
3. Remove worktrees `C:/Temp/hl-tmpleak` (merged, clean) and, after step 1, `C:/Temp/hl-mapsplit`. Needs user OK.
4. `node C:/Temp/cleanup-temp.js` (dry-run default, `--apply`, `--min-age-hours N`): about 4360 entries / 7.7 MB in `%TEMP%` at last dry-run. Re-run the dry-run and ask the user before `--apply`.
5. Two stashes exist: `correcao-open-code` (already merged; dropping is the user's call) and a second one not created by Claude. Do not touch.
6. Leftovers in `C:/Temp` that are Claude's: `oc-prompt-*.txt`, `oc-run-*.log` (ask before deleting). Keep `oc-delegate.js`, `check-main.js`, `cleanup-*.js`, `leak-scan.js`, `map-split-verify.js`. Not ours: `t41a-spike`, `suite-rotas*.log`.

## P2: product/engineering follow-ups
- Review `tools/lib/pricing/prices.json` (`reviewStatus: pending-user-review`): values came from a summarised web search; the Consumo tab shows a warning until reviewed. Cost is always estimated/API-equivalent.
- Confirm retention: `usage.observed` 180 days / 200000 events (chosen by an agent, not fixed by an ADR).
- `tools/import-legacy-telemetry.js` was only run with `--dry-run`; `--apply` never done (user decision).
- Validate OpenCode port detection against a real `opencode serve` (tested only with fake servers).
- Consolidate `tools/opencode-package.js` (EP-14 story runner) with `C:/Temp/oc-delegate.js`.
- 24 UUID `.tmp` files still leak from some tests (likely `node:sqlite`; `SQLITE_TMPDIR` containment unproven).
- Split `ui/server/services/events/event-projector.js` (about 272 lines, guideline 250). `docs/mapa/02-backend.md` is 19157 B (near the limit).
- ADR-TEL-001..007 are "proposed", awaiting formal user review.
- Reasoning tokens stay null (probably included in output tokens). Historical usage events were not rewritten for the cache TTL split.
- Q3: live-stream `message.id` equality with the transcript callId is unverified (needs one real captured stream; costs quota; user decision).
- T3.6 Antigravity usage adapter is parked (`agy` not installed here).
- T4.1d/e/f (link chat to workflow step, per-step cost) paused on purpose until the user starts using workflows.
- Office emoji cleanup belongs to other chats' branches.

## Useful facts
- Event log: `ui/server/services/events/*`, SQLite at `projects/<slug>/coordination/events.sqlite` (git-ignored). Usage ingest: `ui/server/services/usage-ingest/*`. Pricing: `tools/lib/pricing/*`.
- Usage panel: `ui/public/js/modules/usage-*.js`, `ui/public/js/office3d/orchestration/tab-usage.js`, `ui/public/css/office/20-usage-panel.css`.
- `C:/Temp/check-main.js` is a read-only verifier (merged branches, conflict markers, map rows, suite on main, leftovers).
