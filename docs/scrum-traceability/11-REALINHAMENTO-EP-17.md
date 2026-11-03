# 11 - Realignment of the traceability plan with EP-17 (option 1)

Status: proposal, written 2026-11-01 after the user chose "option 3 then option 1" (10 section 5c). Nothing here changes code. Tags: [Fact path], [Hypothesis], [Pending decision], [Proposed]. EP-17 paths are under `docs/harness-evolution/` on main (commit 717282d or later); EP-17 is status `planejada`, ADR-012 and ADR-013 are `proposta`, so everything below depends on documents that may still change.

## 1. What EP-17 provides that this plan used to build itself

| Need in this plan | EP-17 provides | Evidence |
|---|---|---|
| Durable store with transactions | One global `data/harness.sqlite`, WAL, forward-only migrations, repositories, `tools/lib/db-client.js` for CLIs | [Fact] 17.01 RF1-RF5, ADR-012 decisions 1-2 |
| Retention that cannot delete audit rows (my 18.02) | Retention classes `operational`, `usage`, `protected`; audit and RBAC tables are separate tables the sweep never touches | [Fact] 17.10 RF3, ADR-013 decision 5 |
| Verified actor (my "claimed actor" model in 05 and 07) | Local users, server sessions, RBAC `resource:action` permissions per route, agent runs with `on_behalf_of` | [Fact] ADR-013 decisions 1-4; stories 17.04, 17.06 |
| Tamper-evident history | Hash-chained append-only `audit_log` written in the same transaction as the change, `ctx.audit.record(...)` for domain detail, modes `off/observe/enforce-write` | [Fact] 17.05 RF1-RF7 |
| Scrum persistence without lost updates | Scrum moves to tables behind the same service interface, flag `HARNESS_SCRUM_STORE=file|db`, transition history as rows, importer with dry run | [Fact] 17.07 RF1-RF3 |
| One event table | Per-project `events.sqlite` merged into the global DB, `seq` cursors kept, orchestration engine events persisted | [Fact] 17.10 RF1-RF5 |
| Backup | `VACUUM INTO` plus integrity check | [Fact] ADR-012 decision 7, story 17.12 |

ADR-013 lists "audit in events.sqlite" as a rejected alternative because count-based pruning deletes rows. [Fact] Option B of 05 (trace facts as events in `events.sqlite`) therefore conflicts with an accepted direction of the repo and is withdrawn. The draft ADR-014 in 05 section 10 must be rewritten before anyone proposes it.

## 2. Where trace facts live after the realignment [Proposed]

Normalized tables in `harness.sqlite`, created by a migration owned by EP-18, plus one audit row per mutation:

| Table | Purpose | Written by |
|---|---|---|
| `trace_implementations` | `implementation_id`, `story_id`, `project_id`, `status`, `created_by` (user id from 17.04) | assisted link route |
| `trace_executions` | `run_id` (already the engine/chat run id), `implementation_id`, `engine`, `started_at`, `finished_at`, `outcome` | run start/finish hooks |
| `trace_evidence` | `kind` (commit, test, review, approval), `ref` (SHA or run id), `evidence_class` (declared, observed, validated), `verified_at`, `source` | collectors only, never a generic route |
| `trace_pending` | executions or commits with no story, with aging | reconciler |

Rules carried over unchanged from 06 and 07: the class is minted by the server, never taken from the client; a test claim without a recorded runner result stays `declared`; `observed` needs a collector (git SHA verified, runner exit code); `validated` needs a test result or an approval by a user with the right permission. Because no generic route writes these tables, the forged-"observed" problem of 10 F4 disappears with the event allowlist. Every write also records `ctx.audit.record` so the trail is hash-chained by 17.05, not by this plan. Declare the four tables in the `protected` retention class (17.10 RF3).

Timeline projection (my 18.12) becomes a SQL view/query over these tables plus the scrum transition rows from 17.07 and the events table, which is now the same database.

## 3. Story by story

| Story | Original role | After realignment | Needs |
|---|---|---|---|
| 18.00 | Remote access hardening | DONE (commit b577756, merged in 1018bc0) | none |
| 18.01 | Event contract in events.sqlite | REPLACED by 18.01b: migration for the four tables above | 17.01 |
| 18.02 | Retention exemption for `trace.*` | DROPPED: covered by declaring the tables `protected` in 17.10 | 17.10 |
| 18.03 | Ingest wrapper, class rules | RE-TARGETED to a `trace` service with repositories; no event route involved | 17.01, 17.05 |
| 18.04 | Story fields | PARTLY DONE in slice A (`maturity` only, on `scrum.json`). `storyRevision`, `intake`, `specRef`, `dedupeKey` move into the 17.07(b) schema | 17.07(b) |
| 18.05 | Schema v3 on `scrum.json` | DROPPED: 17.07 replaces the file store, schema v2 semantics kept | 17.07(b) |
| 18.06 | `expectedRevision` on story edits | KEPT, after 17.07(b) (API-level optimistic check on top of table transactions) | 17.07(b) |
| 18.07 | Draft capture and duplicate suggestions | KEPT; can start on the file store behind the same service, because it only reads titles and keys | slice A |
| 18.08 | `sprintHistory`, ready-only sprint rule | RULE DONE in slice A. History becomes a `sprint_assignments` table; ask 17.07(b) to include it (section 5) | 17.07(b) |
| 18.09 | Plumb `storyId` into runs | KEPT, writes `trace_executions` | 18.01b |
| 18.10 | Implementation link route | KEPT, writes `trace_implementations` plus audit | 18.01b, 17.04 |
| 18.11 | Git evidence collector | READER DONE in slice A (trailer parse, SHA verification, no persistence). Remaining: persist as `observed` evidence, branch, `patch-id` | 18.01b, 18.09 |
| 18.12 | Timeline projection and drawer tab | KEPT; the data routes of slice A already exist | 18.11 |
| 18.13 | Test evidence collector | KEPT | 18.01b |
| 18.14 | Reconciler | REDUCED: the two-store gap disappears (one database, one transaction). Only abandoned runs and pending aging remain | 18.09 |
| 18.15 | DoR gate and spec versioning | EVALUATOR DONE in slice A (`dor-mechanical-v1`). `specRef` hash remains | 17.07(b) |
| 18.16 to 18.18, 18.20 to 18.26 | Specialist runs, DAI snapshot, stages, tracks, metrics, optional hook and reader | UNCHANGED in intent; re-sequenced after 18.12; still gated by spikes SP-1 and SP-2 | spikes |
| 18.19 | Approval hardening | REPLACED by RBAC (17.06) plus audit; what remains is the single-use confirmation for `commit-pr` and `deploy` | 17.06 |

## 4. Work that does not wait for EP-17 [Proposed]

1. Story drawer in the UI: show maturity, the DoR result and the commits from the two slice A routes. Read-only, store-agnostic, so it survives the move to tables. Delegate the markup and tests to OpenCode with a precise contract; keep wiring in session.
2. 18.07 (draft capture and duplicate suggestions) on the current store, behind the same service functions.
3. Convention work only: document the `Story: <id>` trailer in the commit skill notes; decide the warn-only `commit-msg` hook (10 question 8) later.
4. Spikes SP-1 (does the runner launch agents) and SP-2 (does the DAI export inject workflows), both read-only.

## 5. Proposed requests to EP-17 owners [Pending decision]

Slice A edits the same files that story 17.07 will replace (`project-scrum-ops.js`, `project-scrum-persist.js`, `project-scrum-sanitize.js`). To avoid a second rewrite:

- Merge slice A first, then start 17.07(b) from it.
- Add to 17.07 acceptance criteria: the importer carries `maturity`; a story without it reads as `ready`; `tests/project-scrum-maturity.test.js` and `tests/project-scrum-trace-http.test.js` pass with `HARNESS_SCRUM_STORE=db`.
- Add to 17.07(b) scope: a `sprint_assignments` table (story, sprint, assigned_at, actor, reason) instead of a history array, and `story_revision`.
- Add to 17.05 the audit actions `trace.link`, `trace.evidence.recorded`, `scrum.maturity.changed`, `scrum.sprint.assigned`.
- Add to 17.06 the permissions `trace:link` and `trace:approve`.

Because these are changes to documents of another epic, they are requests, not edits.

## 6. Decisions [Decided 2026-11-01]

The user answered "seguir" to the recommendations below, so they are taken as decided. They stay revisable until EP-17 leaves status `proposta`.

1. Option B (events.sqlite) is withdrawn. Direction: trace tables in `harness.sqlite` plus audit rows. ADR-014 must be rewritten to say so before anyone proposes it.
2. EP-18 stays a separate epic that depends on EP-17 (scopes and owners differ; EP-17 already has 13 stories).
3. The section 4 parallel track is approved, in this order: story drawer first (done, branch `feat/scrum-story-drawer`), then 18.07, then spikes SP-1 and SP-2.
4. 18.19 is replaced by RBAC (17.06) plus audit. Only the single-use confirmation for `commit-pr` and `deploy` remains.

Answers to the open questions of 10, same date:

- Story id on key rename: the id never changes; the key becomes an alias. Rule to carry into the 17.07 importer, otherwise commits with `Story: <id>` are orphaned.
- `Story:` trailer: the agent writes it. A `commit-msg` hook may only warn, never block (local tool reused by other people, not everyone uses Scrum). Document the convention in the commit skill first; add the hook later.
- DAI `_status.md` additive header: postponed until SP-2 answers whether the DAI export injects workflows. DAI stays untouched.

## 7. Paste-ready requests to EP-17 owners

Text for the owners of 17.05, 17.06 and 17.07. It is a request, not an edit of their documents.

> Scrum traceability slice A is on main (story `maturity`, ready-only sprint entry, mechanical DoR, commit reader). It edits `project-scrum-ops.js`, `project-scrum-persist.js` and `project-scrum-sanitize.js`, which 17.07 replaces. To avoid a second rewrite:
>
> 1. 17.07 acceptance: the importer carries `maturity`; a story without it reads as `ready` and nothing is written for it; `tests/project-scrum-maturity.test.js` and `tests/project-scrum-trace-http.test.js` pass with `HARNESS_SCRUM_STORE=db`.
> 2. 17.07(b) scope: a `sprint_assignments` table (story, sprint, assigned_at, actor, reason) instead of a history array, and `story_revision`.
> 3. 17.07 importer rule: the story id is stable; a key rename keeps the id and records the old key as an alias.
> 4. 17.05 audit actions: `trace.link`, `trace.evidence.recorded`, `scrum.maturity.changed`, `scrum.sprint.assigned`.
> 5. 17.06 permissions: `trace:link`, `trace:approve`.
> 6. 17.10 retention: declare the planned `trace_*` tables (implementations, executions, evidence, pending) in the `protected` class.
> 7. 17.07 importer and schema: story 18.07 (merged) adds an optional `dedupeKey` to a story (1 to 80 characters, `[A-Za-z0-9][A-Za-z0-9._:/-]*`). It makes draft capture idempotent: a second capture with the same key returns the existing story and writes nothing. Carry the field through the importer and keep it unique per project (case-insensitive) in the table, otherwise a retry after the migration creates a duplicate draft.
> 8. 17.07 and 17.06 write path: `storyRevision` must never be read from a request payload (mass-assignment defense, pinned by `tests/project-scrum-capture.test.js`). Only the service increments it, in the same transaction as the change and its audit row.
