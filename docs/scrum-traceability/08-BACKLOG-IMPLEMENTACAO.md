# 08 - Backlog de implementacao - epic EP-18 (provisional)

Status: proposal; nothing implemented, nothing created in docs/harness-evolution. Basis: Harness a89703c, DAI 7248777 (read-only).
Tags: [Fact path:line], [Hypothesis], [Pending decision], [Proposed]. Numbering 18.xx is provisional (renumbered 2026-11-01: EP-16 and EP-17 exist on main; ADR-014 provisional, draft in 05 s10).
Size: S = under 1 day of work, M = 1 to 3 days, L = more than 3 days or needs a spike result [Hypothesis: relative, not measured]. Every story keeps files under ~250 lines and adds its new files to the map in the same change (CLAUDE.md map rule; `scripts/pre-commit.js` blocks unmapped new files, raw-git-tests-memory-mapa.md:8).
Commands used below exist: `node --test <file>`, `npm test` (`node --test "tests/*.test.js"`, package.json:23), `npm run check`, `npm run types`, `node tools/mapa.js check`.

## 0. Status (updated 2026-11-01)

| Story | Status | Evidence |
|---|---|---|
| 18.00 | DONE, with one open item | Implemented on branch fix/remote-access-hardening, commit b577756, merged to main in 1018bc0. Full suite 1798 tests, 0 failures; type errors compared with the base commit: none new (553 vs 556). Independent security review applied (10 section 2, F13 and F14). Not exercised against a live Cloudflare tunnel. |

| Slice A (option 3, decided by the user on 2026-11-01) | Implemented, not committed | Worktree C:/Temp/hl-trace-a, branch feat/scrum-trace-slice-a from main 717282d. Suite 1924 tests, 1912 pass, 11 skipped; the single failure seen in the full run (tests/hia-hardware.test.js, free-RAM dependent) passes alone 3 of 3 and on the base commit, so it is load-dependent, not a regression. check and map ok; zero type errors in touched files. |

Slice A contents (no new store, per 10 section 5c option 3):
- Story maturity draft / refining / ready as a field on scrum.json stories (absent reads as ready, never written); drafts stay out of the sprint through assign-sprint and through upsert; ready requires the mechanical DoR. Upsert now starts from the stored story, so partial payloads no longer wipe fields or pull a backlog story into the active sprint (finding F6 of 10 section 2; F5 was not needed because origin is untouched).
- project-scrum-dor.js: mechanical DoR ruleset dor-mechanical-v1 (4 required, 5 advisory checks, humanReview always true).
- project-scrum-commits.js plus GET .../scrum/story/:id/commits: commits whose last trailer block has Story: <id>, SHAs verified through git cat-file, only the project's configured repo.
- GET .../scrum/story/:id/dor evaluates on demand and stores nothing.
- Delivered with OpenCode: commits module and tests (combo harness-implementacao), DoR tests (harness-testes, after a 12 minute timeout on the first, larger brief); review by harness-review. Findings checked by hand: one real (upsert could move a draft into a sprint, fixed with a regression test), one rejected (vague-term prefixes are intended and advisory).
- Not in slice A: sprintHistory (assign-sprint still writes no history), the schema 3 bump, UI for maturity, commits or DoR in the story drawer, anything on events.sqlite. These wait for EP-17 (17.07 moves Scrum to tables).

Open item for 18.00: at main 1d62d50 the file ui/public/js/app.js still lacks the line `const urlParams = new URLSearchParams(location.search);` (the fix is an uncommitted one-line change in the fix worktree). Without it the UI throws a ReferenceError at startup. Stories 18.01 onward are on hold pending the reconciliation with EP-17 (10 section 8).

Realignment (2026-11-01): 11-REALINHAMENTO-EP-17.md re-targets stories 18.01 to 18.06 and 18.08 to EP-17 tables and drops 18.02 and 18.05. Where this table disagrees with 11, document 11 wins.

## 1. Recommended MVP (one)

Slice: story -> implementation -> execution -> commit -> evidence -> timeline, plus demand draft and duplicate check. This is PLANO Fase 2 items 1-6 plus DO-01 and DO-02 (04-PLANO-REVISAO-DELIVERY-ORCHESTRATOR Fase 3 recommends DO-01 + DO-02 + traceability events). Nothing in it needs the orchestration runner to launch agents or DAI to be present.

MVP stories, in three independently demoable increments:

| Increment | Stories | Demo |
|---|---|---|
| M0 safety | 18.00 | proxy-header request without PIN is refused; wrong-PIN attempts are throttled |
| M1 contract | 18.01, 18.02, 18.03 | `trace.*` event accepted via wrapper, replay is a no-op, 25k operational events do not delete a trace row |
| M2 planning | 18.04, 18.05, 18.06, 18.07, 18.08 | create a draft with `sprintId:null`, see duplicate candidates, v2 file migrates to v3 and rolls back, sprint assignment leaves history |
| M3 trace | 18.09, 18.10, 18.11, 18.12 | bind a run to a story, verify a real SHA, see the timeline with grey/blue/green badges, orphan appears as pending |

MVP definition of done:
1. `npm test` green, including new files listed in 09; `npm run check` and `npm run types` green; `node tools/mapa.js check` green.
2. End-to-end test `tests/trace-e2e-mvp.test.js`: draft created by API (maturity draft, `sprintId` null, `trace.story.created` present) -> duplicate suggestion returned -> refine to ready (DoR record) -> assign to sprint (history entry) -> run bound to the story (stub engine, no real agent) -> commit created in a temp git repo with trailer `Story: <id>` -> collector verifies SHA -> timeline lists all items in order with correct badges.
3. Replaying every emission yields zero extra rows; rebuilding the projection from cursor 0 equals the live one.
4. A story of another project is neither linked nor listed; a claimed-but-not-run test stays declared.
5. v2 -> v3 migration and `rollbackScrumFile` proven on a copy of a real-shaped fixture; old stories keep lane, sprint and history.
6. Rollback notes for each story present in 09. Nothing commits, pushes or deploys on its own.
Out of MVP: authentication, Jira write, new lanes, automatic lane moves, `_status.md` import, DAI changes, runner changes beyond `storyId` plumbing, metrics.

## 2. Spikes (read-only, run first)

| Id | Question | How (read-only) | Unblocks |
|---|---|---|---|
| SP-1 | Does `workflow-runner.service` actually launch agents through the adapters, or only advance state? | read `ui/server/services/orchestration/workflow-runner.service.js`, `adapters/*`, `routine-runner.service.js:100` | 18.15, 18.16, 18.19 |
| SP-2 | Does the DAI export inject `workflows/` into the engines' config? Where does the runtime resolve `manifest.yaml`? | read `scripts/export_claude_code.py`, `scripts/export_native.py` in DAI; do not run | 18.17 |
| SP-3 | Does `svc/project-scrum-resolver.js` pass new story fields through for Jira and doc stories? | read resolver, `project-scrum-doc-source.js` | 18.04 |
| SP-4 | Does `svc/audit/test-execution.service.js` persist results; what does `evidence-detection.js` do? | read both | 18.13 |
| SP-5 | Do projectors/consumers tolerate unknown event types and new columns? | read `ev/event-projector.js`, `ev/event-stream.js`, other `events` table readers (grep `FROM events`) | 18.01 |
| SP-6 | Native session id formats and env/prompt injection per engine | read `tools/lib/engines/*.js`, `tools/opencode-delegate.js` | 18.09 |
| SP-7 | What do `scripts/check.js` and `scripts/lib/affected-tests.js` run, and how do new tests map to sources? | read | all (test commands) |
| SP-8 | Controllers `permissions.controller.js` and routine `approvalPolicy` | read | 18.19 |

## 3. Stories

Legend for Dep: spike or story id. Risk: L/M/H.

| Id | Story | Maps | Dep | Size | Risk |
|---|---|---|---|---|---|
| 18.00 (done) | Remote access hardening (prerequisite, see 10 F13): stop treating tunneled traffic as localhost, rate-limit and lock out PIN attempts, move the PIN out of the readable cookie and the QR URL, require the authenticated channel for approvals | 10 F13, Q1 | none | M | H |
| 18.01 | Event contract: `TRACE_TYPES` in allowlist, `ID_FIELDS` + migration v2 with `DB_USER_VERSION`, `storyId` filter in `readEvents` | PLANO F1, F2 | SP-5 | M | M |
| 18.02 | Audit retention class: exempt `trace.%` from `operationalMax`, own cap decision | PLANO F1 gate | 18.01, Q3 | S | M |
| 18.03 | Trace ingest wrapper: evidenceClass rules, actor stamping from route, server-minted class, reject `trace.*` on generic POST, gate pass requires observed id | DO-06/09 base | 18.01 | M | M |
| 18.04 | Story fields: `maturity`, `storyRevision`, `intake`, `specRef`, `dedupeKey`; sanitize/persist whitelist edits; drafts keep `sprintId:null`; edit does not reset fields | DO-01 | SP-3, Q4 | M | M |
| 18.05 | Schema v3: chained migration steps, backup `scrum.v2.backup.json`, rollback helper, tests | DO-01 | 18.04 | M | H |
| 18.06 | Story concurrency: `expectedRevision` on edit, assign-sprint and impediment (409), optional file lock modelled on `tools/lib/coordination/storage.js:35-45` | PLANO F4 gate | 18.04 | M | M |
| 18.07 | Capture demand as draft + duplicate suggestions (normalized title/key, Jira keys); idempotent create by `dedupeKey`; suggestion never blocks | DO-01, DO-02 | 18.04 | M | L |
| 18.08 | `sprintHistory` + assign-sprint rules (ready only, audited exception, requested vs effective for Jira) | DO-05 | 18.05, 18.06 | M | M |
| 18.09 | `storyId`/`implementationId` plumbing: `startWorkflowRun` and chat run accept and stamp ids; `trace.run.started/finished`; run without storyId emits `trace.link.pending` | PLANO F2.1-2, DO-07 | 18.03, SP-1, SP-6 | M | M |
| 18.10 | Implementation link (manual/assisted) route + `trace.implementation.linked`; pending resolve/dismiss | PLANO F2.1, F2.5 | 18.09 | M | L |
| 18.11 | Git evidence collector: verify SHA in project `repoRoot` (`git cat-file -e <sha>^{commit}`), parse trailer (`git interpret-trailers --parse`), branch, `patch-id`; `shell:false` spawn like worktree.js:13 | PLANO F2.3, F3 | 18.03, 18.10 | M | M |
| 18.12 | Timeline projection + read route + drawer tab (read-only, three badges); merges scrum.json histories; UI approach per ADR-011 outcome [Pending decision] | PLANO F2.4, F6 | 18.11 | M | M |
| 18.13 | Test evidence collector: allow-listed runner (reuse `test-execution.service`), `exitCode`, `commandHash`, `outputSha256`; claim without run stays declared | PLANO F2 gate, DO-07 | SP-4, 18.03 | M | M |
| 18.14 | Reconciler: stale runs -> `trace.run.abandoned`, JSON-vs-event gap repair, pending-link aging | PLANO F3 gate | 18.09 | M | M |
| 18.15 | DoR gate `dor.v1` (reproducible) + spec versioning (`specRef` hash) | DO-03 light, DO-04 | 18.04, 18.03 | M | M |
| 18.16 | Refinement specialist run bound to the story (business-analyst/requirements-engineering through the engine) | DO-03 | SP-1, 18.09 | L | H |
| 18.17 | Pinned DAI manifest snapshot + drift test replacing the hardcoded stage copy | DO-06 | SP-2, Q5 | M | M |
| 18.18 | Stage execution records: `trace.stage.finished`, attempts/retry, gate evaluation with mechanical evaluators | DO-06, DO-04 | 18.17, 18.13, SP-1 | L | H |
| 18.19 | Approval hardening: nonce, human-only checks, align APPROVAL stages with DAI gates | DO-09 | 18.03, SP-8, Q1 | M | M |
| 18.20 | Hotfix path: emergency story + post-incident backfill task | DO-08 partial | 18.08, 18.09 | M | L |
| 18.21 | Design + Dev tracks with conditional transitions and handoff contracts | DO-08 | 18.18 | L | H |
| 18.22 | Scope-change detection (`trace.scope.changed`, DoR stale) | PLANO F4 | 18.15 | S | L |
| 18.23 | Advisory claim badge from coordination ledger (`story.claimed` by storyId) | PLANO F4 | 18.12 | S | L |
| 18.24 | Metrics: cycle time, rework, failures, cost per stage (source and coverage labelled) | DO-10, PLANO F5 | 18.18 | L | M |
| 18.25 | Optional warn-only `commit-msg` hook for `Story:` trailer | PLANO F3 | 18.11 | S | M |
| 18.26 | Optional `_status.md` reader as declared evidence | PLANO F5, 06 s10 | 18.11 | M | L |

Mapping check: DO-01 -> 18.04, 18.05, 18.07; DO-02 -> 18.07, 18.10; DO-03 -> 18.15, 18.16; DO-04 -> 18.15, 18.18; DO-05 -> 18.08; DO-06 -> 18.17, 18.18; DO-07 -> 18.09, 18.11, 18.13; DO-08 -> 18.20, 18.21; DO-09 -> 18.19; DO-10 -> 18.24.
MVP = 18.01-18.12 (twelve stories, three increments). 18.13 (test collector) and 18.14 (reconciler) follow immediately after; until 18.13 ships, every test claim stays declared by construction.

## 4. Acceptance criteria (verifiable)

| Id | Criteria (each maps to a test in 09) |
|---|---|
| 18.00 | a request whose socket is 127.0.0.1 but carries `CF-Connecting-IP`, `X-Forwarded-For` or `Forwarded` is NOT treated as local and must present a valid PIN; direct loopback without those headers stays free; after N wrong PINs from one client the endpoint answers 429 for a cooldown, with a constant-time comparison; `/api/remote/info` returns the PIN only to a loopback request without proxy headers; the QR/URL no longer embeds the PIN in a form that persists in logs (one-time token or fragment); cookie is `HttpOnly`, `SameSite=Strict` and `Secure` when the request is HTTPS; `permissions.controller.js` loopback check uses the same function. Verified with a stub proxy test, never with a live tunnel |
| 18.01 | opening an old DB (user_version 1) ends at 2 with rows intact; `trace.story.created` accepted; unknown `trace.foo` rejected 422 `unknown_type`; replay of same idempotency key -> `duplicated:true`; allowlist parity test passes; `readEvents({storyId})` uses the index (query plan or timing assertion on 5k rows) |
| 18.02 | after inserting `operationalMax + N` mixed events, all `trace.*` rows remain and only non-trace operational rows are pruned; `usage.observed` rules unchanged (`tests/central-events-retention.test.js` still green) |
| 18.03 | client body with `evidenceClass:"observed"` on a claim route is stored as `declared`; `trace.*` on `POST /api/project/:slug/events` is rejected or forced declared; `trust:"declared"` still 422; `gate.evaluated pass` without observed id is rejected |
| 18.04 | create with maturity draft keeps `sprintId` null; editing title of a draft does not change `sprintId`, `maturity` or `storyRevision`; payload `storyRevision` ignored; legacy story reads `ready` |
| 18.05 | v2 fixture migrates: lanes, sprints, `transitionHistory` byte-identical in content; second run is `changed:false`; v3 file read by `migrateScrumData` constant 2 throws `UNSUPPORTED_SCRUM_SCHEMA`; `rollbackScrumFile` restores the exact v2 content; v1 fixture still reaches 3 through both steps |
| 18.06 | two concurrent edits with the same `expectedRevision`: one 200, one 409 `SCRUM_STORY_CONFLICT`; two processes writing scrum.json lose no update when the lock is on |
| 18.07 | same `dedupeKey` twice -> one story; near-duplicate title returns candidates and still creates; incomplete payload (no title) -> 400 |
| 18.08 | non-ready without exception -> 409/422 + `trace.action.denied`; with exception -> history entry `exception:true`; Jira story records requested vs effective |
| 18.09 | workflow start with `storyId` -> every run event carries `story_id`; start without -> `trace.link.pending` and the run still starts; story of other project -> denied |
| 18.10 | link stores `implementationId`; resolve and dismiss produce `trace.link.resolved`; evidence attached before linking appears after |
| 18.11 | real SHA -> observed; fake SHA -> rejected, nothing stored; trailer for unknown story -> pending; rebase/cherry-pick keeps `patchId` link |
| 18.12 | timeline for a fixed fixture equals golden JSON; rebuild equals live; three badges rendered; filter by run works |
| 18.13 | claimed pass without run -> declared; collector run -> observed with exit code; output beyond cap truncated; secrets redacted |
| 18.14 | run started 1 h ago without finish (clock injected) -> abandoned inferred; JSON history entry without event -> repaired once, rerun no-op |
| 18.15 | same inputs -> same `dor.v1` result; changing a criterion makes the previous pass stale |
| 18.17 | drift test fails when snapshot version differs from the pinned one |
| 18.19 | commit-pr approval without nonce rejected; nonce reuse rejected; `actor.kind=agent` denied |

(18.16, 18.18, 18.20-18.26: criteria to be written after SP-1, SP-2 and Q1; they are not MVP.)

## 5. Order and parallelism

SP-1..SP-8 -> (18.01 -> 18.02 -> 18.03) in parallel with (18.04 -> 18.05 -> 18.06 -> 18.07 -> 18.08) -> 18.09 -> 18.10 -> 18.11 -> 18.12. After the MVP: 18.13, 18.14, 18.15, 18.19, then 18.17/18.18/18.16 once SP-1 and SP-2 answer, then 18.20-18.26. One PR per story; commits follow the repo's `commit` and `conventional-commits` skills (raw-git-tests-memory-mapa.md:7). Preparing commits is allowed; executing push, PR or deploy needs explicit user confirmation.

## 6. Risks that can reorder the backlog

- SP-1 negative (runner does not launch agents): 18.16 and 18.18 shrink to recording externally launched sessions; the MVP is unaffected.
- Q3 unanswered: 18.02 cannot be finished; MVP e2e passes but production use risks truncation.
- Q4 unanswered: 18.04 ships with the narrow default (null only when `maturity != ready`).
- Shared `events` table readers (SP-5) that break on new columns: 18.01 grows to L.
