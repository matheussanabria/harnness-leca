# 02. Installation

Part of the [setup series](01-overview.md). Windows 10/11 only for now.

## Prerequisites

| Item | Why | Check |
|---|---|---|
| Windows 10/11 + PowerShell | The Claude Code hook is a PowerShell script | `$PSVersionTable.PSVersion` |
| [Git](https://git-scm.com/downloads) | Clone the repository | `git --version` |
| [Node.js 22.13+](https://nodejs.org) | UI, importers, sync (opencode import uses built-in `node:sqlite`) | `node -v` |
| At least one engine CLI | Produces the conversations you will import | see [03](03-engines-and-credentials.md) |

There are no `npm install` dependencies: the project uses only Node built-ins.

## 1. Clone

```powershell
git clone <repository-url> harness-leca
cd harness-leca
```

Ask the repository owner for the URL and access if it is private.

## 2. Create your local global files

These are personal and git-ignored:

```powershell
Copy-Item global/instructions.example.md global/instructions.md
Copy-Item global/memory.example.md global/memory.md
```

Edit `global/instructions.md` with what every assistant should always follow (language, tone, safety rules).

## 3. Optional: environment file

Create `global/.env` (git-ignored) only for what you need. Lines are `KEY=value`; `#` starts a comment. A variable already set in the system environment wins over the file.

| Key | When you need it |
|---|---|
| `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) | Instant Gemini answers in the web UI chat (free key from Google AI Studio). Without it the UI writes to the `bridge/` queue instead |
| `ANTHROPIC_API_KEY` | Only if you use an API key instead of a Claude subscription login |
| `CLAUDE_BIN`, `CODEX_BIN`, `OPENCODE_BIN` | Absolute path to the executable when it is not found on `PATH` |
| `OPENCODE_URL` | opencode server URL if it is not on the default port (63186) |
| `OLLAMA_URL` | Ollama on another machine (default `http://localhost:11434`) |

`global/.env.example` documents the same keys. Never commit `.env`.

## 4. Open the folder in Claude Code and approve the hook

Run `claude` inside the folder (or open it in the desktop app / VS Code extension). On first use, **approve the hook** declared in `.claude/settings.json`: it injects instructions and memory of the active project before every message.

## 5. Enable the git pre-commit hook (contributors)

```powershell
npm run setup:hooks
```

## 6. Verify

```powershell
node -v                 # 22.13 or newer
npm test                # test suite should pass
npm run check           # syntax and integrity of all scripts
npm run ui              # open http://localhost:4321
```

To see exactly what the hook injects:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .claude/hooks/load-project.ps1
```

## 7. Create your first project

Either copy the template:

```powershell
Copy-Item -Recurse projects/_template projects/my-project
Set-Content projects/.active "my-project"
```

or adopt a folder that already exists, which also detects its stack and seeds the files: see [05](05-adopt-existing-projects.md).

Next: [03 Engines and credentials](03-engines-and-credentials.md).
