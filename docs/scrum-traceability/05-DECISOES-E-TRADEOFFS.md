> UPDATE 2026-11-01: the storage recommendation (option B, trace facts in the per-project events.sqlite) and the ADR-014 draft below are WITHDRAWN. EP-17 (ADR-012, ADR-013) makes harness.sqlite with a hash-chained audit log and protected retention classes the system of record. See 11-REALINHAMENTO-EP-17.md before using anything in this file about storage, retention or actors.

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

## 10. ADR-014 draft (stays in this document)

```markdown
---
id: ADR-014
titulo: Rastreabilidade historia -> execucao -> commit -> evidencia sobre o event store por projeto
status: proposta
data: 2026-10-31
historias: [18.01, 18.02, 18.03, 18.04, 18.05]   # provisional numbering, EP-18 not yet created
tags: [harness-evolution, adr, scrum, rastreabilidade, dai, eventos]
---

# ADR-014: Rastreabilidade de entrega sobre o event store por projeto

## Contexto
O Scrum persiste historias em `projects/<slug>/scrum.json` sem ator, sem historico de sprint e sem vinculo
com sessoes, commits ou evidencias; `lanesRevision` protege apenas a configuracao de raias. O motor de
orquestracao ja replica os estagios do DAI `feature-delivery`, mas mantem runs em memoria e sem `storyId`.
O DAI nao tem runtime nem testes; sua execucao e uma sessao Claude Code guiada por prompt com estado em
`_status.md`. O event store SQLite por projeto (ADR-005, ainda proposta) ja e idempotente, mas tem allowlist
fechada, retencao de 20000 eventos operacionais e envelope sem `storyId`. Nao ha autenticacao.

## Decisao
1. Estado de planejamento (maturidade, sprint, raia) permanece no `scrum.json`; acrescentar `maturity`,
   `storyRevision` e `sprintHistory` como chaves aditivas na whitelist.
2. Fatos de execucao (run, estagio, tentativa, evidencia, gate, aprovacao, vinculo pendente) sao eventos
   `trace.*` no event store existente, com colunas anulaveis `story_id` e `implementation_id` e uma classe
   de retencao propria para auditoria. A Timeline junta `scrum.json` e eventos em leitura.
3. Nenhum segundo pipeline: o motor do Harness e o registro dos runs; a definicao vem de um snapshot fixado do
   manifest DAI com teste de divergencia; `_status.md` so entra como evidencia declarada.
4. Classe de evidencia (declared / observed / validated) no payload; gate "passou" exige evidencia observada.
5. IDs: reutilizar `storyId`, `runId`, `workflowRunId`, `attemptId`; novo `implementationId`; `traceId` no lugar
   de `correlationId`. Commit vinculado por trailer `Story:` e/ou branch da historia, sempre com SHA verificado.
6. Ator estruturado com `verified:false` ate existir autenticacao. Politica assistida primeiro; orfaos nao bloqueiam.

## Alternativas consideradas
- A. Estender `scrum.json`: simples, mas sem lock, sem replay e com perda de atualizacoes entre processos.
- C. Modulo de auditoria independente com outbox: integridade maxima, custo e manutencao desproporcionais.
- Entidade Demand: adiada; flag de maturidade cobre o MVP.
- Duplicar workflows DAI no Harness: rejeitada por divergencia de gates e especialistas.
- Parsear `_status.md` como fonte de auditoria: rejeitada (markdown sem ids, nao transacional).

## Consequencias
Positivas: replay e idempotencia reaproveitados; migracao aditiva; Scrum e raias preservados; multi-motor sem hooks.
Negativas: nova classe de retencao e tipos na allowlist; duas stores (JSON + SQLite) sem transacao distribuida,
reconciliadas por scan; trace local e fora do git; ator nao verificavel ate a autenticacao; ADR-005 precisa ser aceita.
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
