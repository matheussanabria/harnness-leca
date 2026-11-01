# 09 - Plano de testes, rollback e observabilidade - epic EP-17 (provisional)

Status: proposal; no test written, nothing run. Basis: Harness a89703c.
Tags: [Fact path:line], [Hypothesis], [Pending decision], [Proposed].

## 1. Commands that exist (and only these)

| Command | Source | Use |
|---|---|---|
| `node --test tests/<file>.test.js` | Node test runner; `npm test` = `node --test "tests/*.test.js"` (package.json:23) | single file, any new file under `tests/` is picked up by the glob |
| `npm test` | package.json:23 | full suite; pre-push runs it (raw-git-tests-memory-mapa.md:9) |
| `npm run check` | package.json:22 (`scripts/check.js`, content not read: [Hypothesis] static checks) | before every PR |
| `npm run regressao` | package.json:24 (`scripts/regressao.js`, content not read) | only if SP-7 shows it covers server code |
| `npm run types` / `npm run types:baseline` | package.json:25-26 | new `// @ts-check` files must not add to the baseline |
| `node tools/mapa.js check` / `find` / `build --write` | CLAUDE.md map rule | every new file needs a map row; pre-commit blocks otherwise |
| `HARNESS_SKIP_TESTS=1` | scripts/pre-commit.js (raw-git-tests-memory-mapa.md:8) | never used to land EP-17 stories |

Test style to copy [Fact]: `node:test` + `node:assert/strict`; temp root `fs.mkdtempSync` assigned to `process.env.HARNESS_ROOT` before requiring the store (`tests/event-envelope.test.js:11-15`, `tests/central-events-retention.test.js:13-14`); per-test slug dirs; `store.closeStore(slug)` and `removeDir` in `test.after` (`tests/helpers/temp-dir`); HTTP tests call `handle` from `ui/server/router` with a fake req/res (`tests/central-events-retention.test.js:33-48`); retention limits mutate `RETENTION` and restore it (:26-30); workflow bridge tests use the real runner with the real store (`tests/workflow-event-bridge.test.js`).
Levels: U unit (pure function), I integration (temp HARNESS_ROOT + real SQLite/JSON), H HTTP (router + fake req), P process (two `node:child_process` workers), G git (temp repo built with `git`, needs git on PATH), E end-to-end (I + H + G chained, stub engine).
Fixtures: never read the live `projects/` (task fixtures rule, EP-14.01 "fixtures independent of projects/", docs/harness-evolution/00-index.md:207).

## 2. Test matrix

Run any row with `node --test tests/<file>`. New files marked (new); extended existing files marked (ext). Scenario source: PLANO = PLANO-REVISAO-SCRUM-TRACEABILITY matrix, DO = 04-PLANO delivery-orchestrator Fase 4.

| # | Scenario (source) | Expected | Test file | Lvl |
|---|---|---|---|---|
| T01 | Replayed event, same key (PLANO; DO "event twice") | `duplicated:true`, one row, no second history line | `tests/trace-contract.test.js` (new) | I |
| T02 | Replay with a different clock/id but same idempotency key | still no-op (key, not id, decides; pattern `event-store.js:137-141`) | `tests/trace-contract.test.js` | I |
| T03 | Two concurrent sessions edit one story (PLANO; DO "two agents") | one 200, one 409 `SCRUM_STORY_CONFLICT`; no lost update across two processes | `tests/project-scrum-concurrency.test.js` (new) | P |
| T04 | Two sessions create the same demand (PLANO F4 gate) | same `dedupeKey` -> one story, second returns existing | `tests/project-scrum-maturity.test.js` (new) | I |
| T05 | External commit, not made by Harness (PLANO) | trailer/branch finds it -> observed evidence; no trailer -> `trace.link.pending`, not lost | `tests/trace-git-collector.test.js` (new) | G |
| T06 | Tests claimed but not run (PLANO; DO "no reliable evidence") | `trace.evidence.declared`; gate stays pending; story not validated | `tests/trace-ingest-wrapper.test.js` (new) | I |
| T07 | Failure between persistence and projection (PLANO) | JSON committed, event failed -> reconciler repairs once; rerun no-op; projection equals expected | `tests/trace-reconciler.test.js` (new) | I |
| T08 | Orphan session/run without story (PLANO; DO "chat bug", "CLI task outside Scrum") | `trace.link.pending`; run not blocked; resolve/dismiss emit `trace.link.resolved`; evidence follows the link | `tests/workflow-trace-binding.test.js` (new) | I |
| T09 | Unauthorized lane change (PLANO) | illegal or wrong-origin move rejected, history unchanged, `trace.action.denied` with code | `tests/trace-authz.test.js` (new) + `tests/project-scrum-transitions.test.js` (ext) | H |
| T10 | Story of another project (PLANO) | not linked, not listed, nothing from project B in A's timeline or events | `tests/trace-authz.test.js` | H |
| T11 | Rebase / cherry-pick (PLANO) | new SHA linked via `patchId` and trailer; original SHA kept; provenance preserved; unprovable commit never auto-attributed to an agent | `tests/trace-git-collector.test.js` | G |
| T12 | Revert / rollback compensation (PLANO; DO "rollback") | revert commit yields `trace.compensation.recorded`; earlier events untouched | `tests/trace-git-collector.test.js` | G |
| T13 | Sensitive payload (PLANO; DO "secrets redacted") | key `token`, `sk-...`, `Bearer ...` redacted; `stdout` dropped; 64 KB cap -> 413 `payload_too_large` | `tests/trace-privacy.test.js` (new) | U/I |
| T14 | Projection rebuilt (PLANO) | drop cache, fold from cursor 0 -> deep-equal to live timeline | `tests/trace-timeline-projection.test.js` (new) | I |
| T15 | Out-of-order delivery (PLANO F3 gate) | late `stage.finished` does not regress terminal state (`event-order.js:77-87`) | `tests/trace-timeline-projection.test.js` | U |
| T16 | Simple, duplicate and incomplete intake (DO) | draft created / candidates returned and created / 400 on no title | `tests/project-scrum-maturity.test.js` | I |
| T17 | Draft tries to enter sprint (DO) | rejected without exception; `trace.action.denied`; `sprintId` unchanged | `tests/project-scrum-sprint-history.test.js` (new) | H |
| T18 | Urgent exception into sprint (DO "urgency") | accepted with `exception:true`, actor, reason; draft stays draft | `tests/project-scrum-sprint-history.test.js` | H |
| T19 | Hotfix variant (DO) | stages skipped by variant recorded as `skipped`; commit-pr and deploy still require confirmation; backfill task created | `tests/workflow-trace-binding.test.js` | I |
| T20 | Scope change after start (DO) | `storyRevision` +1, `trace.scope.changed` lists active runs, DoR stale, runs not killed | `tests/project-scrum-sprint-history.test.js` | I |
| T21 | Engine failure, retry, cancel, resume (DO) | new `attemptId` per retry, max 2, tests/review fall back to dev; cancel final; replay no dup | `tests/workflow-attempt-events.test.js` (ext) | I |
| T22 | Stale run after restart (DO "reprocess") | `trace.run.abandoned` inferred once; shown as orphan | `tests/trace-reconciler.test.js` | I |
| T23 | Reopen, block, carry-over (DO) | reopen -> `ready -> refining` with history; impediment keeps history (`scrum-impediments-metrics.test.js` stays green); carry-over writes entry | `tests/project-scrum-sprint-history.test.js` | I |
| T24 | Story without Design vs Design + Dev (DO) | variant stage lists differ; missing skipped stages recorded, not failed (depends on 17.21) | `tests/workflow-trace-binding.test.js` | I |
| T25 | Gate pass without observed evidence | rejected | `tests/trace-ingest-wrapper.test.js` | U |
| T26 | Client forges `observed` via `POST /events` | rejected or stored declared | `tests/trace-ingest-wrapper.test.js` | H |
| T27 | `trust=declared` still rejected | 422 `trust_declared_forbidden` (`event-ingest.js:72-74`) | `tests/event-envelope.test.js` (ext) | U |
| T28 | Retention keeps audit rows | operational prune never deletes `trace.%`; usage rules unchanged | `tests/trace-retention.test.js` (new) + `tests/central-events-retention.test.js` | I |
| T29 | Event DB v1 -> v2 and old rows | columns added, rows intact, `user_version` 2 (edit `tests/event-envelope.test.js:42`) | `tests/event-envelope.test.js` (ext) | I |
| T30 | Scrum v2 -> v3, v1 -> v3, rollback | lanes/sprints/history preserved; idempotent; rollback restores bytes; stale-backup rule | `tests/project-scrum-migration.test.js` (ext) | I |
| T31 | Edit does not move a backlog story into the sprint nor reset `maturity` | `ops.js:71` merge safe | `tests/project-scrum-maturity.test.js` | I |
| T32 | Approval nonce | missing/reused nonce rejected; `actor.kind=agent` denied for human-only actions | `tests/trace-authz.test.js` | H |
| T33 | DAI manifest drift | snapshot version != pinned -> fail | `tests/dai-manifest-drift.test.js` (new) | U |
| T34 | MVP end-to-end | all of 08 s1 DoD item 2 | `tests/trace-e2e-mvp.test.js` (new) | E |
| T35 | Mechanical DoR purity | same inputs -> same result; changed criterion -> stale | `tests/trace-dor-gate.test.js` (new) | U |

Adding a new source file also needs `scripts/lib/affected-tests.js` to map it to its test; how that mapping works is unread (SP-7). Until read, full `npm test` is the gate.

## 3. Rollback per phase

| Phase / story | Change | Rollback | Data risk |
|---|---|---|---|
| P0 spikes | none | none | none |
| P1 17.01-17.03 event contract | nullable columns, new allowlist entries, wrapper | revert code; leave columns (never lowered, `event-migrations.js:57-58`, `:63`); old code ignores them | OLD retention code would prune `trace.*` under the 20000 cap: before reverting code, stop the server and copy `projects/<slug>/coordination/events.sqlite` plus `-wal`/`-shm` files [Hypothesis on WAL file names: `PRAGMA journal_mode = WAL`, event-store.js:69] |
| P1 17.02 retention | exemption | revert; audit rows become prunable again | same as above |
| P2 17.04-17.08 scrum v3 | new story fields, `sprintHistory`, schema 3 | `rollbackScrumFile(file, 2)` (`project-scrum-migration.js:96-109`) restores `scrum.v2.backup.json`; first copy the v3 file to `scrum.v3.discarded.<ts>.json`; then revert code | loses maturity/sprintHistory written after migration; trace events keep sprint facts. Old code against a v3 file throws `UNSUPPORTED_SCRUM_SCHEMA` (loud, no silent loss). Stale backup rule: after rollback rename the used backup, or the next migration keeps an old copy (`COPYFILE_EXCL`, migration.js:89-91) |
| P3 17.09-17.12 binding, collector, timeline | emission and read-only UI | per-project switch off [Proposed env `HARNESS_TRACE_ENABLED`, new flag, to be decided]; revert code; events stay | none; projections are rebuildable |
| P4 17.13-17.19 | test collector, gates, approvals | switch off emission; approvals fall back to current free-text behaviour (raw-harness-sprint-workflow.md:23) | in-flight approvals with nonce become unresolvable; list them first |
| P5 17.20-17.26 | optional | revert | none |

Rules: migrations first (reversible, tested), behaviour second, UI last; each story independently revertable; no story edits `lanes`, `lanesRevision` or existing history records.

## 4. Observability

Follow the bridge precedent [Fact workflow-event-bridge.js:31-32,136]: counters `persisted/duplicated/skipped/failed`, one warning per process, persistence failure never breaks the flow.

| Signal | Source | Threshold [Hypothesis, to calibrate] |
|---|---|---|
| `trace.*` per type | `storeStats(slug).byType` (event-store.js:192-207) | trend only |
| ingest failed / duplicated | wrapper counters, exposed like `getBridgeStats` | `failed > 0` surfaces a UI banner |
| pending links count and age | `trace.link.pending` without `resolved` | list in UI; aging threshold Pending decision |
| orphan/abandoned runs | reconciler output | any |
| declared vs observed ratio per story | timeline projection | shown, never gated in MVP |
| JSON-vs-event gaps repaired | reconciler | non-zero after steady state = investigate |
| audit rows pruned | retention counters | must be 0 |
| denials by code | `trace.action.denied` | spikes of `WRONG_PROJECT` = misrouted agent |
| migration outcome | `migrationHistory` entry | one per project |

Privacy of the telemetry itself: counters carry ids and codes, no payloads.
