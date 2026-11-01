# 03 - Comparativo Harness Leca x DAI

Status: planning only. Basis: Harness a89703c; DAI 7248777 (branch dev, working tree has uncommitted edits unrelated to the pipeline). DAI was read, not run.
Tags: [Fact path:line], [Hypothesis], [Pending decision]. `DAI:<path>` = DAI evidence; plain path = Harness evidence. `svc/` = `ui/server/services/`.
Identity check: this is the repo `matheussanabria/harness-dai` (remote), read from the local path. The name is not matched to any other project by similarity. [Fact raw-dai-pipeline.md header]

## 1. Capability matrix (skeleton of 05-ROTEIRO-ANALISE-DAI.md, filled)

Decision legend: Reutilizar / Adaptar / Criar / Descartar.

| Capacidade | Harness (evidencia) | DAI (evidencia) | Lacuna | Decisao |
|---|---|---|---|---|
| Backlog, rascunhos e sprints | [Fact] stories/sprints/epics in `scrum.json`; backlog = `sprintId` falsy (svc/project-scrum-persist.js:41-42); no draft; new stories default into active sprint (svc/project-scrum-sanitize.js:39); no sprint history or close (svc/project-scrum-ops.js:100-107) | [Fact] no backlog code. Markdown backlog + Notion sync exist for a customer project only (`DAI:memory/projects/57multimarcas/scrum/01-backlog.md`, `DAI:tools/notion-sync/`); `sprint-cycle` workflow active v1.0.0 (`DAI:workflows/sprint-cycle/manifest.yaml:165-166`) | Harness lacks draft state, sprint history, carry-over. DAI has ceremonies as prompt only, with no ids tied to Harness | Adaptar Harness Scrum (add maturity, sprintHistory). Descartar DAI memory backlog as store. Reutilizar `agile-ceremonies` skill text as guidance |
| Refinamento RF/RNF/BDD | [Fact] story fields only title, description, acceptanceCriteria (svc/project-scrum-sanitize.js:27-43); no RF/RNF/BDD fields | [Fact] `01-story.md` template (Como/quero/para que, criteria, RN, NFR, out of scope, open questions) and Gherkin in pt (`DAI:skills/produto/requirements-engineering/workflows/write-story.md`, `references/user-stories.md:8-31`); DoR checklist human-judged (`DAI:.../validation/checklist.md`) | Harness has no structured spec; DAI spec lives in a dossier file with no id link | Reutilizar DAI templates; Adaptar: story keeps pointer `specRef` to dossier file + `specVersion`, not a copy of the text |
| Especialistas por etapa | [Fact] 17 DAI agent names hardcoded + builtin code-review; stage to agent/skill map (svc/orchestration/agent-stage-definitions.js:6-24,60-175); no `.claude/agents` | [Fact] 17 agent folders with AGENT.md + manifest.yaml (`DAI:.agents/`); stage to specialist map (`DAI:docs/SDLC_PIPELINE_DESIGN.md:33-43`, dated 2026-05-27, older than manifest v1.3.0) | Harness copy can drift; roles in DAI inferred from manifest purpose | Reutilizar DAI as source; Adaptar: stop hardcoding, read a pinned snapshot plus drift test |
| Orquestrador de workflows | [Fact] engine with `feature-delivery` and `hotfix`, approval stages, attempts; runs in memory, MAX 200 (svc/orchestration/workflow-definitions.js:17-41; workflow-run-store.js:4-21); runs have no storyId (workflow-run-store.js:45) | [Fact] no runtime; Claude Code session follows prompt, one stage per request (`DAI:skills/orquestracao/sdlc-pipeline/SKILL.md:21,32-37`); manifest states, variants, `max_retries_per_state` 2 (`DAI:workflows/feature-delivery/manifest.yaml:69-71,77-166`) | Harness engine lacks persistence and story binding; DAI lacks any runtime | Adaptar Harness engine (persist run + storyId). Descartar building a second engine. Reutilizar DAI manifest as definition |
| Quality Gates | [Fact] text per stage, no executable checker wired (raw-harness-sprint-workflow.md:24); `tools/lib/hia/quality-gate.js` and `atelier-quality.service.js` not tied to stages | [Fact] 10 gate ids; only `requires` file existence is mechanical; others prose, `approval: user` (`DAI:manifest.yaml:319-397`); scriptable ones: build/lint, test suite, Conventional Commits regex (raw-dai-stories-gates.md:28) | Neither side mechanically verifies; DoD has no global file (`DAI:.agents/00-sdlc-orchestrator-prompt.md:210-211`) | Criar `GateEvaluation` event with command, exit code, SHA; start with 3 scriptable gates; keep human gates as approvals |
| Hooks, agentes e sessoes | [Fact] only UserPromptSubmit hook (`.claude/settings.json`); canonical session registry (svc/canonical-sessions/); chat run events (svc/chat-run-telemetry.service.js:149-153); no PostToolUse, no file capture | [Fact] `dai_guard.py` PreToolUse, fail-open: ask on push/PR/deploy, deny commit on main and secrets; installed to `~/.claude/hooks/dai/` (`DAI:policies/hooks/dai_guard.py`); hooks are lost on non-Claude export (raw-dai-stories-gates.md:36) | No capture of edits or commits outside Harness chat; DAI hook is Claude only and has a JSONL audit with masked target | Reutilizar `dai_guard` as risk guard; Criar optional collectors (git-based, engine-agnostic) instead of relying on hooks |
| Git, testes e rastreabilidade | [Fact] git by spawnSync shell:false (tools/lib/opencode-package/worktree.js:13); worktree per story with story.branch (worktree.js:2,17); no app commits; no trailer; no commit-msg hook; pre-commit runs affected tests, never edits messages (scripts/pre-commit.js:1-10); test-execution service runs allow-listed `node --test` (svc/audit/test-execution.service.js:1-30) | [Fact] `commit-pr` stage with `commit` + `conventional-commits` skills, explicit confirmation each time (`DAI:manifest.yaml:305,317`); no story id in dossier; no tests in repo | No story to commit link on either side; SHA verification absent | Criar: trailer `Story:` (agent-written) + collector verifying SHA by git; Reutilizar worktree-per-story as branch to story link |
| Persistencia e eventos | [Fact] SQLite event store with idempotency, WAL, additive migrations (svc/events/event-store.js:69-70,103-144; event-migrations.js:42-52); closed type allowlist (event-type-allowlist.js:49); retention cap 20000 (event-retention.js:19-25); JSON for Scrum; JSON ledger | [Fact] none; only `Historico` table in `_status.md` (`DAI:docs/architecture/00-metamodelo.md:285`) | Harness has the substrate but no story-scoped event types, no story_id column, no retention class for audit | Reutilizar event store; Adaptar (new types, columns, retention class). Descartar parsing `_status.md` as primary store |
| Memoria compartilhada | [Fact] memory CLI, one fact per file, types user/feedback/project/reference, injected as index (tools/lib/memory/item.js:5-17; ADR-009 aceito); no per-story memory type | [Fact] `policies/memory.md` separates Context, Dossier, Memory; only the main session writes; never PII/secrets; `knowledge-curation` skill (raw-dai-pipeline.md:33) | Dossier and Harness memory are separate and unlinked | Reutilizar both; link by reference only (story memory = project item with `storyId` in body). Descartar copying dossier into memory |
| Autorizacao e seguranca | [Fact] no auth, no RBAC; actor free text (80 chars) (raw-harness-sprint-workflow.md:23,34); redaction exists (tools/lib/redact.js; svc/events/event-sanitizer.js); ingest rejects `trust=declared` (svc/events/event-ingest.js:72) | [Fact] `rules/risky-actions-confirmation.md` (prompt rule; hook is "future enforcement" for commit); `external-systems-read-only.md`; Jira per-item authorization (`DAI:skills/produto/jira-story-publishing/SKILL.md:41-47`) | Neither has identity; DAI rules are prompt-enforced; Harness has no confirmation record that is verifiable | Adaptar: actor object with `verified:false` until auth exists; Reutilizar DAI risky-action list as policy source; Criar confirmation event |

Additional rows not in the skeleton:

| Capacidade | Harness | DAI | Lacuna | Decisao |
|---|---|---|---|---|
| Concorrencia entre agentes | [Fact] ledger claim/lease 120 min keyed by storyId, lock `wx` + stale removal, idempotent events (tools/lib/coordination/reducer.js:49-64; storage.js:35-45); not initialized for harness-leca; Scrum does not consult it | [Fact] documents the same verbs but has no code (`DAI:skills/orquestracao/multi-agent-coordination/SKILL.md:42-74`) | No enforcement tying claim to story edits | Reutilizar ledger; Adaptar: initialize per project, Scrum reads claim as advisory |
| Multi-motor | [Fact] engines claude, codex, opencode v2, 9router (tools/lib/engines/) | [Fact] export_native.py: claude, codex, opencode, antigravity; lossy (raw-dai-stories-gates.md:34-36) | Capabilities per engine not declared anywhere | Criar `engineCapabilities` map in the adapter (hooks Y/N, native session id Y/N) |
| Jira | [Fact] read-only snapshot; no write (tools/jira-query.js) | [Fact] authorized publishing skill (`DAI:skills/produto/jira-story-publishing/`) | Two Jira models | Descartar Jira write in this epic [Pending decision] |

## 2. Reutilizar / Adaptar / Criar / Descartar

| Item | Decision | Why | Risk | Relative effort |
|---|---|---|---|---|
| DAI agents, skills, manifest as definition source | Reutilizar | Addendum item 1: no second SDLC pipeline | Harness cannot read DAI at runtime unless path is configured [Pending decision] | S |
| Harness orchestration engine | Adaptar | Already mirrors DAI stages; needs persisted runs, storyId, attempt events | Engine behaviour of runner unknown | M |
| Harness event store (`events.sqlite`) | Adaptar | Idempotent, additive migrations, WAL | Retention deletes audit; closed allowlist; parity test between alias and allowlist | M |
| `scrum.json` + services | Adaptar | Preserve data, lanes, `lanesRevision` (addendum item 5) | Whitelist drops unknown keys silently (svc/project-scrum-persist.js:78-100) | S |
| Coordination ledger (ADR-007) | Adaptar | Claim/handoff by storyId already built | Must be initialized; JSON, not SQLite | S |
| Canonical sessions + chat run telemetry | Reutilizar | runId minted before spawn (ADR-TEL-003) | Only chat runs are covered | S |
| DAI story/BDD templates, DoR checklist | Reutilizar | Mature text assets | pt-BR keywords; human-judged | S |
| DAI `_status.md` parser | Criar (read-only, optional) | Evidence for sessions run outside Harness | Fragile: no frontmatter, no ids | M |
| Scrum `maturity` + `sprintHistory` | Criar | Absent today | Migration of old stories | S |
| `trace.*` event types, `story_id`/`implementation_id` columns | Criar | Absent today | Contract is "frozen" for trust values; allowlist closed | M |
| Git evidence collector (SHA verify, trailer parse) | Criar | No link today | Rebase/cherry-pick change SHA | M |
| Gate evaluator for 3 scriptable gates | Criar | Gates are text | Test result persistence unknown | M |
| Pending-link (orphan) list + reconciler | Criar | Orphans have no home | Policy decisions | S |
| Second workflow engine / duplicate DAI workflows in Harness | Descartar | Divergence of gates and specialists | - | - |
| Parsing `_status.md` as the audit store | Descartar | Not transactional, no ids | - | - |
| DAI memory-backed customer backlog as Harness store | Descartar | Customer project data, markdown, Notion | - | - |
| DAI legacy `harness/cli.py`, `orchestration/feed.md` | Descartar | Marked legacy | - | - |
| New Kanban lanes (Impedimento etc.) | Descartar | Lanes already mix axes; addendum says do not force new lanes | - | - |

## 3. Responsibilities matrix Scrum / DAI / runtime

"Runtime" = Harness orchestration engine plus event store plus collectors. DAI has no runtime of its own. [Fact DAI repo]

| Responsibility | Scrum (Harness) | DAI | Runtime (Harness) |
|---|---|---|---|
| Intake, draft, maturity, priority | Owns (persisted) | Supplies refinement skills and templates | Emits `trace.link.*` events |
| Sprint planning, assignment, history, capacity | Owns | `agile-ceremonies` guidance only | Reads assignment to decide eligibility |
| Lane (visual state), impediment, `lanesRevision` | Owns | None | Proposes lane via projection; never writes lane without a valid transition |
| Workflow definition, variants, stages, gates (text) | Reads | Owns (manifest, SKILL, rules) | Loads pinned snapshot |
| Specialist selection per stage | Shows | Owns mapping | Resolves and launches via engine adapter |
| Stage execution, attempts, retries | Shows | Defines `max_retries_per_state` | Owns; persists as events |
| Gate evaluation, evidence | Shows status | Defines gate criteria | Evaluates scriptable gates; stores evidence |
| Human approval | Stores decision (actor object) | Requires it (`approval: user`, `requires_confirmation`) | Blocks stage until recorded |
| Commit / PR / deploy | Shows | Requires explicit confirmation each time | Never executes without confirmation event (rules: only prepare) |
| Claim / concurrency | Advisory read | Documents verbs | Ledger owns claim; Scrum owns story revision |
| Session, engine, run identity | Shows | Not applicable | Owns (`runId`, `workflowRunId`, `attemptId`) |
| Audit trail | Shows timeline | `_status.md` Historico as declared evidence | Owns append-only events |
| Memory | Not involved | `policies/memory.md` | Memory CLI per project |
