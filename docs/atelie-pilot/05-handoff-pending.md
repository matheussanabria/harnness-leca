# Atelier quality pilot - handoff: state, pitfalls and what is pending

Date: 2026-10-25. Written so another engine can resume without this conversation. Read the four evidence documents next to this one first: `01-stage0-audit.md`, `02-stage1-design-system-spike.md`, `03-stage1-prompt-runs.md`, `04-revision-rounds.md`. The plan is `docs/atelie-resumo-executivo-plano-aprovacao.md`.

## 1. Rules of this repository that apply to the work
- Replies, new documents, code comments and commit messages in English. No emojis anywhere; icons are FontAwesome only. Files stay under about 300 lines. New files get a row in `docs/mapa/17-atelier-quality-pilot.md`.
- Executions go to FREE OpenCode models (launcher `C:/Temp/oc-delegate.js`, or the scripts below, which call `opencode run`). Do not spend Claude quota on running scripts. Free models are weaker: verify their numbers against the script's own JSON files and read the renders.
- One isolated worktree plus one new branch from `main` per task (`git worktree add C:/Temp/hl-<name> -b <branch> main`). Never switch branches in the shared main folder. The commit hook blocks commits on `main`, so the user commits; prepare the commands.

## 2. What exists (all in the repository unless marked)
| Piece | Where |
|---|---|
| Opt-in flag per project: `atelier.qualityPrompt: true` in `projects/<slug>/design/profile.json`; optional `atelier.kit` (component ids) | `ui/server/services/atelier-quality.service.js` |
| Quality prompt, `/directions` mode, kit markup in the prompt | `ui/public/js/modules/prototype-prompt-quality.js`, hooked in `prototype-chat-bridge.js` |
| `dsComponents` metadata so the sandbox loads the Design System component CSS for prototypes saved under the flag | `prototype-storage.service.js`, `prototype.controller.js` |
| Design System import for `.dc.html` files plus palette (tokens, base layer, overrides) | `tools/import-dc-design-system.js`, `tools/ds-docs/extract-dc.js`, `dc-tokens.js`; palette `docs/atelie-pilot/palette-torra-nova.json` |
| Render review (Edge through `playwright-core`, 360/390/768/1440 px) | `tools/atelier-pilot/render-review.js`, `review-checks.js` |
| Deterministic contrast repair, policies `keep-polarity` and `keep-background` | `tools/atelier-pilot/contrast-fix.js`, `apply-fix.js` |
| Model drivers used in the experiments (hardcoded paths, see section 4) | `tools/atelier-pilot/drivers/` |
| Briefing with fixed content; composite spec | `docs/atelie-pilot/briefing-torra-nova-v2.txt`, `composite-spec-v2.txt` |
| Local prototypes (gitignored data, this machine only) | `projects/harness-leca/design/prototypes/`: `baseline-torra-nova` (first baseline, user's favourite), `v2-legacy`, `v2-quality`, `v2-legacy-r1`, `-r2`, `-p1`, `-p2`, `-c1`, `v3-composite-beam(-c1..c4)`, `v4-composite`, `v4-composite-fix` (latest composite) |

## 3. Pitfalls already paid for (do not rediscover)
1. **32,000-token output cap.** DeepSeek v4.1 flash, glm-5.3-flash, big-pickle and mimo-v2.6 share 32,000 tokens between reasoning and answer. Use `--variant low` (valid values for DeepSeek: low, high, max; `minimal` is silently ignored). Big composite tasks need a larger-output model: `opencode/beam-free` (131,072) worked; `flint-40b-free` rambled; `nemotron-3-ultra-free` ignores "do not use tools" and writes into the repository.
2. **Prompt size.** Above about 40,000 characters the free DeepSeek model reads the attached file with its own tools instead of answering. Keep prompts compact: strip `data-pid`, minify CSS, send only the fragments needed.
3. **Git Bash rewrites arguments that start with `/`** (`/directions` became a Windows path). Run drivers with `MSYS_NO_PATHCONV=1`.
4. **`opencode run`**: put the message before `-f`; attach long prompts as a file; multi-line arguments break in nested shells.
5. **Token accounting**: OpenCode adds about 26,600 fixed system-prompt tokens that appear as cache-read when warm and as input when cold. Compare "own tokens" (input plus cache-read minus 26,624, plus reasoning and output), not raw totals.
6. **The review tool is the source of truth for contrast and overflow, not the stylesheet.** A rule elsewhere can override what a class seems to declare; the review reports the computed colours, the element id (`data-pid`) and every width.
7. **Atelier lists prototypes by title**: put the id in the title or the copy cannot be found.
8. Command-line Edge has a minimum window width; use the Playwright viewport for mobile, never `--window-size`.

## 4. Pending, in suggested order
| # | Task | Done when |
|---|---|---|
| 1 | **Stage 4 report.** Ask the user to rate `v2-legacy-c1`, `v2-quality` and `v4-composite-fix` 1 to 5 on hierarchy, identity, legibility, goal fit and consistency; write the decision report (adopt, adjust or stop) with costs on the "own tokens" basis and the plan's adoption rule. | Report committed; section 9 of the plan updated. |
| 2 | **"Review and fix" action in the Atelier**, behind the project flag: runs the render review, then `contrast-fix` on a copy, shows before/after. | A user can run it without scripts; has a test. |
| 3 | **Move the drivers out of hardcoded paths.** `drivers/*.js` assume `C:/Users/matheuss.rodrigues/git/harness-leca`, port 4321 and a scratchpad directory passed as arguments. Parameterise and add tests. | Runs from any clone. |
| 4 | **Spacing check in the review** (a button or card edge touching the text above it, under 8 px), so a model patch can be targeted. | Test with a page that has the defect. |
| 5 | **Stage 3 gaps from the plan**: keyboard path, visible focus, mobile landscape. | Checks added and reported. |
| 6 | **Stage 1 leftovers**: structured briefing record (objective, audience, assumptions) and a record of the chosen direction next to `proto.json`; exercise `/directions` in the real chat. | Files and a test. |
| 7 | **Open user decisions**: hybrid `v2-hybrid` (legacy home plus the `v2-quality` confirmation screen the user liked); register Design System components in `registry.json` so the catalog lists them. | Answers recorded here. |
| 8 | **Known visual defects of `v4-composite-fix`**: Barista button about 15 px lower than the others, pale label (the repair stops at the minimum ratio, consider a margin), single-word second lines in titles, bean marker without a centre line; mobile not viewed. | Re-render checked by eye at 390 px. |
| 9 | **Baseline rerun with `--variant low`** and the same content, so Stage 4 compares like with like. | Numbers in the report. |
| 10 | **Housekeeping**: remove merged worktrees and `feat/atelier-*` branches only after confirming they are clean and merged; never force. | Clean `git worktree list`. |

## 5. Evidence limits to keep in mind
One briefing, free-tier models, Edge only, one run per method. Scores in the docs are editorial, not user research. The Design System constraint was never isolated from the other changes (kit, rules and prompt changed together), so no conclusion about the Design System alone is justified.
