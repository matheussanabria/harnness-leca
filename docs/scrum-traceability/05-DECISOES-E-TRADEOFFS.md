> UPDATE 2026-11-01: the storage recommendation (option B, trace facts in the per-project events.sqlite) and the first ADR-014 draft are WITHDRAWN; section 10 now holds the rewritten ADR-014 proposal (2026-11-02). EP-17 (ADR-012, ADR-013) makes harness.sqlite with a hash-chained audit log and protected retention classes the system of record. See 11-REALINHAMENTO-EP-17.md before using anything in this file about storage, retention or actors.

# 05 - Decisoes e tradeoffs - epic EP-18 (provisional) / ADR-014 (draft)

Status: proposal for review; nothing implemented. Basis: Harness a89703c, DAI 7248777 (read-only).
Tags: [Fact path:line], [Hypothesis], [Pending decision]. `DAI:<path>` = DAI evidence. `svc/` = `ui/server/services/`.
Numbering (updated 2026-11-01): EP-16 (frontend, ADR-011) and EP-17 (SQLite system of record with RBAC and audit, ADR-012 and ADR-013) already exist on main, so this work uses provisional EP-18 and ADR-014. The storage decision below was written before EP-17 existed and must be reconciled with it (see 10 section 8). The ADR-014 draft stays in this document; it is NOT placed under docs/harness-evolution.

## 1. Storage alternatives (PLANO Fase 1: A / B / C)

| | A. Extend `scrum.json` | B. Append-only events in the existing per-project SQLite + projection read by Scrum | C. Independent audit module with outbox |
|---|---|---|---|
| What | Add `executions[]`, `evidence[]`, `auditEvents[]` to the story JSON | New `trace.*` types, nullable `story_id` / `implementation_id` columns in `projects/<slug>/coordination/events.sqlite`; Scrum keeps its own state and merges a timeline projection at read time | New store + service; Scrum writes to an outbox transactionally; relay delivers |
| Real anchors | whitelist persist (svc/project-scrum-persist.js:78-100); atomic write, no lock (svc/project-scrum-migration.js:68-83) | `ON CONFLICT DO NOTHING` + UNIQUE idempotency (svc/events/event-store.js:103-106; event-migrations.js:49-51); additive ALTER pattern (event-migrations.js:42-52); projectors rebuild from log (event-projector.js:1-10) | none exists; a DB would be new infrastructure |

### 1.1 Scoring (1 = poor, 5 = best; unweighted sum, judgement scores = [Hypothesis])

| Criterion | A | B | C | Rationale |
|---|---|---|---|---|
| Simplicity | 5 | 3 | 1 | A is one file; B reuses a store and ingest path; C adds a module and relay |
| Integrity | 2 | 4 | 5 | A: read-modify-write without lock loses updates; B: unique keys, WAL, `BEGIN IMMEDIATE` migrations (event-migrations.js:61-64); C: transactional outbox |
| Read cost | 3 | 4 | 4 | A loads the whole file per read; B can index `story_id` (needs migration v2); note projectors scan the full log in pages today (event-projector.js:47-59), so a story timeline must query by index, not by scan |
| Replay | 1 | 5 | 5 | A has no event stream; B/C rebuild projections from the log (event-store.js:5-6 comment) |
| Maintenance | 3 | 3 | 1 | B adds types, columns, a retention class; C doubles ownership |
| Migration | 4 | 4 | 2 | A: existing schema migration with backup/rollback (svc/project-scrum-migration.js); B: additive, rows keep nulls (event-migrations.js:10-11); C: new data and backfill |
| Total | 18 | 23 | 18 | |

### 1.2 Risks specific to B (found in code, must be resolved before implementation)
1. Retention deletes the oldest operational events above 20000 per project (svc/events/event-retention.js:19-25). An audit class needs its own exemption or cap, like `usage.observed` has its own rule. [Pending decision: exempt vs long retention]
2. The ingest allowlist is closed; adding types requires updating it and the parity test with aliases (svc/events/event-type-allowlist.js:40-49). [Fact]
3. The envelope has no `storyId`; `taskId` and `traceId` exist (svc/events/event-envelope.js:13-25). `taskId` is already used by `task.*` orchestration events (event-contract.js:50-55), so overloading it for stories would blur semantics. Recommendation: dedicated nullable columns, consistent with the stated rationale for columns over a JSON envelope (event-migrations.js:4-10). [Hypothesis]
4. `projects/` is gitignored (raw-git-tests-memory-mapa.md:11), so the trace is local and unversioned. Backup is a [Pending decision].
5. ADR-005 is still `status: proposta` although the store is implemented (ADR-005:4); ADR-014 should depend on it and ask for its acceptance. [Fact]

### 1.3 Recommendation
B, with this split: planning and lane facts stay in `scrum.json` (they are Scrum state; no duplication into events, the Timeline merges them); execution, evidence, gate, approval and link facts live in the event store. Scrum emits only pointer events if a cross-reference is needed. A is kept only for the small Scrum additions (`maturity`, `storyRevision`, `sprintHistory`). C is rejected for now: no requirement in the package needs outbox semantics that B plus idempotent best-effort emission cannot meet; revisit if a second writer process or remote sync appears (ADR-005 "Revisao" clause). [Hypothesis]

## 2. Rollback and migration of B (summary)
- Event store: migration v2 is additive (`ALTER TABLE ... ADD COLUMN`, nullable), rolled back by ignoring the columns; user_version is never lowered (event-migrations.js:57-58). [Fact pattern]
- scrum.json: new keys must be added to the persist whitelist, else they are silently dropped (svc/project-scrum-persist.js:78-100). [Fact] Downgrade hazard: running old code after new keys exist drops them on the next save. Prefer additive keys under the same `schemaVersion` 2; a bump to 3 must use the existing backup and `rollbackScrumFile` flow and note that code rejects schema above its own (svc/project-scrum-migration.js, raw-scrum-core.md:19). [Pending decision: bump or not]

## 3. Correlation and event contract decisions (summary)
Mapping rule from ADR-TEL-003 decision 4: no third naming; EP-08.04 `correlationId` maps to `traceId` (docs/harness-telemetria/adr/ADR-TEL-003-correlation.md:34). New names are therefore not introduced in section 4.

## 4. ID formats

| ID | Decision | Basis |
|---|---|---|
| `storyId` | Reuse existing `story.id` (local `us-<Date.now()>-rand`, Jira `jira-<id>`); do not introduce a new story id. `key` stays display. | [Fact] svc/project-scrum-sanitize.js:29; jira-source.js:51. Open: `id \|\| key` means id could equal a mutable key [Pending decision: id stability] |
| `runId` / `executionId` | Reuse: chat `runId = chatId` minted before spawn; workflow `executionId = wf-<uuid>` also sent as `workflowRunId` | [Fact] svc/chat-run-telemetry.service.js:4; ADR-TEL-003:26,17 |
| `attemptId` | Reuse `att-<uuid>`, one per stage attempt | [Fact] raw-harness-sprint-workflow.md:21 |
| `implementationId` | New `imp-<uuid>`, minted by Harness on the first execution against a story; reused for later executions on the same story+branch; a new branch or worktree starts a new implementation. Stored in the new `implementation_id` column | [Proposed]; branch per story: tools/lib/opencode-package/worktree.js:2,17 |
| `correlationId` vs `traceId` | Do NOT add `correlationId`. Use `traceId` (existing column). Proposal: `traceId = implementationId` for executions of one implementation; falls back to `runId` as today. The story join uses the `story_id` column, not `traceId` | [Fact] ADR-TEL-003:34; chat-run-telemetry.service.js:55-58 (client-supplied traceId allowed by pattern). [Pending decision] |
| `idempotencyKey` | `trace\|<entityId>\|<type>\|<discriminator>`; existing precedent `chat\|<runId>\|run.started`, `tool\|<runId>\|<toolUseId>`. Unique per `source_provider` | [Fact] chat-run-telemetry.service.js:81,151; event-migrations.js:49-51 |
| Event `id` | uuid when absent (default) | [Fact] event-store.js:86 |
| Evidence ref | commit: full SHA; test: `runId + sha256(command)`; document: path + sha256 + version; approval: event id | [Proposed] |
| Sprint history id | `<storyId>:<at>:<toSprintId>`, same shape as transition ids | [Fact] svc/project-scrum-transitions.js:51-62 |

## 5. Commit linkage

Facts: no app-created commits; no trailer convention; `.githooks` has pre-commit and pre-push only; pre-commit blocks secrets, local data and unmapped files and never edits the message; commits follow the `commit` and `conventional-commits` skills (raw-git-tests-memory-mapa.md:6-8; svc/orchestration/agent-stage-definitions.js:164). DAI has no commit-msg hook; its guard hook only asks on push/PR/deploy and denies commits on main (`DAI:policies/hooks/dai_guard.py`). A pre-commit hook runs before the message exists, so it cannot add a trailer.

| Option | Pros | Cons |
|---|---|---|
| a. Git trailer `Story: <storyId>` written by the agent/user following the commit skill | Survives rebase/cherry-pick text; engine-agnostic; standard git | Depends on discipline; missing trailer gives no link |
| b. Warn-only `commit-msg` hook that checks the trailer | Catches omissions locally | New hook; new files require map entries (pre-commit gate); not run by `--no-verify`; Claude-independent but only for local commits |
| c. Branch name = `story.branch` (worktree per story) | Already created by packages; no discipline needed | Merges and renames break it; shared branches |
| d. SHA recorded manually in the UI | Always possible | Declared only until verified |

Decision [Proposed]: a + c as link bases, d as manual fallback; always followed by verification: collector confirms the object exists in the project's `repoRoot` (`git cat-file -e <sha>^{commit}`), reads trailers (`git interpret-trailers --parse`), records `{sha, branch, trailerStoryId, linkBasis, verifiedAt}` as `evidenceClass=observed`. A SHA proves the commit exists, not that it covers the whole change (PLANO Fase 2 item 3). Rebase/cherry-pick yield new SHAs: store `git patch-id` as secondary key [Hypothesis]. Option b is a follow-up after collector coverage is measured [Pending decision]. Git calls reuse the `spawnSync` with `shell:false` pattern (worktree.js:13). Commit, push, PR and deploy are prepared, never executed, without an explicit confirmation event.

## 6. Product Backlog draft: status flag vs new Demand entity

Code finding [Fact]: the backlog is derived from `sprintId` falsy (svc/project-scrum-persist.js:41-42), BUT `sanitizeStory` defaults a missing `sprintId` to `activeSprintId` (svc/project-scrum-sanitize.js:39) and the create path passes `data.activeSprintId` (svc/project-scrum-ops.js:61). Hence a freshly created story lands in the active sprint, `sprintId:null` cannot be read as "not yet refined", and lanes cannot stand in for maturity because lane ids are fixed but names, visibility, active flag and order are configurable (raw-scrum-core.md:10). The seed uses `sprintId: null` (project-scrum-defaults.js:135).

| | Flag on Story | New Demand entity |
|---|---|---|
| Fits code | One whitelisted field (sanitize + persist) | New collection, routes, UI, tests |
| Handles split 1:N | No (needs `parentId`) | Yes |
| Handles ideas that never become stories | Poorly | Yes |
| Migration | Legacy stories read as `ready` | New store + backfill |
| Effort | S | L |

Decision [Proposed]: flag. Add `story.maturity` in {draft, refining, ready}, default `ready` for existing and Jira stories (so no sprint changes), and require `sprintId:null` for `draft` and `refining` at creation; assign-sprint rejects non-`ready` stories unless an auditable exception (actor, reason) is given. Changing the default of `sprintId` for all new stories is a behaviour change [Pending decision]; the narrower option is to apply the null default only when `maturity != ready`. Demand entity is deferred until one of: non-story intake is required, dedupe needs a fingerprint before story creation, or Demand 1:N Story splits appear (06-INTEGRACAO s3). Duplicate detection is a suggestion at creation, never a blocker (PLANO Fase 1).

## 7. Actor model while there is no authentication

Facts: no auth, RBAC or session user; approvals carry a free-text actor trimmed to 80 chars; routine approver is empty and unenforced (raw-harness-sprint-workflow.md:23,34); Scrum history records carry no actor (svc/project-scrum-transitions.js:51-62). Server bind address is Desconhecido.

Decision [Proposed]: every state-changing trace or Scrum write carries
`actor: {kind: human|agent|system, id: string<=80, source: ui|engine|collector|system, verified: false}`.
`source` is stamped by the server from the route, never trusted from the body (mirrors `ingestedAt`, event-ingest.js:83). `verified` stays false until authentication exists; the UI labels approvals "claimed by". When auth arrives, add `principalId` and `verified:true` additively; no history rewrite. Agent-side callers cannot post `kind:human` on collector routes (weak without auth, hence [Hypothesis] on the real strength). Approval of risky actions (commit-pr, deploy) is a separate confirmation event, never inferred from a chat message. Single-local-user is the working assumption [Hypothesis, Pending decision #1].

## 8. Orphan (pending-link) policy

- Detection: a run or implementation started without `storyId` emits `trace.link.pending` (declared or inferred relation, never promoted). [Proposed]
- Never blocks work by default. Modes per project: observe (list only), warn (UI banner), enforce (blocks stage start). Default observe; enforce only after collector coverage is measured (CONTEXTO s8). [Fact on intent: 06-INTEGRACAO s5 flow D]
- Resolution: link to existing story (exact trailer/branch/explicit id may auto-link, semantic match is only a suggestion), create story, or dismiss with reason; each is an event `trace.link.resolved`. Evidence is attached to the pending item and migrates on link; nothing is lost.
- Deadline and reconciler: scheduled scan lists pending items older than a threshold; the threshold value is [Pending decision] (not invented here). A stale run with no finish event becomes `trace.run.abandoned` (inferred).
- Projection is derived from events, so it is rebuildable after a crash.

## 9. Automation policy (assisted first)

| Stage | Behaviour |
|---|---|
| 0 Assisted (MVP) | User or agent links implementation to story manually; Harness verifies commit SHA; timeline read-only |
| 1 Suggest | Story Resolver proposes candidates; a human confirms |
| 2 Hybrid | Auto-link on exact identity only (explicit `storyId` at spawn, trailer, `story.branch`); auto-create only if a project flag allows it |
| Never automatic | Lane moves to review/homologation/done, sprint changes, deletes, approvals, commit/push/PR/deploy |

Lane writes always pass `validateStoryTransition` (adjacent-only, origin check; svc/project-scrum-transitions.js:34-47). [Fact]

## 10. ADR-014 proposal (rewritten 2026-11-02; stays in this document)

Status: proposal only. It is not placed under `docs/harness-evolution/03-decisions/`, and it must not be filed there until the owners of EP-17 accept ADR-012 and ADR-013, because it depends on both. The Portuguese draft of 2026-10-31 (trace facts as `trace.*` events in the per-project `events.sqlite`) is withdrawn; ADR-013 lists that approach as a rejected alternative.

```markdown
---
id: ADR-014
titulo: Delivery traceability (story, execution, commit, evidence) on tables in harness.sqlite
status: proposta
data: 2026-11-02
historias: [18.01b, 18.03, 18.09, 18.10, 18.11, 18.12, 18.13, 18.14]
tags: [harness-evolution, adr, scrum, rastreabilidade, sqlite, auditoria]
---

# ADR-014: Delivery traceability on tables in harness.sqlite

## Context

A Scrum story lives in `projects/<slug>/scrum.json` with no link to the sessions, commits and test results that
implemented it. Slice A (merged) added story `maturity`, the ready-only sprint rule, a mechanical Definition of
Ready and a read-only reader of the `Story: <id>` commit trailer; none of it persists a trace fact.
Two spikes (docs/scrum-traceability/01-discovery/sp1-sp2-findings.md) bound the design: the workflow runner only
records state that a caller reports and launches no agent (SP-1), and the DAI export ships workflows as skill
files without reading them at runtime or writing them into engine configuration (SP-2); Harness keeps its own
hardcoded copy of the stages. EP-17 (ADR-012, ADR-013) makes `data/harness.sqlite` the system of record, with
repositories, forward-only migrations, retention classes, a verified actor and a hash-chained `audit_log`
written in the same transaction as the change. Count-based pruning of `events.sqlite` and an envelope without
actor or hash make it unsuitable for audit (ADR-013, alternatives).

## Decision

1. **Store.** Trace facts are normalized tables in `harness.sqlite`, created by a migration owned by EP-18
   through the repositories of 17.01: `trace_implementations`, `trace_executions`, `trace_evidence`,
   `trace_pending`. They are declared in the `protected` retention class (17.10 RF3). There is no second store.
2. **Planning state stays with Scrum.** Maturity, sprint, lane and story revision remain Scrum state behind the
   same service interface (file store now, tables after 17.07). `sprint_assignments` and `story_revision` are
   requested from 17.07(b), not built here. The timeline joins Scrum rows and trace rows with a query.
3. **Closed write paths.** Only the trace service and the collectors write these tables. No generic HTTP route
   accepts a trace fact, so a client cannot forge one. The evidence class is minted by the server.
4. **Evidence classes.** `declared` (a caller says so), `observed` (a collector saw it: a git SHA verified in the
   project repository, a runner exit code), `validated` (a recorded test result, or an approval by a user holding
   the permission). A gate counts as passed only with `observed` or `validated` evidence.
5. **Audit.** Every trace mutation calls `ctx.audit.record` in the same transaction. The hash chain, redaction and
   retention are those of ADR-013; this ADR adds only the actions `trace.link`, `trace.evidence.recorded`,
   `scrum.maturity.changed` and `scrum.sprint.assigned`, and asks 17.06 for the permissions `trace:link` and
   `trace:approve`.
6. **Identity of things.** The story id never changes; a key rename keeps the id and records the old key as an
   alias (a rule for the 17.07 importer). `implementationId` is new; `traceId` is used where the EP-08.04
   `correlationId` was (ADR-TEL-003). A commit is linked by the `Story:` trailer written by the agent or the
   person (docs/scrum-traceability/12-CONVENCAO-TRAILER-STORY.md), always with the SHA verified; a `commit-msg`
   hook may warn and never blocks.
7. **Observer, not launcher.** Harness records sessions and stage results reported by callers. Stage results
   stay `declared` unless a collector proves them. A stage launcher is outside this ADR and needs its own decision.
8. **DAI is an input, not a dependency.** The stage definition comes from a pinned snapshot of the DAI
   `workflows/*/manifest.yaml`, read as files and guarded by a drift test. DAI is not modified; the proposed
   `_status.md` header is postponed.
9. **Actor.** The actor is whatever ADR-013 provides. Until 17.04 ships, a trace row records the PIN or anonymous
   actor and is never presented as verified.
10. **Orphans.** A run or commit with no story creates a `trace_pending` row. It never blocks work; the default
    mode is observe, and enforcement is considered only after collector coverage is measured.

## Alternatives considered

| Alternative | Pros | Cons |
|---|---|---|
| `trace.*` events in per-project `events.sqlite` (the earlier draft) | Reuses the store, replay and idempotency | Rejected by ADR-013: count-based pruning deletes rows, no actor or hash chain, closed allowlist, local and unversioned |
| Extend `scrum.json` with executions and evidence | One file, no new module | No lock, no replay, lost updates between processes, no audit chain; replaced by 17.07 anyway |
| Independent audit module with an outbox | Maximum integrity | New infrastructure and a second owner; the single database already gives one transaction |
| JSON columns on the story row | Fewer tables | Evidence cannot be indexed or queried by class, run or commit |
| A Demand entity before the story | Cleaner intake model | Deferred; the `maturity` flag covers the need |
| Copy DAI workflows into Harness | No runtime dependency | Gates and specialists drift from DAI |
| Parse `_status.md` as an audit source | Cheap | Markdown without ids, not transactional; at most declared evidence |

## Consequences

Easier: one database and one transaction for a change and its audit row; retention and backup come from EP-17;
the forged-evidence problem disappears because no generic route writes these tables; the drawer routes of slice A
already serve the read side.

Harder: EP-18 cannot start persistence before 17.01, 17.05 and 17.07(b); stage evidence stays `declared`
until the collectors (18.11, 18.13) ship; the git link depends on the discipline of writing the trailer; the
trace of a story that predates the migration is empty and is not backfilled.

Migration: additive tables with their own migration name; no change to ADR-012 tables. Slice A and story 18.07
write only to `scrum.json` and need no migration.

Dependencies: ADR-012 and ADR-013 (both `proposta` today), stories 17.01, 17.05, 17.06, 17.07(b), 17.10.

## Review

Revisit when ADR-012 or ADR-013 change status or content, when a stage launcher is proposed, or when a second
writer process or remote sync appears.
```

## 11. Open blocking questions

1. Identity: is Harness single local user? What is the server bind address? May unauthenticated "claimed by" approvals count for commit-pr and deploy confirmations? (blocks s7, risky-action policy)
2. Trust contract: keep `trust=declared` rejected and add payload `evidenceClass`, or amend the frozen contract (svc/events/event-ingest.js:72)? (blocks s7 in 04)
3. Audit retention: exempt `trace.*` from the 20000 operational cap, set a separate cap, and decide backup of the gitignored `events.sqlite` (blocks s1.2)
4. Draft semantics: change `sprintId` default for all new stories, or only when `maturity != ready`? Is `ready` the right default for legacy and Jira stories? (blocks s6)
5. DAI availability: does the Harness runtime get a configured DAI path, a vendored manifest snapshot, or neither? Does the orchestration runner actually launch agents (spike, adapters not inspected)? (blocks 04 s6)
6. Story id stability: can `story.id` equal a mutable `key`, and what happens to trace links on key rename? (blocks s4)
7. Commit discipline: who writes the `Story:` trailer in practice, and is a warn-only commit-msg hook acceptable given map-coverage gates? (blocks s5)
8. Scrum schema: bump `schemaVersion` to 3 or keep additive keys under 2, given old code drops unknown keys and rejects higher schema? (blocks s2)
9. Event column choice: `story_id` and `implementation_id` columns (migration v2) vs `taskId`/`traceId` reuse; confirm no other writer depends on the table layout.
10. Orphan thresholds and default mode; and whether DAI accepts an additive `storyId` line in `_status.md` (addendum item 7).
11. Epic label for story packages (raw file says EP-14; index lists EP-14 as screen state) and ADR-011 content, to avoid overlap with EP-16.
