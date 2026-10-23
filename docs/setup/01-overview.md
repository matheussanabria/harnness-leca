# 01. Overview: what Harness Leca does

Harness Leca brings the **Projects** model of Claude Chat (instructions, memory, context files, chat history, scheduled tasks) to the AI coding tools you already use: **Claude Code**, **Codex**, **Gemini / Antigravity** and **opencode**. Everything runs on your machine. Nothing is sent anywhere by the harness itself.

Guides in this series: [02 Install](02-installation.md) | [03 Engines and credentials](03-engines-and-credentials.md) | [04 First sync](04-first-sync.md) | [05 Adopt existing projects](05-adopt-existing-projects.md). Agents should start at [docs/agents/BOOTSTRAP.md](../agents/BOOTSTRAP.md).

## The idea in one picture

```
        your work in any engine                       the harness                       back into the engines
  Claude Code  ~/.claude/projects/*.jsonl  --\                                  /--> ~/.claude/.../memory/MEMORY.md
  Codex        ~/.codex/sessions/*.jsonl   ---+--> import --> projects/<slug>/ ---+--> Gemini / Antigravity knowledge
  Antigravity  ~/.gemini/.../brain         ---+    (redact)    chats/*.md        \--> claude --resume (rehydrated sessions)
  opencode     ~/.local/share/opencode/*.db --/                memory.md
                                                               instructions.md
```

1. **Import** converts each engine's private conversation store into one readable Markdown format (`projects/<slug>/chats/YYYY-MM-DD-title.md`). Secrets, e-mails, CPF and phone numbers are redacted on the way in.
2. **Extraction** (optional) proposes durable facts, rules and decisions from those chats. You review them in the web UI before anything lands in `memory.md`.
3. **Export** writes the curated memory back into each engine's native context, so a fresh session already knows the project.

## Core concepts

| Concept | Where | Meaning |
|---|---|---|
| Project | `projects/<slug>/` | One workspace: instructions, memory, context, chats, scheduled routines |
| Active project | `projects/.active` | One line with the slug the hook injects into Claude Code on every message |
| Global files | `global/instructions.md`, `global/memory.md` | Apply to every project |
| Aliases | `projects/.sources.json` | Extra folder names that route conversations to a project |
| Engine | Claude, Codex, Gemini, opencode, Ollama | The tools that produce conversations or answer in the web UI |

## What is local and what is versioned

The repository holds only the **process** (hook, UI, importers, template, docs). These stay on your machine and are git-ignored: `projects/*` (except `_template`), `global/instructions.md`, `global/memory.md`, `global/.env`, logs and UI state.

## Main commands

| Command | What it does |
|---|---|
| `npm run ui` | Web UI at `http://localhost:4321` (projects, chat, memory review, studio) |
| `npm run sync` | Refresh chats from Claude Code, Gemini/Antigravity and opencode |
| `npm run export:context` | Push curated memory into the engines' native context |
| `npm run export:claude-sessions` | Rebuild chats as sessions for `claude --resume` |
| `node tools/adopt-project.js --path <folder>` | Bring an existing project into the harness |
| `npm test` / `npm run check` | Test suite / syntax and integrity check |

## Platform support

**Windows only for now.** The Claude Code hook is a PowerShell script (`.claude/hooks/load-project.ps1`). The UI and the Node tools run anywhere Node 22.13+ runs, but a bash equivalent of the hook does not exist yet (tracked as a pending item).

## Privacy in short

- The harness never stores or copies your engine logins (see [03](03-engines-and-credentials.md)).
- Redaction is a heuristic, not a guarantee. Review `chats/` before sharing any file from it.
- Your projects never reach git because `projects/*` is ignored.
