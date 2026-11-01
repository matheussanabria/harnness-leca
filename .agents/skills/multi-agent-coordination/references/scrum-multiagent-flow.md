# Multi-agent Scrum flow (parallel worktrees, OpenCode execution)

Standard flow for running several agents on one sprint without file conflicts. The ledger (`tools/coordination.js`) is the single source of truth; worktrees isolate working copies, and the file-scope check is what prevents conflicting edits.

## Roles
| Role | Who | Does |
|---|---|---|
| Planner | `epic-evolution-architect` | Writes stories with `owns:` (file globs), dependencies, acceptance criteria. |
| Scrum | the active Claude/Codex session | Plans waves, claims, reviews, hands off. Does surgical work (under about 3 files / 200 lines). |
| Executor | OpenCode via `9router/harness-*` combos | Bulk implementation and tests inside the story worktree. Never commits. |
| Integrator | one session, own window | Reviews each diff, commits, merges in dependency order, removes the worktree after confirmation. |

## Steps
1. **Plan.** Each story declares `owns: [glob, ...]` in its frontmatter (or the "## 5." file list). Shared files (`MAPA.md`, `docs/mapa/INDEX.md`) are excluded and resolved at merge.
2. **Waves.** `node tools/coordination.js sprint EP-xx.yy EP-xx.zz ... --project <slug>` prints waves that can run in parallel. A story waits for unfinished dependencies and never shares a wave with an overlapping scope. A story with no scope runs alone and is flagged.
3. **Claim with a worktree.** `node tools/coordination.js claim EP-xx.yy --provider <p> --project <slug> --worktree [--base main]` creates `C:/Temp/hl-EP-xx-yy` on branch `agent/<provider>/EP-xx.yy` and records both in the ledger. A claim whose scope overlaps an active story is refused.
4. **Delegate.** `node tools/coordination.js delegate EP-xx.yy --project <slug> [--model 9router/harness-testes] [--timeout-min 30]` runs OpenCode with write access only in that worktree (default combo `harness-implementacao`; runs are logged in `logs/opencode-delegate.jsonl`).
5. **Verify before trusting.** Combos return success for wrong or partial work: check `git status` for stray files, read the diff, re-run the story tests, fact-check any review findings.
6. **Commit and complete.** Commit in the worktree, then `complete EP-xx.yy --provider <p> --evidence "<command and result>"`. Completion is refused with uncommitted changes or no commit past `--base`; the SHA is appended to the evidence (`--no-commit-check` skips it for docs-only stories).
7. **Integrate.** The integrator merges branches in dependency order, then removes each worktree (`git worktree remove`) only after the user confirms. Before removing one, check it is clean (`git status --short`) and that its branch really holds nothing newer than `main`: "merged" alone is not enough, because a branch pointer can sit on an old commit while the real work is uncommitted or on a newer commit.
8. **Generated map files.** `MAPA.md` (domain table) and `docs/mapa/INDEX.md` are generated, and every branch that adds a map file edits them, so they conflict on almost every merge (sizes, summaries). Never merge them by hand: keep either side (`git checkout --ours -- MAPA.md docs/mapa/INDEX.md`), run `node tools/mapa.js build --write`, confirm `node tools/mapa.js check` says `map ok`, then `git add` both files and finish the merge.

## Routing to save quota
Free OpenCode / combos for bulk code, tests, docs scaffolding; keep architecture, review of combo output and surgical edits in the session. Run calls that hit the same rate-limited free providers one at a time.
