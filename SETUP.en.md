# Harness installation guide

[Leia este guia em português](SETUP.md).

This guide replicates Claude Chat's **Projects** architecture (instructions, memory, context, chats, and scheduled tasks) in Claude Code. Claude automatically receives the active project's instructions and memories with each message. A local web interface lets you view everything, and an importer brings in past Claude Code conversations.

> The repository contains only the **process** (hook, interface, importer, template). Your projects, memories, and conversations stay on your machine and are never uploaded to GitHub.

## Prerequisites

| Item | Purpose | How to check |
|---|---|---|
| Windows 10/11 | The hook uses PowerShell | — |
| [Claude Code](https://claude.com/claude-code) (desktop app or CLI) | Run the harness | Open the app |
| [Git](https://git-scm.com/downloads) | Clone the repository | `git --version` |
| [Node.js 22.13+](https://nodejs.org) | Web interface, importers, and `sync` (opencode uses the built-in `node:sqlite`) | `node -v` |

> The hook is a PowerShell script, so the harness works directly only on Windows. On macOS/Linux, rewrite `.claude/hooks/load-project.ps1` (for example, in bash) and adjust `.claude/settings.json`. The interface and Node importer work on any system.

## 1. Clone the repository

If the repository is private, ask its owner for access.

```bash
git clone https://github.com/matheussanabria/harnness-leca.git
cd harnness-leca
```

## 2. Open it in Claude Code

Open the `harness-leca` folder as your working directory (desktop app: *Select folder*; CLI: run `claude` inside the folder). The first time, **approve the hook** in `.claude/settings.json`: it loads instructions and memories with each message.

## 3. Create your global files

Global instructions and memory apply to all projects and stay on your machine:

```powershell
Copy-Item global/instructions.example.md global/instructions.md
Copy-Item global/memory.example.md global/memory.md
```

Edit `global/instructions.md` with the rules Claude should always follow (language, tone, etc.).

## 4. Create your first project

```powershell
Copy-Item -Recurse projects/_template projects/my-project
Set-Content projects/.active "my-project"
```

Fill in `projects/my-project/instructions.md`. To check what the hook injects:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .claude/hooks/load-project.ps1
```

Send any message in Claude Code: it should receive a `<project-harness>` block with the active project.

## Structure

```
harness-leca/
├── CLAUDE.md                    # Claude rules (memory, chats)
├── SETUP.md                     # Portuguese guide
├── SETUP.en.md                  # this guide
├── .claude/
│   ├── settings.json            # registers the UserPromptSubmit hook
│   ├── launch.json              # shortcut to start the web interface
│   └── hooks/load-project.ps1   # injects instructions + memory with each message
├── global/
│   ├── instructions.example.md  # copy to instructions.md (local)
│   └── memory.example.md        # copy to memory.md (local)
├── tools/
│   ├── import-claude-code-chats.js   # imports Claude Code conversations
│   ├── import-gemini-chats.js        # imports Antigravity / Gemini conversations
│   ├── import-opencode-chats.js      # imports opencode conversations (local SQLite)
│   ├── extract-artifacts.js          # extracts rules, memories, and documents from chats
│   ├── extraction-state.js           # tracks what has been analyzed / changed since
│   ├── export-context.js             # exports memory and rules to Claude and Gemini context
│   ├── export-claude-sessions.js     # rehydrates Claude Code session history (.jsonl)
│   ├── sync.js                       # updates all 3 engines at once
│   └── lib/
│       ├── chat-format.js            # chat .md format (read and write): single owner of the format
│       ├── chat-store.js             # writes/renames/dates a chat (importers)
│       ├── chat-save.js              # saves a conversation made in the interface
│       ├── engines/                  # chat engines: claude.js, opencode.js, gemini.js + catalog.json (models) + index.js (registry)
│       ├── state.js                  # tracks what has already been analyzed
│       ├── redact.js                 # redacts secrets and personal data
│       └── root.js, env.js, cli.js, text.js, limits.js, projects.js, claude-bin.js, project-mcp.js
├── tests/                       # npm test (node --test, no dependencies); importer golden masters in tests/golden/
├── ui/                          # local web interface: server/ (Node, no runtime dependencies), public/ (legacy ES modules)
│   └── web/                     # React islands (TypeScript, Vite, Biome; ADR-011), built into ui/public/dist
└── projects/                     # LOCAL: only _template is versioned
    ├── .active                  # active project slug (one line)
    ├── _template/               # copy to create a new project
    └── <your-project>/
        ├── instructions.md      # project instructions
        ├── memory.md            # project memory index
        ├── context/             # reference files (spreadsheets, PDFs)
        ├── chats/               # conversations (YYYY-MM-DD-title.md)
        └── scheduled/           # recurring tasks
```

## React islands (ADR-011)

New UI screens are React islands in `ui/web/`, mounted inside the legacy interface. The legacy UI works without a build; an island route only shows a notice until the islands are built.

```bash
npm install            # React, Vite, TypeScript, and Biome (pinned versions)
npm run build:web      # builds ui/web into ui/public/dist (gitignored)
```

Development loop: run `npm run dev:web` (rebuilds on save) in one terminal and `npm run ui:dev` in another, then reload the browser. Before committing island code: `npm run types:web`, `npm run lint:web`, and `npm run e2e:web` (headless Edge).

## Everyday use

- **Switch projects:** edit `projects/.active` with the folder name.
- **Instructions:** write in `instructions.md` (project or `global/`). They take effect with the next message, without a restart.
- **Memory:** save durable facts with `node tools/memory.js save` (see `node tools/memory.js --help`). The `memory.md` indexes are generated; do not edit them manually.
- **Context:** put files in `projects/<project>/context/`. Claude receives only the list of filenames and opens a file when needed.
- **Chats:** ask “save a summary of this conversation” and Claude will write it to `chats/`.

## Local engine (Ollama)

The chat's “Ollama Local” is not a cloud service: it is a daemon running on your machine at `http://localhost:11434`. If it is not running, the interface shows “Ollama is off” (not an internet error).

```powershell
# 1. Install Ollama (Windows): https://ollama.com/download
# 2. Start the daemon (the Windows app keeps it running in the background)
ollama serve
# 3. Download the default model (~1 GB RAM in use)
ollama pull qwen2.5-coder:1.5b
# 4. Check
curl.exe http://localhost:11434/api/tags
```

Requirements and settings:

- At least **3000 MB of free RAM** for the local engine; HIA routes only lightweight tasks to it when the machine is ready.
- Alternative models: `qwen2.5-coder:3b` and `deepseek-r1:1.5b`.
- To use Ollama on another machine (LAN/VPN), set `OLLAMA_URL=http://<host>:11434` in `global/.env` and restart the interface.
- Docker: `docker run -d -p 11434:11434 -v ollama:/root/.ollama ollama/ollama`, then `docker exec -it <container> ollama pull qwen2.5-coder:1.5b`.

## Related guides

- [Portuguese guide](SETUP.md).
- Getting-started series: [01 overview](docs/setup/01-overview.md), [02 installation](docs/setup/02-installation.md), [03 engines and credentials](docs/setup/03-engines-and-credentials.md), [04 first sync](docs/setup/04-first-sync.md), [05 adopt existing projects](docs/setup/05-adopt-existing-projects.md). For agents: [docs/agents/BOOTSTRAP.md](docs/agents/BOOTSTRAP.md).
- [Chat importers and extraction](docs/setup/importadores.en.md): Claude Code, Antigravity/Gemini, and extracting rules, memories, and documents.
- [Routines, memory review, and sync](docs/setup/rotinas-e-sync.en.md): recurring tasks, memory suggestions, syncing the 3 engines, and using other agents.
- [Context export, web interface, and development](docs/setup/interface-e-desenvolvimento.en.md): exporting to agents, the web interface, tests, privacy, and common issues.
