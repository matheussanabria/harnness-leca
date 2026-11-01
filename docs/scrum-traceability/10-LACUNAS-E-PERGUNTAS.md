# 10 - Lacunas, perguntas bloqueantes e instrucoes para o PR futuro

Status: proposal; nothing implemented. Basis: Harness a89703c, DAI 7248777 (read-only). EP-18 and ADR-014 are provisional.
Tags: [Fact path:line], [Hypothesis], [Pending decision]. `ev/` = `ui/server/services/events/`, `svc/` = `ui/server/services/`.

## 1. Confirmed facts verified in this pass

| # | Claim | Result | Evidence |
|---|---|---|---|
| a | Retention caps operational events and deletes the oldest, so audit rows would be truncated unless exempt | CONFIRMED. `operationalMax: 20000` per project; every type except `usage.observed` counts; the oldest by `seq` are deleted when exceeded; `usage.observed` has separate time (180 d) and size (200000) rules | `ev/event-retention.js:19-25` (limits), `:34-36` (`type <> usage.observed`), `:63-68` (delete oldest), `:94-96` (trigger in `afterInsert`); `ev/event-store.js:18` (`MAX_EVENTS`) |
| b1 | Ingest rejects `trust=declared` | CONFIRMED, only on the ingest path: 422 `trust_declared_forbidden`. `appendEvent` still accepts `declared` (`TRUST_VALUES`, `normalizeEvent`) | `ev/event-ingest.js:72-74`; `ev/event-store.js:29,84` |
| b2 | The allowlist is a closed list | CONFIRMED. Union of EP09 types, `EVENT_CATALOG`, telemetry types and aliases; anything else is 422 `unknown_type`; adding `trace.*` means editing the list and the parity test | `ev/event-type-allowlist.js:12-49,55-57`; `ev/event-ingest.js:69-71` |
| c | Which epic owns the "story packages" (`tools/lib/opencode-package/`) | Story 14.03 "Executor de pacotes do opencode em worktree" (done), listed under EP-14. The EP-14 title in the index is "Estado das telas persistido no servidor", so the epic is mixed: 14.01-14.03 are tooling, 14.04-14.12 screen state. Epic label EP-14 is therefore right; its title is misleading | `docs/harness-evolution/00-index.md:43,206-209`; folder `02-epics/EP-14-estado-das-telas/14.03-executor-opencode.md` (link in index :209) |
| d | Bind address (answers part of question 1) | Default `127.0.0.1`; `--remote`, `--lan`, `--host` or `HARNESS_REMOTE` binds `0.0.0.0` with a 6-digit PIN; `HARNESS_HOST` overrides. Event publish route is loopback only | `ui/server/config.js:11-14`; `ui/server/controllers/central-events.controller.js:128-129` |
| e | `trace_id` already receives `correlationId` | CONFIRMED | `svc/orchestration/workflow-event-bridge.js:6,88` |
| f | `relation` cannot separate agent claims from engine facts | CONFIRMED: the engine emits `relation: "declared"` for harness-defined links, as does chat telemetry | bridge.js:9-10,94; `svc/chat-run-telemetry.service.js:34` |

## 2. Flaws and divergences found in the earlier design (02-05)

| # | Finding | Where | Effect | Proposed fix |
|---|---|---|---|---|
| F1 | `SCHEMA_VERSION` is both the envelope version accepted at ingest and the target of the DB migration gate. Adding columns via `ID_FIELDS` also grows `ENVELOPE_COLUMNS`; DBs already at `user_version 1` would skip v2 and INSERT would fail | `ev/event-envelope.js:8,32`; `ev/event-migrations.js:63`; `ev/event-ingest.js:44` | 05 s1.2 says "migration v2, additive" without this trap | separate `DB_USER_VERSION`; update `tests/event-envelope.test.js:42` |
| F2 | `migrateScrumData` applies the v1->v2 `laneId` rewrite to ANY file whose version differs from the constant | `svc/project-scrum-migration.js:32-62` | bumping to 3 would overwrite every lane of a v2 file | chain steps `from < 2`, `from < 3` |
| F3 | 05 s2 prefers additive keys under schema 2; but old `saveProjectScrum` drops unknown top-level keys silently | `svc/project-scrum-persist.js:78-91` | audit history (`sprintHistory`) lost without notice | bump to 3 (old code then fails loudly at persist.js:23). Reverses 05's preference; Pending decision #8 |
| F4 | `POST /events` shares the allowlist with internal producers | `central-events.controller.js:145` | adding `trace.*` lets any loopback client write "observed" evidence | wrapper rejects `trace.*` on the generic route (story 18.03) |
| F5 | 04 s2.4 uses `origin:hotfix`, but every non-Jira upsert forces `origin:"local"` | `svc/project-scrum-ops.js:68` | field overwritten | use `intake` object (06 s3) |
| F6 | Story edit merges `{...existing, ...sanitized}` and `sanitizeStory` defaults `sprintId` to the active sprint | `ops.js:71`; `svc/project-scrum-sanitize.js:39` | editing a backlog story without `sprintId` can pull it into the sprint; new defaulted fields (`maturity`) would reset on edit. Read from code, not executed | omit undefined new fields; preserve `sprintId` on edit; test T31 |
| F7 | 04 s2.3/2.5 emit `trace.run.started/finished` although `run.started/finished` and `execution.*` exist | `chat-run-telemetry.service.js:149-175` | duplicate facts | accepted deliberately for the retention class (06 s5); alternative: audit class by `story_id` |
| F8 | Retention exemption is not a flag: it touches count, prune and the in-memory counter | `event-retention.js:35,66,82` | 05 s1.2 item 1 understated | story 18.02 |
| F9 | Harness stage approvals are narrower than DAI gate approvals | `svc/orchestration/workflow-definitions.js:7-12` vs DAI gates | story, bdd, modeling, review would pass without a recorded approval | Pending decision (07 s4) |
| F10 | Citation drift: id generation is `sanitize.js:31`, docs 02/04/05 cite `:29` | `svc/project-scrum-sanitize.js:31` | cosmetic | fix when promoting to ADR |
| F11 | Backup is created only if absent; after rollback and re-migration it is stale | `project-scrum-migration.js:89-91` | restore to old state | rename backup after rollback (06 s4) |
| F12 | `tests/event-envelope.test.js:42` hardcodes `user_version == 1` | test file | existing test fails by design | edit in 18.01 |
| F13 | Remote access trusts the socket address only. `isLocalhostRequest` returns true for `127.0.0.1`/`::1`, `validatePin` returns true first for those, and `tools/tunnel.js:79` starts `cloudflared tunnel --url http://127.0.0.1:PORT`, so tunneled requests arrive from loopback. No `X-Forwarded-For`/`CF-Connecting-IP`/`Forwarded` handling exists in `tools/` or `ui/server/` [Fact, grep]. Read from code, NOT exercised against a live tunnel | `tools/lib/network-access.js:55-59,90-92`; `ui/server/router.js:206-217`; `tools/tunnel.js:79`; `ui/server/controllers/permissions.controller.js:11` | [Hypothesis, high likelihood] anyone holding the public trycloudflare URL reaches the whole API with no PIN, including approvals and deploy actions. The URL is printed with `?pin=` (tunnel.js:110) and is the only secret | RESOLVED in code by story 18.00 (2026-11-01, see 08 section 0); still to be exercised against a live tunnel. Until the open item in 08 is closed, do not rely on the UI starting |
| F14 | PIN hardening gaps: 6-digit PIN, no attempt limit on `POST /api/remote/pin`, string `!==` comparison, cookie holds the raw PIN (no `HttpOnly`, no `Secure`, 30 days), `GET /api/remote/info` returns the PIN, authenticated IPs are remembered 24 h in memory (a NAT or tunnel edge IP would authenticate everyone behind it) | `ui/server/controllers/remote.controller.js:10,25-28`; `ui/server/config.js:13`; `tools/lib/network-access.js:100-111` | brute force of 1,000,000 PINs is feasible once F13 is closed; IP-based trust is wrong behind a tunnel | story 18.00 |

## 3. Facts, hypotheses, pending decisions (index)

Confirmed: everything tagged [Fact] in 02-09 plus section 1 above.
Hypotheses (not verified): resolver passes new fields through (SP-3); projectors tolerate unknown types and columns (SP-5); `scripts/check.js` content; runner launches agents (SP-1); engines accept env/prompt injection (SP-6); mechanical gate rules for BDD coverage and owner patterns (07 s4-5); thresholds (abandoned, pending aging, `reason` length 500) are placeholders; the `late:true` repair flag; `HARNESS_TRACE_ENABLED` name.
Pending decisions: see section 5.

## 4. Unknowns

Runner behaviour (launches agents or only advances state); DAI export injection of workflows and how `manifest.yaml` is resolved on the user's machine; whether `test-execution.service` persists results and what `evidence-detection.js` does; native session id formats; other readers of the `events` table; `scripts/lib/affected-tests.js` mapping; epic UI for Scrum; content of ADR-011 (untracked on another branch) and whether React islands (recent commits, story 16.00) change the UI approach for the timeline tab; DAI `epic-evolution-architect` body; whether `validate_all.py` passes today; CI availability for `deploy-validated`; ledger initialisation for harness-leca.

## 5. Blocking questions for the user

1. Identity and risk: is Harness a single local user? Is `--remote` (0.0.0.0 + PIN) used? May unauthenticated "claimed by" approvals, with the nonce control of 07 s6, satisfy commit-pr and deploy confirmations, or must authentication come first? Blocks 18.19 and the human-only rules.
2. Trust: keep `trust=declared` rejected and carry `evidenceClass` in the payload (recommended), or amend the frozen ingest rule (`event-ingest.js:72`)? Blocks 18.03.
3. Retention and backup: exempt `trace.*` from the 20000 cap with no cap, or set an audit cap (what value)? Who backs up the gitignored `events.sqlite` and how? Blocks 18.02.
4. Draft default: should new stories keep defaulting into the active sprint (today) and only drafts/refining get `sprintId:null` (narrow, recommended), or change the default for all? Is `ready` the right default for legacy and Jira stories? Blocks 18.04.
5. DAI availability: will Harness get a configured DAI path, a vendored manifest snapshot, or neither? Does the runner launch agents (spike SP-1)? Blocks 18.16-18.18.
6. Schema bump: confirm bump to scrum schema 3 (F3) instead of additive keys under 2. Blocks 18.05.
7. Story id stability: `id || key` may equal a mutable key (sanitize.js:31); what happens to links when a key is renamed? Blocks the `storyId` contract in 06.
8. Commit discipline: who writes the `Story:` trailer, and is a warn-only commit-msg hook acceptable (18.25)? Affects collector coverage only, not the MVP.
9. Event DB version constant: separate `DB_USER_VERSION` (recommended) or bump `SCHEMA_VERSION` to 2 (F1)? Blocks 18.01.
10. Gate alignment: align Harness approval stages with the DAI gate list (F9)? Dossier location per project (`docs/features/` absent in Harness)?
11. Thresholds: abandoned-run age, pending-link aging, default orphan mode (observe/warn/enforce, default observe proposed).
12. Does DAI accept an additive `storyId`/`workflowRunId` header line in `_status.md`? (not needed for MVP)

## 5b. Decisions recorded (user, 2026-10-31)

User message: follow the recommendations; Harness is a local project meant to be reused by other users; `--remote` exists to operate from a phone and uses a Cloudflare tunnel (`tools/tunnel.js`, `npm run remote:tunnel`).

| Q | Decision | Consequence |
|---|---|---|
| 1 | Single-user, local install; each user runs their own instance. `--remote` is for phone access through a Cloudflare quick tunnel, so the instance is reachable from the public internet whenever the tunnel is up | Authentication is the PIN session only. Remote approvals cannot be treated as local. F13/F14 are blocking. New prerequisite story 18.00 (M0). Per-user identity stays out of the MVP |
| 2 | Keep `trust=declared` rejected at ingest; carry `evidenceClass` in the payload | as recommended in 05/06; unblocks 18.03 |
| 3 | Exempt `trace.*` from the 20000 cap. Backup of `events.sqlite` is still open (see below) | unblocks 18.02 |
| 4 | Narrow change: only drafts and refining stories get `sprintId: null`; legacy and Jira stories read `ready` | unblocks 18.04 |
| 5 | Because other users will install it and DAI may not exist on their machine: vendored manifest snapshot plus an optional configured DAI path, with a drift test; no hardcoded author paths | the integration must degrade cleanly when DAI is absent (feature-delivery stages still work from the snapshot) |
| 6 | Bump the Scrum schema to 3 with chained migration steps (F2, F3) | unblocks 18.05 |
| 9 | Separate `DB_USER_VERSION` from `SCHEMA_VERSION` (F1) | unblocks 18.01 |

Reuse by other users adds requirements [Proposed]: no machine-specific path, user name or remote in committed defaults; per-install configuration for the DAI path and tunnel; the trace store stays local (`projects/` is gitignored) and is documented as such; secrets and the tunnel URL never enter events, memory or the dossier; first-run behaviour with no DAI, no tunnel and no `cloudflared` binary must be defined.

Still open: 7 (story id stability when a key is renamed), 8 (commit trailer discipline), 10 (approval alignment with DAI gates, dossier location), 11 (thresholds), 12, and the backup of `events.sqlite`. Defaults proposed in 07/09 apply until answered.

Approvals over the tunnel [Proposed]: after 18.00, a request arriving through the tunnel with a valid PIN session counts as "remote, PIN-authenticated". It may approve story/bdd/prototype/modeling/review gates, but `commit-pr` and `deploy` confirmations (07 s6) additionally require a fresh single-use confirmation tied to that action, never a standing cookie. Identity remains claimed, not verified; the record states the channel (`local` or `remote-pin`).

## 5c. Reconciliation with EP-17 (found 2026-11-01)

After this plan was written, main received EP-17 "SQLite as system of record, with RBAC and audit trail" (docs/harness-evolution/02-epics/EP-17-sqlite-persistencia, ADR-012 and ADR-013, status proposta). Numbering moved to EP-18 and ADR-014 for that reason. The overlap is substantive, not only numeric:

| Topic | This plan (written before EP-17) | EP-17 (main) | Consequence |
|---|---|---|---|
| Where trace facts live | New trace.* events in the per-project events.sqlite, exempt from the 20000 cap (story 18.02) | One global data/harness.sqlite with a hash-chained append-only audit_log, exempt from retention (ADR-013); ADR-013 lists "audit in events.sqlite" as a rejected alternative because count-based pruning deletes rows | Direct conflict on the storage decision in 05 |
| Actor identity | Claimed, not verified; channel recorded as local or remote-pin (5b) | Local users, server sessions, RBAC per route, agent runs recorded with on_behalf_of (stories 17.04 to 17.06) | Question 1 and the actor model in 05 and 07 are superseded once 17.04 to 17.06 land |
| Scrum persistence | scrum.json schema 3 with maturity, storyRevision, sprintHistory (stories 18.04 to 18.08) | Domain stores incl. Scrum move to tables (story 17.07, depends on 17.01 and 17.05) | Schema 3 work would be migrated twice |
| Event store | Extend events.sqlite (stories 18.01 to 18.03) | Event store and canonical sessions consolidation (17.10) | Contract work in 18.01 to 18.03 may be rewritten |
| Backup of the store | Open question 3 | Backup, restore and integrity (17.12) | Question 3 answered by 17.12 |

Parts of this plan that do not depend on the storage choice and stay valid: the premise corrections (02), the DAI comparison and bridge design (03, 04 sections on axes, adapter and bridge), the gates and DoR model (07), the commit trailer and verified SHA approach, the declared / observed / validated distinction, the MVP flow and the test scenarios in 09.

Options [Pending decision, for the user]:
1. Rebase this plan on EP-17: trace facts become tables or audit actions in harness.sqlite after 17.01 and 17.05; Scrum planning fields arrive with 17.07; drop 18.01 to 18.03 and 18.05 as written. Cleanest, but traceability waits for EP-17.
2. Build the MVP now on events.sqlite as written and migrate it in 17.10. Faster, but creates the second audit store that ADR-013 rejects.
3. Split: ship only what needs no new store first (commit trailer plus verified SHA read, DoR gate, draft maturity as a flag on scrum.json), then move the rest onto EP-17.
Recommendation [Hypothesis]: option 3 followed by option 1.

Option 1 is worked out in 11-REALINHAMENTO-EP-17.md.

Decision (user, 2026-11-01): follow the recommendation, option 3 then option 1. Slice A is implemented (08 section 0); 18.01 to 18.03 stay on hold until EP-17 stories 17.01 and 17.05 exist.

## 6. Confidence and blocking risks

Confidence [Hypothesis, judgement]: high (about 80 percent) that option B is feasible with the listed code edits, because every anchor was read; medium (about 60 percent) on the exact size of 18.01 and 18.05, due to F1, F2 and unread consumers; low on anything depending on SP-1 and SP-2 (stages, gates, refinement runs).
Blocking risks: (1) F2 destroying lanes if the migration is not chained; (2) audit rows pruned (F8) if 18.02 is skipped; (3) forgeable `observed` class (F4) if the wrapper is skipped; (4) no authentication makes tier-3 confirmations tamper-evident only; (5) two stores without a distributed transaction (reconciler required, 18.14); (6) trace local and unversioned (`projects/` gitignored) with no backup; (7) DAI present only on the author's machine.

## 7. Instructions for the future PR(s)

Rules: one PR per story (08 s3), code comments follow the language already used in each touched file (mostly Portuguese in `ev/`), no file above ~250-300 lines (split new modules by responsibility), add map rows in the same change (`node tools/mapa.js check`), each PR must pass `npm test`, `npm run check`, `npm run types`. Nothing here authorises commit, push or deploy.

Order and files:

| Step | Files to touch (new = n) | Notes |
|---|---|---|
| 0 | none | run SP-1..SP-8; answer questions 1-6, 9 |
| 1 (18.01) | `ev/event-envelope.js`, `ev/event-migrations.js`, `ev/event-type-allowlist.js` (add `TRACE_TYPES`), `ev/event-store.js` (`readEvents` filter), `tests/event-envelope.test.js` (ext), `tests/trace-contract.test.js` (n) | F1, F12 |
| 2 (18.02) | `ev/event-retention.js`, `tests/trace-retention.test.js` (n) | F8 |
| 3 (18.03) | `ev/trace-ingest.js` (n), `ui/server/controllers/central-events.controller.js` (reject `trace.*` on generic route), `tests/trace-ingest-wrapper.test.js` (n) | F4 |
| 4 (18.04) | `svc/project-scrum-sanitize.js`, `svc/project-scrum-ops.js` (merge at :71, create at :61), `svc/project-scrum-persist.js`, resolver after SP-3, `tests/project-scrum-maturity.test.js` (n) | F5, F6 |
| 5 (18.05) | `svc/project-scrum-migration.js` (chained steps, constant 3), `svc/project-scrum-persist.js` (`sprintHistory`), `tests/project-scrum-migration.test.js` (ext) | F2, F3, F11 |
| 6 (18.06-18.08) | scrum controller and ops for `expectedRevision`, assign-sprint; `tests/project-scrum-concurrency.test.js` (n), `tests/project-scrum-sprint-history.test.js` (n) | split ops if file nears the size limit |
| 7 (18.09-18.11) | `svc/orchestration/workflow-runner.service.js`, `svc/chat-run-telemetry.service.js` (accept ids), collector module (n), `tests/workflow-trace-binding.test.js` (n), `tests/trace-git-collector.test.js` (n), `tests/trace-reconciler.test.js` (n) | SP-1, SP-6 |
| 8 (18.12) | projection module (n), route + controller (n), UI tab in the story drawer (`ui/public/js/modules/design-scrum-story-drawer*.js` or React island per ADR-011), `tests/trace-timeline-projection.test.js` (n), `tests/trace-e2e-mvp.test.js` (n) | UI approach pending ADR-011 |
| 9 | `docs/mapa/**` rows, README/SETUP notes; promote ADR-014 (draft in 05 s10) into `docs/harness-evolution/03-decisions/` only after the user approves and EP-18 is created | do not create epic/ADR files before approval |
