# Spikes SP-1 and SP-2: findings (read-only)

Date: 2026-11-02. Method: reading source only. Nothing was run; the DAI repository was not modified and no export script was executed.
Evidence tags: [Verified] = read in the cited lines; [Inference] = conclusion drawn from verified facts.

## SP-1: does the workflow runner launch agents?

**Answer: no.** `workflow-runner.service.js` only records state; it never starts an agent, process or model call.

Evidence [Verified]:
- `startWorkflowRun` (`ui/server/services/orchestration/workflow-runner.service.js:44-118`) builds a plan, writes a run record, emits `execution.started` and one `task.created` per stage, and requests approval when the current stage needs it. It spawns nothing.
- `advanceWorkflowRun` (same file, `:144-228`) is a state machine. A caller reports `started`, `progressed`, `completed`, `blocked` or `failed` for the current stage; the runner validates order and approvals and emits the matching `task.*` event. The stage never "runs" inside the runner.
- No `child_process`, `spawn`, `exec` or `execFile` appears under `ui/server/services/orchestration/`, nor in the orchestration controllers and routes (grep returned no match).
- The only callers of `advanceWorkflowRun` are `orchestration-workflow-runs.controller.js` (`POST /api/orchestration/workflow-runs/:executionId/advance`, loopback only) and the browser modules `design-workflows.js` and `design-workflows-api.js`. Progress is therefore reported by a human in the UI or by a script/agent calling the route.
- `routine-runner.service.js` `runRoutine` (`:92-117`) only calls `startWorkflowRun` with an idempotency key. No launch there either.
- The four adapters (`claude`, `gemini`, `opencode`, `services`) are passive observers: they read engine session files, the OpenCode SQLite DB and the process manager, and convert what they find to `execution.*` events. None sends a prompt.
- The optional `sessionId` on `advance` is stored as `declaredSessionId` on the open attempt (`workflow-attempt.service.js:93-103`), labelled "declared, engine-reported". Harness does not verify it.

Consequences [Inference]:
- This is the negative case already anticipated in doc 08 section 6: 18.16 and 18.18 shrink to recording externally launched sessions and stage results, with evidence class `declared` unless a collector proves otherwise. The MVP (18.01-18.12) is unaffected.
- Any `trace.run.*` fact derived from `advanceWorkflowRun` is a claim made by the caller. Observed evidence has to come from git (18.11) and test collectors (18.13), not from the runner.
- 18.09 can stamp `storyId` on `startWorkflowRun` and on `advance` bodies without changing any launch path, because there is none.
- A real "run this stage with the agent" feature would be new scope (a launcher), not an extension of the runner. That is a product decision for the EP-17 owners.

## SP-2: does the DAI export inject workflows into the engines' config?

**Answer: not into engine configuration. Workflows travel as files, in two shapes, and no Harness code reads `manifest.yaml`.**

Evidence [Verified], in the DAI repo (read-only):
- `scripts/export_native.py:33-41, 68-70`: each `workflows/<id>/` that has both `manifest.yaml` and `WORKFLOW.md` becomes a skill `dai-workflow-<id>` (`SKILL.md` = frontmatter + `WORKFLOW.md`, plus a copy of `manifest.yaml`) under `dist/<engine>/skills/`. `sync` mirrors that folder into `~/.claude/skills`, `~/.codex/skills`, `~/.config/opencode/skills` and `~/.gemini/antigravity/skills` (`:11-16, 78-86`). These skills appear in the session skill list, which agrees with the code.
- `scripts/export_claude_code.py:190-222`: when a skill's own `manifest.yaml` lists `how.workflows_ref`, the workflow's `manifest.yaml` and `WORKFLOW.md` are copied into `<skill>/workflows/global/<id>/`, so the skill is self-contained when installed under `~/.claude/skills`.
- The only engine-config write in either script is `install_hooks` (`export_claude_code.py:326-347`), which edits `~/.claude/settings.json` to register `dai_guard.py` as a PreToolUse hook; it concerns security hooks, not workflows. `export_native.py` passes `--no-hooks` to it (`:80`).
- No script resolves `manifest.yaml` at runtime. The file is copied next to `SKILL.md`; whoever reads the skill (the engine or the model) decides what to do with it. `read_value` and `read_rules_ref` are line-based text readers used at export time only.
- In Harness, `grep manifest.yaml` over `ui/`, `tools/` and `scripts/` finds nothing. Stage order, write stages and approval stages are hardcoded in `workflow-definitions.js` and `agent-stage-definitions.js` (`:1-12`).

Consequences [Inference]:
- The DAI workflow definition is not available to Harness at runtime. Harness has its own hardcoded copy of the stages, which can drift from `workflows/<id>/manifest.yaml`. This confirms the premise of 18.17 (pinned manifest snapshot plus a drift test).
- A snapshot has to be taken by reading the DAI source files directly (a path setting or a vendored copy), because nothing exported to `~/.claude` or `dist/` is a stable contract for Harness: `export_native.py` rewrites `dist/<engine>` with `rmtree` on every run.
- The postponed `_status.md` header in DAI depends on a consumer that reads workflow files; today the consumer is the model reading `SKILL.md`, not code. That supports keeping the DAI side untouched until 18.17 defines a reader.

## Safety notes for whoever continues

- Never run `export_native.py` or `export_claude_code.py` with default flags: both sync into the user's home (`~/.claude`, `~/.codex`, and others) and the second also edits `~/.claude/settings.json` unless `--no-hooks` or `--no-sync` is passed. `--dry-run` is the only read-only mode.
- For a Harness-side drift test, read `DAI/workflows/*/manifest.yaml` directly with `fs`, never through the exporters.

## Open questions this leaves for the EP-17 owners

1. Is a stage launcher (Harness starts the engine for a stage) in scope for EP-17, or does Harness stay an observer and recorder?
2. Which source does Harness pin for the DAI manifests: a configured DAI path, a vendored snapshot, or neither (question 5 of doc 10)?
