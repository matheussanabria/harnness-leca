# Raw discovery: Git, tests, memory, MAPA, Jira, conventions

Read-only subagent report, 2026-10-31, against a89703c.

## Key facts
- Git runs through shell `spawnSync("git", args, {shell:false})` (tools/lib/opencode-package/worktree.js:13; ui/server/services/deploy/pipeline-runner.service.js). EP-14 story packages create one worktree per story at C:/Temp/hl-<id> with story.branch (worktree.js:2,17); run.js:2 never commits or merges.
- App code never creates commits; commits are manual or agent-made following the commit and conventional-commits skills (orchestration/agent-stage-definitions.js:164). No story trailer convention. No commit-msg hook (.githooks has pre-commit and pre-push).
- scripts/pre-commit.js (1-10) blocks local data (projects/, .env, bridge jsonl), secrets, new files missing from the map, and syntax/JSON errors; it runs affected tests (scripts/lib/affected-tests.js). HARNESS_SKIP_TESTS=1 or doc-only commits skip the tests. It never edits the message.
- Tests: npm test (node --test), check (scripts/check.js), regressao (scripts/regressao.js), types. The only dependency is playwright-core. pre-push runs the full suite. Golden tests: tests/golden/, tests/importers.golden.test.js.
- ui/server/services/audit/test-execution.service.js:1-30 runs `node --test <file>` or `npm test --silent` (30 s timeout, 4000-character cap, allow-list). Whether results are persisted is Unknown. ui/server/services/audit/evidence-detection.js exists (not read).
- Memory: tools/memory.js; projects/<slug>/memory/**.md and global/memory (tools/lib/memory/store.js); one fact per file (ADR-009); frontmatter name, description, type, created, updated, source, hash (tools/lib/memory/item.js:5-17); types user, feedback, project, reference; projects/ is gitignored.
- MAPA: tools/mapa.js find/check/build. Per-area docs/mapa files are authoritative; INDEX and the domain table are derived. pre-commit enforces map coverage of new files.
- Jira: read-only offline snapshot (tools/jira-query.js, jira-refresh.js, export-jira-snapshot.js, tools/lib/jira-redact.js); ADR-008 proposed; no publishing code.
- docs/features/ does not exist; docs/sdlc holds domain specs. No feature-to-story, commit or evidence link.
- Planning convention: docs/harness-evolution/{00-index.md, 02-epics/EP-XX-slug/{README.md, XX.YY-slug.md}, 03-decisions/ADR-NNN-slug.md + README index, 04-test-plans/TP-XX, 05-progress, _templates/{adr,story,test-plan}-template.md}. The last ADR file on this branch is ADR-010. ADR-011 is drafted (untracked) on feat/frontend-foundation for the frontend stack, so the next free number for this work is ADR-012. The next epic is EP-16 (verify against 00-index).
- SQLite: built-in node:sqlite DatabaseSync, ui/server/services/events/event-store.js:10,16, at projects/<slug>/coordination/events.sqlite (ADR-005). agent-activity.service.js:25 also opens a database.
- Atomic write pattern: screen-state/store.js:125-133 (tmp file with wx and 0o600, then rename; rev with 409; history ring of 500). No shared helper in tools/lib.

## Matrix
| Item | Status | Evidence |
|---|---|---|
| Git shell calls | Existing | opencode-package/worktree.js:13 |
| Branch/worktree per story | Existing (EP-14 packages) | worktree.js:2,17 |
| App-created commits | Absent | grep |
| Story trailer in commits | Absent | docs/PLAN-commit-atomico.md |
| commit-msg hook | Absent | .githooks/ |
| pre-commit gates | Existing | scripts/pre-commit.js:1-10 |
| Persisted test result | Absent in hooks; Unknown in test-execution.service | audit/test-execution.service.js |
| Memory CLI and contract | Existing | tools/memory.js, item.js |
| Per-story memory type | Absent (feasible via project items) | item.js:17 |
| MAPA tooling | Existing | tools/mapa.js |
| Jira read-only | Existing | jira-setup map |
| Jira write | Absent | none |
| Feature dossiers | Absent | none |
| Planning structure and templates | Existing | docs/harness-evolution/ |
| SQLite event store | Existing (node:sqlite) | events/event-store.js:10,16 |
| Shared atomic JSON helper | Partial | screen-state/store.js:125-133 |
