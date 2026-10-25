# T4.1a spike findings: real Skill/Task block shapes and correlation

Status: spike output, 2026-10-25. Read-only analysis of stored Claude Code transcripts; no engine was run and no transcript text was read.
Source: `.scratch/shape.json` from `.scratch/t41a-shape.js` over 1502 transcript files (179 subagent files, 78256 lines, 0 bad lines). Answers Q2, Q3 and risk 1 of `08-t41-workflow-instrumentation-design.md`.
Legend: verified-in-data = key/count in shape.json or in repo code read for this spike; documented = stated by repo docs; assumption = not shown by this data.

Naming finding: in these transcripts the subagent tool is named `Agent`, not `Task`. `toolUse` is Agent 70 and Skill 1; `Task` appears in none of the 1502 files. The collector counts both names in `taskUses`, which is 70, all Agent.

## a) Tool blocks

- tool_use counts: Agent 70, Skill 1, Task 0.
- toolUseKeys Agent: `type`, `id`, `name`, `input`, `input.description`, `input.subagent_type`, `input.run_in_background` (56), `input.prompt`, `input.model` (31), `caller`, `caller.type`.
- toolUseKeys Skill: `type`, `id`, `name`, `input`, `input.skill`, `caller`, `caller.type`.
- toolUseInputKeys Agent: description 70, subagent_type 70, run_in_background 56, prompt 70, model 31. Skill: skill 1.
- tool_result counts: Agent 64, Skill 1. Keys Agent: `tool_use_id`, `type`, `content`; Skill: `type`, `tool_use_id`, `content`.
- is_error: the key is absent in every result (`Agent:undefined` 64, `Skill:undefined` 1). No result is explicitly marked as an error, and absence cannot be read as success without a second signal.
- content type: Agent `array` 64, Skill `string` 1.
- Result-side `toolUseResult`: present in 55 of 64 Agent results and 1 of 1 Skill result. Skill has `success` 1 and `commandName` 1; Agent has `status`, `prompt`, `agentId`, `resolvedModel`, `canContinueAgent` (55), `isAsync` 54, `description` 54, `outputFile` 54, plus one synchronous completion with `usage`, `totalTokens`, `totalDurationMs`, `totalToolUseCount`, `toolStats`.
- skillNames: `epic-evolution-architect` 1. Unsafe/omitted names: 0.

## b) Subagent linkage

- taskUses 70; taskWithAgentId 55; taskAgentFileFound 55; taskAgentFileMissing 0.
- toolUseResultKeys: `agentId` 55, `outputFile` 54, `isAsync` 54, `canContinueAgent` 55, `resolvedModel` 55.
- metaFiles 179 (equal to subagent files). metaKeys: `agentType` 179, `description` 178, `toolUseId` 178, `spawnDepth` 179, `requestShape` 166, `requestNonInteractive` 166, `launchedWithDefaults` 33, `parentAgentId` 4, `finished` 48, `model` 24.
- Join chain: `tool_use.id` -> `tool_result.tool_use_id` is exact; then `toolUseResult.agentId` -> subagent file base resolved in 55 of 55 cases, 0 missing.
- Resolved 55/70 uses = 78.6%; unresolved 15/70 = 21.4% (9 results carry no `toolUseResult`, 6 uses have no result line at all).
- Exactness caveat: the collector matched `agentId` by substring against all subagent file names, so 55/55 is an upper bound, not proof of exact filename equality. `meta.toolUseId` (178/179) is the cleaner strict candidate key, but whether it equals the spawning tool_use id was not cross-checked: undetermined.
- `agentId` also appears at result top level in 4 lines (`resultTopKeys Agent:agentId` 4).

## c) Resume and sessionId (Q2)

- sessionIdFiles: onlyOwn 1323, hasOthers 179, noSessionId 0; filesWithManySessionIds 0.
- Interpretation: 1323 files contain exactly their own sessionId (file base = sessionId). The 179 `hasOthers` files are exactly the subagent files: each contains one sessionId, the parent session, while its file base is the agent file name, not a session id. No file in the sample contains two distinct session ids.
- Implication: the observation rules out silent id mixing inside one file, but it cannot distinguish "resume keeps the id and appends to the same file" from "resume starts a new file with a new id". Both produce this result.
- A usage join by nativeSessionId still works file by file under either behaviour, but the design's "keep the first id only" rule (section 4.5) is not proven safe if a resumed conversation reports a new id.
- Verdict: undetermined whether `--resume` keeps `session_id`; confidence low for "it keeps it".

## d) Live stream versus transcript ids (part of Q3)

- Transcript side: msgIdPresent 17203, msgIdMissing 5506 among assistant lines that have a message object. `message.id` is therefore not universal in the stored form.
- `tools/lib/engines/claude.js`: `createClaudeStreamParser` reads `d.message.id` with fallback `evt<events>` only to build the dedup key (claude.js:160-162). It never emits that id in `onChunk` (text/thinking/result carry only text and sessionId).
- tool_use is ignored today: the parser handles only `c.type === "text"` and `"thinking"` (claude.js:163-174) plus the `result` line (claude.js:177-187), so no tool name, block id or input-derived name reaches the caller.
- Equality between the stream `d.message.id` and the transcript message id (usage `callId`) is UNVERIFIED: no stream was captured, and stored transcripts cannot prove it.
- Zero-quota experiment: build a fixture test that replaces the Claude binary with a fake executable (or injects a fake child stdout) which replays one real transcript assistant line unchanged as stream-json; extend the parser with a test-only sink for `onToolUse`; assert the transmitted `messageId` equals that line's `message.id`; replay the matching user line with its `tool_result` to settle resultOk. Expect no engine call and no quota.

## e) Corrections to the design doc

| Assumption in 08 | Status | Evidence |
|---|---|---|
| Parser handles only text, thinking and result blocks (section 5) | verified-in-data | claude.js:159-187 |
| Generic tool_use shape is `name`, `id`, `input` (section 5) | verified-in-data | plus `caller.type`; Agent adds `model` and `run_in_background` |
| The subagent tool is called Task (section 5, 10) | contradicted, verified-in-data | Agent 70, Task 0 |
| For Task only `subagent_type` is needed (section 5) | verified-in-data | subagent_type 70/70; model 31 and run_in_background 56 also present |
| Skill name comes from the tool input (section 5) | verified-in-data | `input.skill` 1/1 |
| Missing `is_error` on the matching tool_result means resultOk (section 5) | contradicted, verified-in-data | `is_error` absent in all 65 results; Skill has `toolUseResult.success` 1, Agent has `status` 55 |
| Link of a Task block to a specific agentId is [A] (section 5) | resolved, verified-in-data | `toolUseResult.agentId`, 55/70 uses, 55/55 files (substring caveat) |
| `--resume` may change `session_id`; tracker keeps the first (4.5, Q2) | assumption | no mixed-id file; data cannot decide |
| `d.message.id` equals usage `callId` (section 5) | assumption | unverified; 5506 transcript assistant messages lack an id |
| Live stream-json Skill/Task shape equals transcript shape (Q3) | assumption | only transcripts were inspected; no live stream captured |
| Two Skill blocks on one call can share one cost (section 5) | assumption | only 1 Skill block in the sample |
| Subagent usage carries parent sessionId and agentId on sidechain lines (section 2) | verified-in-data | sidechainLines 28626; metaFiles 179; agentId 55 |
| Unit test uses a bare `{type:"tool_use"}` (section 5) | documented | design 08 states it; not re-read here |

## f) Recommended minimal capture plan

T4.1b (parser callback):
1. Add `onToolUse({id, name, messageId, skillName?, subagentType?, model?, runInBackground?})`; whitelist only these fields, never prompt/description/content.
2. Accept `Agent` and `Skill`; keep `Task` as an alias for older CLIs.
3. Dedup by `block.id`, not by `messageId:index`, and keep the existing SSE contract unchanged.
4. Pass `messageId` from `d.message.id`; emit null when absent instead of the `evt<events>` fallback so a callId is never fabricated.
5. Also parse user-type lines for `tool_result` by `tool_use_id`: absent `is_error` means not-error, not success; for Skill prefer `toolUseResult.success`.

T4.1c (attempt model):
6. The attempt model has no dependency on tool shape; keep it additive as designed.
7. Persist `agentId`, `subagentType` and `tool_use.id` when present; the unresolved 21.4% stays unknown, never zero.
8. Keep every observed session id per run (not only the first) until a real resume settles Q2.
