# A5 - Engine capability matrix for telemetry (research, 2026-10-23)

Legend: D = documented (official page), O = observed locally (structure only, no content read), U = unknown / not found.
Doc sources (fetched today):
- CC = https://code.claude.com/docs/en/monitoring-usage (only the first 100k of 170k chars were read; the rest may hold more events)
- CX = https://learn.chatgpt.com/docs/config-file/config-advanced (the URL given in pre-plan section 14; a web search did not return an OpenAI-hosted page, so the config schema was cross-checked only against third-party guides, which disagree on shape)
- GM = https://geminicli.com/docs/cli/telemetry/
- OS = https://opencode.ai/docs/server/ ; OP = https://opencode.ai/docs/plugins/

## 1. Local detection

| Engine | Version | Where found | Notes |
|---|---|---|---|
| Claude Code | 2.1.301 | PATH | CC mentions `safety_event` from v2.1.307+, so that event is not available here. |
| Codex | codex-cli 0.146.0-alpha.3 | NOT on PATH; resolved by repo `tools/lib/codex-bin.js` to the OpenAI ChatGPT extension bundled under `~/.antigravity-ide/extensions/openai.chatgpt-*/bin/` | Alpha build. `~/.codex/` exists with sessions, sqlite state, `config.toml`. |
| Gemini CLI | MISSING | not on PATH; `~/.gemini/` has only `GEMINI.md`, `antigravity*` | GM states Gemini CLI was replaced by Antigravity CLI on 2026-06-18. The repo's gemini engine uses the AI Studio HTTP API or a bridge queue, not the CLI. |
| OpenCode | 1.19.3 | PATH | Local state in `~/.local/share/opencode/` (`opencode.db` sqlite, `storage/`, `log/`). CLI has `stats`, `export`, `db`, `serve`, `acp`. |

Telemetry config presence (key names only, no values):
- Process env: no `OTEL_*`, `GEMINI_TELEMETRY_*`, `CODEX_*` or `OPENCODE_*` keys. `CLAUDE_CODE_ENABLE_TELEMETRY` is NOT set (other `CLAUDE_CODE_*` keys exist for the current session only: session id, entrypoint, messaging socket).
- `~/.claude/settings.json`, repo `.claude/settings.json`, `~/.codex/config.toml`, `global/.env`: no otel / telemetry / `OTEL_` keys found. No `~/.gemini/settings.json` or opencode json config exists.
- Conclusion: no telemetry is configured anywhere; everything below needs opt-in.

## 2. Matrix

### 2.1 Claude Code (OpenTelemetry + local transcripts)

| Capability | Status | Detail | Source |
|---|---|---|---|
| Transport | D | OTLP gRPC, http/json, http/protobuf; also console and prometheus (metrics). Needs `CLAUDE_CODE_ENABLE_TELEMETRY=1` plus `OTEL_METRICS_EXPORTER`/`OTEL_LOGS_EXPORTER`/`OTEL_TRACES_EXPORTER` and `OTEL_EXPORTER_OTLP_*`. Per-signal overrides exist. No file exporter documented (console only). | CC |
| Presence (alive) | D (indirect) | `claude_code.session.count` with `start_type` (fresh/resume/continue/agents_view); no heartbeat event. `active_time.total` (user/cli) is a metric. | CC |
| Activity states | D (derived) | Derivable from events/spans: `user_prompt` -> `api_request` -> `tool_decision`/`tool_result` -> end. Span `claude_code.interaction` per prompt; `tool.blocked_on_user` span marks waiting-for-permission. No explicit idle/working state event. | CC |
| Tokens | D | `claude_code.token.usage` metric (type input/output/cacheRead/cacheCreation) and `api_request` event (`input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`). Reasoning tokens: no separate field documented (U). | CC |
| Cost | D | `claude_code.cost.usage` (USD) and `cost_usd`/`cost_usd_micros` per request. | CC |
| Tool calls | D | `tool_decision` and `tool_result` events (tool_name, tool_use_id, success, duration_ms); `claude_code.tool` span. Parameters only with `OTEL_LOG_TOOL_DETAILS=1`. | CC |
| Subagents / parent-child | D | `agent_id`, `parent_agent_id`, `agent.name`, `query_source=subagent`; subagent spans nest under parent Agent tool span; `workflow.run_id`. | CC |
| Skills | D | `skill.name` attribute on cost/token/api events; Skill tool param `skill_name` with tool details on. | CC |
| Session ids / resume | D | `session.id` on every metric/event (changes on `/clear`); `start_type=resume`. Metric cardinality toggle `OTEL_METRICS_INCLUDE_SESSION_ID`. | CC |
| Trace-context to children | D | Bash/PowerShell subprocesses inherit `TRACEPARENT` when tracing is on. Inbound `TRACEPARENT`/`TRACESTATE` is read only in Agent SDK and `-p` mode (interactive ignores it); then events carry `trace_id`/`span_id`. Traces are beta: needs `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1`. | CC |
| Auth | D | OTLP headers via `OTEL_EXPORTER_OTLP_HEADERS`, mTLS vars, `otelHeadersHelper` script (http only). Repo `.claude/settings.json` cannot set exporter vars (managed settings can). | CC |
| Control: send message | D (not telemetry) | `-p` / stream-json CLI, Agent SDK. Repo already spawns `claude` with stdin prompt. | repo O |
| Control: cancel | O | Repo kills the process tree on AbortSignal (`killTree`). | repo |
| Local fallback: transcripts | O | `~/.claude/projects/<cwd-slug>/<sessionId>.jsonl`. Line types seen: user, assistant, system, attachment, api-request, cost-state, ai-title, queue-operation, file-history-*. Assistant lines carry `message.usage` with keys input_tokens, cache_creation_input_tokens, cache_read_input_tokens, output_tokens, output_tokens_details, speed, service_tier. Common keys: parentUuid, isSidechain, sessionId, version, cwd, gitBranch, entrypoint, timestamp. | local |
| Local fallback: subagents | O | `<sessionId>/subagents/agent-<id>.jsonl` + `.meta.json` (keys: agentType, description, toolUseId, spawnDepth, finished); lines have isSidechain=true, agentId, promptId. Gives parent link via toolUseId. Undocumented format, may change. | local |

### 2.2 Codex (OpenTelemetry + rollout files)

| Capability | Status | Detail | Source |
|---|---|---|---|
| Transport | D | `[otel]` in `~/.codex/config.toml`: `exporter` = none (default) / otlp-http / otlp-grpc; `endpoint`, `protocol` (e.g. binary), `headers` with `${VAR}` interpolation. Third-party guides show separate `[otel.exporter]`, `[otel.trace_exporter]`, `[otel.metrics_exporter]` blocks (U which applies to 0.146 alpha; verify with the installed binary). No file exporter documented. | CX |
| Presence | D (indirect) | `codex.conversation_starts`, `thread.started` metric. No heartbeat. | CX |
| Activity states | D (derived) | Events: `codex.user_prompt`, `codex.api_request`, `codex.sse_event`, `codex.tool_decision`, `codex.tool_result`; metrics `turn.e2e_duration_ms`, `approval.requested`. O: rollout has `task_started`, `task_complete`, `sub_agent_activity`. | CX, local |
| Tokens | D | Token counts on `codex.sse_event` for `response.completed`; metric `turn.token_usage` by type. O: rollout `event_msg/token_count` has input_tokens, cached_input_tokens, cache_write_input_tokens, output_tokens, reasoning_output_tokens, total_tokens. Reasoning tokens present in rollout. | CX, local |
| Cost | U | No cost metric or field documented. Would need price table applied to tokens. | CX |
| Tool calls | D | `codex.tool_result`, `codex.tool_decision`, metric `tool.call` (tool, success). Internal tool name only, not the command. | CX |
| Subagents | D (names only) / O | Metric family `multi_agent.*` listed without attributes (U). Rollout contains `sub_agent_activity` and `inter_agent_communication_metadata` entries. | CX, local |
| Skills | D (names only) | `skill.injected`, `thread.skills.*` metrics; attributes U. | CX |
| Session ids / resume | D / O | Conversation id in event metadata. Repo uses `codex exec resume <uuid> --json`. Rollout files `~/.codex/sessions/YYYY/MM/DD/rollout-<ts>-<uuid>.jsonl`, plus `session_index.jsonl` and `state_5.sqlite`. | CX, repo, local |
| Trace-context to children | U | CX says traces are not documented. Env propagation: not documented. | CX |
| Auth | D | Static headers with env interpolation. `[analytics] enabled=false` disables metrics. Third-party note: metrics default to a vendor exporter unless set (unverified). | CX |
| Control | O | `codex exec --json` (JSONL stdout) and `exec resume`; cancel by process kill (repo). Interactive/app-server control: U. | repo |
| Local fallback | O | Rollout JSONL structure as above; token_count entries make it a sound fallback for tokens and subagent activity. | local |

### 2.3 Gemini CLI (not installed)

| Capability | Status | Detail | Source |
|---|---|---|---|
| Transport | D | `GEMINI_TELEMETRY_ENABLED`, `_TARGET` (local/gcp), `_OTLP_ENDPOINT` (default http://localhost:4317), `_OTLP_PROTOCOL` (grpc/http), `_OUTFILE` (file output, overrides endpoint), `_OTLP_HEADERS`, `_USE_COLLECTOR`. Only engine with a documented file target. | GM |
| Presence | D | `gemini_cli.session.count`, `gemini_cli.config` at startup. | GM |
| Activity states | D (derived) | `user_prompt`, `api_request/response`, `tool_call`, `conversation_finished`, `approval_mode_*`. | GM |
| Tokens | D | `gemini_cli.token.usage` types input/output/thought/cache/tool; `api_response` has input/output/cached/thoughts/tool/total. | GM |
| Cost | D (absent) | Docs state no cost metric. | GM |
| Tool calls | D | `gemini_cli.tool_call` event, `tool.call.count` metric (tool_type native/mcp). | GM |
| Subagents | D | `gemini_cli.agent.start/finish` (agent_id, agent_name), `agent.run.count`. Parent id: U. | GM |
| Skills | U | Not listed. | GM |
| Session ids | D | `session.id` on all data; `gen_ai.conversation.id` on spans. Resume: U. | GM |
| Trace-context to children | U | Traces off by default (`GEMINI_TELEMETRY_TRACES_ENABLED`); child propagation not documented. | GM |
| Auth | D | OTLP headers; GCP via ADC or `useCliAuth`. `logPrompts` defaults to true (privacy risk). | GM |
| Control / local | U / not installed | Binary missing; the repo's Gemini engine does not use the CLI. Product status uncertain (Antigravity replacement). Nothing verifiable here. | GM, repo |

### 2.4 OpenCode (server API + plugins; no OTel found)

| Capability | Status | Detail | Source |
|---|---|---|---|
| Transport | D | HTTP server (`opencode serve`, default 127.0.0.1:4096, OpenAPI 3.1 at `/doc`), SSE at `GET /event` and `GET /global/event`. No OTLP documented on either page. | OS, OP |
| Auth | D | Basic auth via `OPENCODE_SERVER_PASSWORD` (user `opencode` or `OPENCODE_SERVER_USERNAME`). Repo calls without auth headers (works only when no password). | OS, repo |
| Presence | D | `GET /global/health`, `server.connected`, `GET /session/status`. Repo uses `GET /session` probe. | OS |
| Activity states | D | Events `session.status`, `session.idle`, `session.error`, `message.updated`, `message.part.updated`, `permission.asked/replied`, `tool.execute.before/after`, `todo.updated` (plugin event list). Payload schemas U (read the `/doc` spec on a running server). | OP, OS |
| Tokens / cost | U on docs; O via CLI | Docs pages list no usage fields. `opencode stats` and `opencode export <id>` exist locally and `opencode.db` is sqlite; schema not inspected. | local |
| Tool calls | D | `tool.execute.before/after` hooks; message parts. | OP |
| Subagents | D | `GET /session/:id/children`; `POST /session` accepts `parentID`. | OS |
| Skills | U | Not mentioned. | OS, OP |
| Session ids / resume | D | `GET/POST /session`, `fork`, `revert`, `message` listing. | OS |
| Trace-context | U | Not documented. Plugin `shell.env` hook could inject env into shell commands (name only listed; semantics U). | OP |
| Control: send | D | `POST /session/:id/prompt_async` (204), `POST /session/:id/message`, `/command`, `/shell`. Repo already uses prompt_async. | OS, repo |
| Control: cancel | D / O | `POST /session/:id/abort`; repo calls it on AbortSignal. Permission reply: `POST /session/:id/permissions/:permissionID`. | OS, repo |
| Plugins | D | Auto-loaded from `.opencode/plugins/` and `~/.config/opencode/plugins/`; context gives project, directory, worktree, client, `$`. Pages do not mention telemetry. | OP |

## 3. How repo launchers could carry telemetry/correlation env (reading only)

- `tools/lib/engines/claude.js` line ~44: `cp.spawn(bin, args, {env})`. Env is `process.env`, or `{...process.env, MCP_TOOL_TIMEOUT}` when a permission URL exists. A per-run env object can add `CLAUDE_CODE_ENABLE_TELEMETRY`, `OTEL_*`, and `OTEL_RESOURCE_ATTRIBUTES` (documented: custom keys become attributes on all signals, e.g. `harness.chat_id=...`). The permission MCP child already receives `HARNESS_PERM_URL`/`HARNESS_PERM_CHAT` via its mcp config env (line ~127), a precedent for passing chat correlation. Because the run uses stdin prompt (not `-p`), inbound `TRACEPARENT` may be ignored (CC: SDK and `-p` only; unverified whether the repo's stream-json mode counts). Run args are not viewed here, so this is U.
- `tools/lib/engines/codex.js` line 42: spawn passes no `env` (inherits parent). Codex otel is configured in `config.toml`, not env; per-run override is possible with `-c otel.exporter=...` args like the existing `-c model_reasoning_effort=...` (mechanism used by repo; the otel key shape must be verified against 0.146 alpha). `CODEX_HOME`-style isolation: U.
- `tools/lib/engines/opencode.js`: no spawn; it talks to an already running server (`OPENCODE_URL` or auto-detected port). Correlation can only be a session id plus title; a plugin dropped in `.opencode/plugins/` would be the only in-process hook. No env path.
- `tools/lib/engines/gemini.js`: HTTP API with key from `.env`, no process. Nothing to inject; the CLI is not used.
- `tools/lib/env.js loadEnv()`: loads `global/.env` and `.env` into `process.env` without overriding system values, so a `HARNESS_OTLP_*` block could be set centrally and then copied into each child's env object.
- Other spawns in `ui/server` (sync controller, deploy and audit runners) pass `process.env` and are not engines.
- Risk: Claude docs say repo-level `.claude/settings.json` cannot set exporter vars; env at spawn time is therefore the correct vector.

## 4. Windows and WSL caveats

- Codex binary lives inside an IDE extension folder with a version in the path (`openai.chatgpt-26.721.*`); it is not on PATH and will change on extension update. Resolution already goes through `codex-bin.js`; any adapter must reuse it.
- Claude transcripts are keyed by cwd slug (`c--Users-...`); the same repo under another path (Desktop copy, WSL `/mnt/c/...`) produces separate dirs. Session ids are global UUIDs, so key by id, not path.
- WSL: loopback services (collector at 4317/4318, OpenCode 4096) are reachable from Windows only if bound/forwarded; `127.0.0.1` inside WSL is not the Windows host in NAT mode. Not tested here (U).
- Claude: PowerShell subprocesses also receive `TRACEPARENT` (CC), so Windows is covered on paper; not observed.
- Alpha Codex build and a Claude version older than some documented events (`safety_event` needs 2.1.307+) mean doc-vs-binary drift is real; each adapter needs a version gate.
- Transcript files are undocumented formats (`atis-latch`, `api-request-blob` are internal types); treat as best-effort fallback and read-only. They also contain prompt content, so any parser must drop text fields at read time.
- Gemini CLI path: tool not installed; docs say it is superseded, so do not invest before confirming which binary users run.

## 5. Gaps and unknowns worth testing before building

1. Whether Claude's `OTEL_*` export works when spawned by the harness (stdin mode) and whether `session.id` equals the id the repo stores for resume.
2. Codex `[otel]` exact schema on 0.146 alpha and whether `-c` overrides it; whether any subagent attributes exist.
3. OpenCode `/doc` spec (needs a running server) for event payloads and token/cost fields; `opencode.db` schema.
4. Claude CC page beyond 100k chars (not read): may add events, subagent attributes, or file exporters.

## 6. Recommended first external adapter

Claude Code via OTLP (logs + metrics, traces optional). Coverage proof: it is the only engine where all of the following are documented AND the binary is present: tokens split (input/output/cacheRead/cacheCreation), cost in USD, tool call events, subagent parent linkage (`agent_id`/`parent_agent_id`), skill name, session id with resume type, trace-context propagation, authenticated OTLP, and a launcher in the repo that already controls env. Local transcripts (observed) provide a no-collector fallback with the same token fields and a subagent index.
Second: Codex, using rollout JSONL (observed, includes reasoning tokens and subagent activity) while OTel schema is verified. Third: OpenCode via SSE + REST (control capability is the strongest). Gemini last, pending installation.

## 7. Blocking questions

1. Is a local OTLP receiver acceptable (port, process owner, who stores data), or must the first adapter be file-only (transcripts) with no new daemon?
2. Does the harness run Claude in stream-json stdin mode only? If trace correlation to the chat is required, is switching to `-p`/SDK acceptable (inbound `TRACEPARENT` only applies there)?
3. Privacy policy: are `OTEL_LOG_USER_PROMPTS` and `OTEL_LOG_TOOL_DETAILS` forbidden by default? (Gemini `logPrompts` defaults to true, so a policy is needed per engine.)
4. Which Codex build is the target (IDE extension alpha vs a standalone CLI)? Config location and schema depend on it.
5. Is Gemini CLI or Antigravity the intended engine to cover? The current repo engine is neither a CLI nor telemetry-capable.
6. Does OpenCode run with `OPENCODE_SERVER_PASSWORD` in any environment? The repo client sends no auth header.
7. Is cost required for Codex/OpenCode/Gemini (price table owned by whom), given no engine except Claude documents it?
