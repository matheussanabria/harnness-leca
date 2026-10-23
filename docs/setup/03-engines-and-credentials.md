# 03. Engines, sessions and credentials

Part of the [setup series](01-overview.md). Install only the engines you use; the harness skips the ones it cannot find.

## The rule about credentials

**The harness does not store, copy or read your subscription logins or API keys.** Each CLI keeps its own login in your user profile and the harness just starts that CLI. The only secret that can live in the harness is an optional `GEMINI_API_KEY` in `global/.env` (git-ignored).

Consequences:
- Log in once per engine, in a terminal, with that engine's own command.
- Never paste the credential files below into a chat, a ticket or an agent prompt. Agents must not open them.
- If an engine says "not logged in", the harness UI shows the command to run (it comes from `tools/lib/engines/errors.js`).

## Engine summary

| Engine | Install | Log in | Start a session | Login stored by the CLI at | Conversations read from |
|---|---|---|---|---|---|
| Claude Code | `npm install -g @anthropic-ai/claude-code` | run `claude`, then `/login` (Pro/Max plan) or set `ANTHROPIC_API_KEY` in `global/.env` | `claude` inside the project folder; `claude --resume` to continue | `~/.claude/.credentials.json` | `~/.claude/projects/<folder>/*.jsonl` |
| Codex | `npm install -g @openai/codex` (not verified on the author's machine) | sign in with ChatGPT inside the Codex CLI (`codex login`, not verified) | `codex` inside the project folder | `~/.codex/auth.json` | `~/.codex/sessions/**/*.jsonl` |
| opencode | `npm install -g opencode-ai` | `opencode auth login` | `opencode` inside the folder; `npm run opencode` serves it on port 63186 for the UI | `~/.local/share/opencode/auth.json` | `~/.local/share/opencode/opencode.db` (SQLite) |
| Gemini / Antigravity | Install the Antigravity IDE and sign in with your Google account (no CLI needed) | in the IDE; optional free API key from Google AI Studio for the UI chat | open the folder in Antigravity | managed by the IDE | `~/.gemini/antigravity-ide/brain` |
| Ollama (local, optional) | [ollama.com/download](https://ollama.com/download) | none | `ollama serve` | none | not imported (answers only) |

`~` is your user profile, for example `C:\Users\<you>`. File locations above were confirmed by checking that the files exist on the author's machine; their contents were not read.

## Claude Code

```powershell
npm install -g @anthropic-ai/claude-code
cd path\to\harness-leca
claude          # then type /login and follow the browser flow
```

If the harness cannot find the executable, set `CLAUDE_BIN` in `global/.env` to the absolute path of `claude.exe` (npm installs it under `%APPDATA%\npm\node_modules\@anthropic-ai\claude-code\bin\`).

## Codex

Codex sessions are imported by their own script and are **not** part of `npm run sync`:

```powershell
node tools/import-codex-chats.js --from my-project --project my-project --dry-run
node tools/import-codex-chats.js --from my-project --project my-project
```

If `codex` is not on `PATH`, set `CODEX_BIN` in `global/.env`.

## opencode

```powershell
npm install -g opencode-ai
opencode auth login          # pick a provider and complete the login
opencode                     # TUI session in the current folder
npm run opencode             # headless server on port 63186, used by the web UI chat
```

opencode offers free models (names ending in `-free`). The harness routines and extraction only accept those, so scheduled runs do not spend paid quota. Set `OPENCODE_BIN` or `OPENCODE_URL` in `global/.env` if detection fails.

## Gemini / Antigravity

Open the project folder in the Antigravity IDE. Conversations land in `~/.gemini/antigravity-ide/brain` and are picked up by `npm run sync`. For instant Gemini replies in the harness web UI, add a free key from [Google AI Studio](https://aistudio.google.com/) to `global/.env`:

```
GEMINI_API_KEY=your_key_here
```

Without it the UI writes your message to `bridge/gemini-inbox.jsonl` and the IDE agent picks it up.

## Ollama (optional local model)

```powershell
ollama serve
ollama pull qwen2.5-coder:1.5b
curl.exe http://localhost:11434/api/tags
```

Needs about 3000 MB of free RAM. Details and Docker variant: [SETUP.md](../../SETUP.md#motor-local-ollama).

## Which engine should I use?

All of them work side by side; the harness does not pin a project to one engine. A practical split: Claude Code or Codex for the heavy coding turns, opencode free models for extraction and routines, Gemini/Antigravity for IDE work, Ollama for tiny local tasks.

Next: [04 First export and sync](04-first-sync.md).
