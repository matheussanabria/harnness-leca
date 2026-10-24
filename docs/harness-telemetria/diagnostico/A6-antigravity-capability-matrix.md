# A6 - Antigravity CLI (agy) capability matrix for telemetry (study T3.5, 2026-10-24)

Legend: D = documented (official page), O = observed locally (structure only, no content read), U = unknown / not found, T = third-party doc (not official).
Doc sources (fetched today). AG = https://antigravity.google/docs
- GM = https://geminicli.com/docs/cli/telemetry/ (banner: "Gemini CLI was replaced by Antigravity CLI on June 18th, 2026"; no Antigravity telemetry page is linked)
- BL = https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli (announcement, 2026-05-19; CLI is Go, shares the harness with Antigravity 2.0 desktop; skills, hooks, subagents, extensions-as-plugins carry over; no 1:1 parity at launch)
- MIG = AG/cli/gcli-migration/ ; INS = AG/install/ ; REF = AG/cli/reference/ ; HL = AG/cli/headless/
- HK = AG/hooks/ ; SUB = AG/subagents/ ; CONV = AG/cli/conversations/
- SZ = https://signoz.io/docs/antigravity-cli-monitoring/ (T) ; DT = https://www.dynatrace.com/hub/detail/antigravity/ (T, about the Python SDK, not agy)
- Pages named in the MIG nav but NOT fetched: AG/cli/commands/resume/, AG/cli/modes/, AG/plugins/, AG/skills/, AG/cli/troubleshooting, AG/cli/commands/agents/. Upstream issue tracker: github.com/google-antigravity/antigravity-cli (not fetched; SZ cites #366 as an open request for native OTLP).

## 1. Local detection

| Item | Result | Notes |
|---|---|---|
| `agy` binary | MISSING | Not on PATH (`where agy` empty). No `~/.gemini/antigravity-cli/` directory exists, so the CLI has never been installed or run on this machine. |
| `antigravity` on PATH | MISSING | `where antigravity` empty. |
| Antigravity IDE (Electron, VS Code base) | INSTALLED | `%LOCALAPPDATA%\Programs\Antigravity IDE\` (bin has `antigravity-ide` and `antigravity-ide.cmd`, and that bin dir IS on PATH). `antigravity-ide.cmd --version` prints three lines: `1.107.0`, a 40-hex commit, `x64` (the VS Code base version, not an agy version). |
| Older Antigravity app | INSTALLED | `%LOCALAPPDATA%\Programs\antigravity\` (Antigravity.exe, Electron resources); no CLI inside. `%APPDATA%\Antigravity` holds Electron caches. |
| IDE extensions tree | O | `~/.antigravity-ide/extensions/` (VS Code extensions incl. `openai.chatgpt-*` that A5 uses for Codex) and a stale `~/.antigravity/extensions/`. No Google/Gemini/agy extension there. |
| Data tree | O | `~/.gemini/antigravity-ide/` (IDE: `brain/` 461 dirs, `conversations/` 533 `.pb`, `knowledge/`, `skills/`, `mcp_config.json`, `plugins/`, `user_settings.pb`), `~/.gemini/antigravity/` (second runtime: `brain/`, `conversations/` 116 `.pb`, `agents/dai-agent-*`, `bin/agentapi.bat`, `conversation_summaries.db` sqlite, `presence/`, `plugin_data/`), `~/.gemini/config/` (`config.json`, `mcp_config.json`, `agents/*.md`, `skills`, `rules`, `plugins`, `sidecars`, `projects`), `~/.gemini/antigravity-backup/`. |
| Telemetry config | none | No `~/.gemini/config/hooks.json`, no `~/.gemini/settings.json`, no `~/.gemini/antigravity-cli/settings.json`. No `OTEL_*`/`GEMINI_TELEMETRY_*`/`AGY_*` process env keys were checked beyond A5's finding (none). |

Conclusion: the agy CLI is not installed. Everything in section 2 for the CLI is documentation only (D) or third party (T). The IDE is installed and its on-disk "brain" is what the repo already reads (section 3).

## 2. Matrix (Antigravity CLI `agy`)

| Capability | Status | Detail | Source |
|---|---|---|---|
| Presence | O (IDE) / U (CLI) | Process/lock presence of agy unknown. IDE tree has `~/.gemini/antigravity/presence/` (contents not inspected, purpose undocumented). Safe presence signal today: `where agy` / `agy --version` (version flag itself not documented, see section 6). | local |
| Activity states (turn level) | D | stream-json `step_update.state` = `ACTIVE`/`DONE`; `step_type` observed `user_input`, `agent_response`, `tool`, `checkpoint`. Final `status`: SUCCESS, ERROR, CANCELED, INTERRUPTED, INVALID, WAITING, RUNNING. Hooks give coarse loop state: PreInvocation/PostInvocation per model pass, `Stop` with `fullyIdle` (bool) and `terminationReason`. | HL, HK |
| Subagent lifecycle states | D | Running, Idle, Killed (docs); `/agents` panel lists running, done, killed, error. No documented event stream for these, only via `subagent_info` in `step_update`. | SUB |
| Tokens: input/output | D | headless `json` envelope and `result` event: `usage.input_tokens`, `usage.output_tokens`, `usage.total_tokens`. In stream-json each `step_update` also carries `usage`. In multi-turn stdin mode `usage`, `num_turns`, `duration_seconds` are cumulative per session, `response` is per turn. | HL |
| Tokens: cache | D | `usage.cache_read_tokens`. No cache-write/creation field documented. | HL |
| Tokens: reasoning | D | `usage.thinking_tokens`. | HL |
| Tokens in hooks | U | Hook payload has no usage fields (HK list; SZ states the same). | HK, SZ |
| Tokens in IDE brain transcript | O | `transcript.jsonl` rows have keys step_index, source, type, status, created_at, content, truncated_fields, tool_calls, exit_code, error, error_code, thinking. No usage/token key in any row of the newest session. | local |
| Cost | U | No cost/USD field anywhere in docs. Quota, not cost: `agy -p /usage --output-format json` returns `command.data.groups[].buckets[]` with `id`, `window`, `remaining_fraction`, `reset_time` (documented only via SZ). `/credits` and `useG1Credits` exist (REF) without a data schema. Cost must be computed from tokens x a price table the harness owns, or reported as quota fraction. | SZ (T), REF |
| Tool calls | D | stream-json `step_update` with `step_type: tool`: `tool_name`, `tool_info{name,parameters,output,error{type,message}}`, `duration_seconds`. Hooks: PreToolUse/PostToolUse payload `toolCall{name,args}`, `stepIdx`, optional `error`. IDE transcript O: `tool_calls[]` with `name` and `args`; step types include VIEW_FILE, GREP_SEARCH, RUN_COMMAND, CODE_ACTION, LIST_DIRECTORY. | HL, HK, local |
| Subagents / parent-child | D | Parent calls tool `invoke_subagent` (also `define_subagent`; built-ins `research`, `browser`, `self`). Each agent has its own conversation id. stream-json `step_update.subagent_info.subagents[]`: `type_name`, `role`, `conversation_id`, `log_uri`, `workspace_uris`. Nesting max 10 levels. Subagent transcripts persist as JSONL. Explicit parent id field: U (parent is implied by the step carrying `subagent_info`). | SUB, HL |
| Subagent in IDE brain | O | Repo adapter detects `invoke_subagent`/`browser_subagent` in `tool_calls` with `args.TaskName`. | local |
| Skills | D | Workspace `.agents/skills/`, global `~/.gemini/antigravity-cli/skills/`; skills act as slash commands; `--disable-slash-commands` turns expansion off in print mode. A skill-invoked event/field: U. | MIG, REF |
| Session / conversation ids | D | `conversation_id` in json envelope, every `step_update`, and every hook payload as `conversationId`. IDE brain dir name is a UUID and equals the conversation. `/fork` allocates a new id. | HL, HK, local |
| Resume | D | `-c/--continue` (most recent, scoped to cwd), `--conversation <id>`, `/resume` picker, `/fork`. There is no way to pre-assign a conversation id (not documented). | HL, REF, CONV |
| Trace propagation | U | No W3C `traceparent`/`TRACEPARENT`/`OTEL_*` env handling documented. SZ derives a trace id from `conversationId` inside its own hook script (not agy behavior). GM-style `GEMINI_TELEMETRY_*` env: not documented for agy. | SZ |
| Native telemetry / transport | U | REF: "Enable Telemetry" in `/config` is stored with the account, not in settings.json; what it exports and where is undocumented. SZ: no built-in OTLP exporter, request #366 open. DT concerns the Python SDK (opt-in hooks to OTel), not agy. | REF, SZ, DT |
| Transport options usable today | D | (a) headless stdout `json`/`stream-json` NDJSON; (b) hooks (command, JSON on stdin, JSON on stdout); (c) local files (hooks `transcriptPath`, CLI log). No OTLP/outfile for agy documented. | HL, HK |
| Auth | D | OS keyring OAuth (tokens moved to keyring on first onboarding, browser sign-in), remote SSH OAuth (paste code), Gemini API key (`modelProvider: "gemini"` in `~/.gemini/antigravity-cli/settings.json` plus `GEMINI_API_KEY`), ADC (`gcloud auth application-default login` plus `AGY_ADC_AUTH=true`), Gemini Enterprise/WIF. Headless needs prior interactive login or an API key; otherwise exits with "authentication required". | INS, HL, REF |
| Control: send | D | Headless `-p "<prompt>"`; streaming input `--input-format stream-json` with lines `{"event":"user","message":{"content":"..."}}` (text blocks only); `-i` interactive with initial prompt. Flags: `--model`, `--effort`, `--agent`, `--mode`, `--add-dir`, `--project`, `--json-schema`, `--print-timeout`, `--dangerously-skip-permissions`, `--sandbox` (v1.4.4+), `--log-file`. | HL, REF |
| Control: cancel | partly D | SIGINT yields status INTERRUPTED. Status CANCELED exists. stdin `control_request`/`control_response` events exit code 2 (not supported in print mode). `--remote-control` flag exists (semantics undocumented). Subagent kill: UI `k` / "Stop Subagent". No documented cancel message over stream-json. | HL, REF, SUB |
| Exit codes | D | 0 success (also permission soft-denial), 1 failed run or bad stdin, 2 control events or CLI-handled slash command. | HL |
| Permissions in headless | D | Shell defaults to Ask and is soft-denied in headless unless allowed in `permissions.allow` (`~/.gemini/antigravity-cli/settings.json`), e.g. `command(git)`. | HL |
| Hooks (extension point) | D | Six events: SessionStart, PreToolUse, PostToolUse, PreInvocation, PostInvocation, Stop. Common stdin: `conversationId`, `workspacePaths`, `transcriptPath`, `artifactDirectoryPath`, `modelName`. Config: `.agents/hooks.json` (workspace) and `~/.gemini/config/hooks.json` (global), also plugin `hooks.json` (CLI only). Handler `{type:"command", command, timeout(s, default 30)}`. PreToolUse requires stdout `decision`; Stop requires `decision`. No env vars passed to hooks are documented. | HK |
| Local files carrying usage (CLI) | U | `~/.gemini/antigravity-cli/cli.log` (T, path from SZ; REF says no default is documented). Conversation store location for CLI: U (CONV says a "directory-scoped session cache"). | SZ, CONV |
| Local files carrying usage (IDE/app) | O | `~/.gemini/antigravity*/brain/<uuid>/.system_generated/logs/transcript.jsonl` and `transcript_full.jsonl` (no usage keys); `~/.gemini/antigravity*/conversations/<uuid>.pb` (protobuf, opaque); `conversation_summaries.db` (sqlite, schema not inspected); `agyhub_summaries_proto.pb`. Whether the CLI shares these stores with the IDE: U. | local |
| Windows support | U | INS does not list Windows install steps (only `--skip-aliases`, `--skip-path` script flags). The IDE runs on Windows 11 here; native agy.exe availability unconfirmed. | INS |

## 3. How the repo touches Gemini/Antigravity today (read only)

- Engine `tools/lib/engines/gemini.js` (125 lines): never spawns a CLI. With `GEMINI_API_KEY`/`GOOGLE_API_KEY` from `global/.env` it POSTs to `generativelanguage.googleapis.com/v1beta/models/<m>:streamGenerateContent?alt=sse` (key in header); session id is a UUID kept by the browser. Without a key it appends a `{id,data,slug,prompt,status}` line to `bridge/gemini-inbox.jsonl`. The catalog (`tools/lib/engines/catalog.json`, id `gemini`, default `gemini-3.8-flash`) and `tools/lib/coordination/config.js` (alias `antigravity` -> `gemini`) map the name.
- Compare Claude/Codex engines: `claude.js` and `codex.js` use `cp.spawn(bin, args, {cwd, shell:false, windowsHide:true, ...})`; `tools/lib/codex-bin.js` resolves the Codex binary from the Antigravity IDE extension folder. There is no agy resolver yet.
- Passive readers: `ui/server/services/orchestration/adapters/gemini-adapter.js` (156 lines) scans `~/.gemini/antigravity-ide/brain/*/.system_generated/logs/transcript.jsonl`, treats a file modified in the last 5 min as active, tails the last 20 rows for `tool_calls` and `invoke_subagent`; `ui/server/services/agent-activity.service.js`, `tools/sync.js`, `tools/lib/sync-core.js`, `tools/import-gemini-chats.js` use the same brain path. Note it reads only `antigravity-ide/brain`, not `~/.gemini/antigravity/brain` where a second runtime also writes.
- `tools/lib/export/gemini.js` and `tools/export-context.js` write a Knowledge Item and global rule under `~/.gemini/antigravity-ide/knowledge`. `projects/antigravity-llm/` has only `chats/` (2 files), `context/extraido-*.md` (5), `instructions.md`, `memory.md`, `extraction-state.json`, `scheduled/`.
- Correlation options if the repo spawns agy: no env var is documented for trace/correlation; use (1) `--conversation <id>` for resume, (2) an harness-side map from the harness `executionId` to the `conversation_id` read from the first `init`/`step_update`, (3) a project `.agents/hooks.json` whose command receives a correlation key from a file the harness writes (hooks get no documented env), (4) `--log-file <path>` to pin a per-run log, (5) `--project`/`--add-dir` for scoping. Whether the spawned process inherits the parent env into the hook command: U (must test).

## 4. Windows caveats

- Hook `command` is a "shell command"; which shell on Windows (cmd, PowerShell, bash) is undocumented. Quote paths with spaces (`Antigravity IDE`, user profile) and test a `node script.js` form first.
- The CLI log default path is undocumented; `--log-file` avoids the guess. Secrets: tokens live in the OS keyring (Windows Credential Manager) so no token file should be read; do not read `settings.json` values except key names.
- Spawn with `shell:false, windowsHide:true` and an absolute `agy.exe` path; the installer may add PATH/aliases (`--skip-path`, `--skip-aliases`), so PATH in the Node server may be stale until restart.
- `.pb` and sqlite stores are locked by the running IDE (`-shm`/`-wal` present): read copies or use read-only open; JSONL transcripts are append-only and safe to tail.
- Two coexisting trees (`antigravity` and `antigravity-ide`) and a legacy `~/.antigravity`: any scanner must handle both, and CRLF in transcripts/NDJSON (use `trimEnd` per line).
- `--sandbox` (terminal containment) availability on Windows: U.

## 5. Recommended adapter approach

1. Treat `agy` as a headless child process like Claude/Codex: `agy -p <prompt> --output-format stream-json [--conversation <id>] [--model] [--effort] [--agent] --log-file <runDir>\cli.log`, spawn with `shell:false, windowsHide:true`. Parse NDJSON: `init` -> execution.started; `step_update` (state, step_type, tool_info, subagent_info, usage) -> activity, tool calls, subagent tasks; `result` -> final tokens (input, output, thinking, cache_read) and status. Cancel = SIGINT / process kill, record status INTERRUPTED. Map to the existing event contract with `confidence: "explicit"` for stream fields.
2. Tokens/cost: use `usage` from `result` (cumulative) and store per-turn deltas; compute cost in the harness from a price table (no cost field exists); optionally poll `agy -p /usage --output-format json` for quota fraction (T source, verify).
3. Optional enrichment: install a project-level `.agents/hooks.json` with passive PostToolUse/PostInvocation/Stop hooks that append the stdin JSON to a harness-owned NDJSON file (stdout must be `{}`; never register PreToolUse, whose `decision` changes permissions). This also covers interactive/IDE sessions, where stream-json does not exist.
4. Keep the current passive brain reader as the fallback for IDE sessions, mark it `confidence: "observed"`, and add the second root `~/.gemini/antigravity/brain`. Do not parse `.pb`.
5. Do not wait for native OTLP; if it ships, switch the transport and keep the same event mapping.
6. Gate everything behind a presence probe (`agy` resolvable and `--version`/`--help` OK); otherwise report the engine as not installed (today's state).

## 6. Unknowns and how to find out

| Unknown | How to find out |
|---|---|
| Real install/version command, Windows binary name and location, `agy --version` flag | Read AG/install/ quickstart and AG/cli/troubleshooting; then install in a scratch profile and run `agy --help`, `agy --version`. |
| Does `/config` "Enable Telemetry" export anything, to where | Read AG/cli/using/ and the repo issue #366 on github.com/google-antigravity/antigravity-cli; observe network/files with the option on in a scratch account. |
| Env var passthrough to hooks and spawned tools; trace context support | Run a hook that dumps `process.env` keys (names only) under a scratch workspace. |
| Hook shell on Windows | Same test with a command that prints `$0`/`%COMSPEC%`. |
| Exact stream-json field names beyond HL (parent id, subagent state events, skill events, per-step usage semantics: delta or cumulative) | Capture one real `--output-format stream-json` run with a subagent and a skill; diff against HL. |
| CLI conversation store location and relation to `~/.gemini/antigravity*/brain` | After one run, list new dirs/files under `~/.gemini` by mtime (names only). |
| `conversation_summaries.db` and `.pb` schema, `presence/` meaning | Open a copy read-only, `.schema` only; no row content. |
| AG/hooks `PostInvocation` token data, `usage` per invocation | Capture hook payload keys in the scratch run. |
| Cancel over the wire (`control_request` support, `--remote-control`) | Read AG/cli/modes/ and the remote-control docs; test exit code 2 behavior. |
| Cost / credits data (`/credits`, `useG1Credits`, `/usage` JSON) | Run `agy -p /credits --output-format json` and `/usage` in the scratch account. |
| SZ and codelab claims (third party) | Verify each against a live agy before depending on them. |

## 7. Blocking questions for the user

1. Is installing the agy CLI (scratch Google profile, no production account) on this machine allowed so the unknowns above can be measured, or should the adapter be built from docs only?
2. Which auth should the harness use for agy headless runs: OS-keyring login of the current user, or an AI Studio `GEMINI_API_KEY` from `global/.env` (which would then also bill via the API rather than the Antigravity plan)?
3. Is the IDE (agent panel) the main Antigravity surface for these users, in which case hooks and the brain reader matter more than the CLI adapter?
4. May the harness write a project-level `.agents/hooks.json` (and later a global `~/.gemini/config/hooks.json`) outside this repo, given hooks run arbitrary commands?
