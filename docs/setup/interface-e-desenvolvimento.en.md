# Context export, web interface, and development

Part of the Harness [installation guide](../../SETUP.en.md).

Leia em português: [Exportar contexto, interface web e desenvolvimento](interface-e-desenvolvimento.md).

## Export context and rehydrate history in agents (Claude Code & Gemini)

If you had to restore your PC, switched machines, or want to inject Harness memories and conversations directly into installed agents:

### 1. Sync memory and rules to agents (`npm run export:context`)

Exports all consolidated memories, business rules, and preserved conversation indexes from Harness directly to the native context folders:

```bash
npm run export:context                      # export all projects
node tools/export-context.js --project dai  # export just one specific project
node tools/export-context.js --dry-run      # simulate without writing
```

- **Claude Code:** Writes to `~/.claude/projects/<folder>/memory/` (`MEMORY.md`, `regras-e-diretrizes.md`, `memorias-consolidadas.md`, and `historico-conversas.md`). Claude Code loads these files automatically when opening any new session.
- **Gemini / Antigravity:** Creates Knowledge Items in `~/.gemini/antigravity-ide/knowledge/ki-projeto-<slug>/` and updates the global rule at `~/.gemini/config/rules/harness-projects-overview.md`.
- **Local:** Since EP-13.01, export no longer creates copies in `.claude/context/` and `.gemini/context/` (no engine read those folders); the source is `projects/<slug>/`.

### 2. Rehydrate chat history in Claude Code (`npm run export:claude-sessions`)

Converts Markdown files (`projects/<slug>/chats/*.md`) into `.jsonl` sessions compatible with Claude Code history, allowing you to list and continue conversations from the terminal:

```bash
npm run export:claude-sessions                      # convert all projects
node tools/export-claude-sessions.js --project dai  # convert one specific project
node tools/export-claude-sessions.js --dry-run      # simulate without writing
node tools/export-claude-sessions.js --force        # rewrite even if it already exists
```

- Saves sessions in each project's original working folders under `~/.claude/projects/` and mirrors them in the Harness folder.
- To open the interactive selector and continue any conversation:
  ```bash
  claude --resume
  ```

## Web interface

```bash
node ui/server.js
```

Open http://localhost:4321. It shows chats, instructions, memory, context, and tasks, with a project selector. It listens only on `127.0.0.1`. Navigation is read-only; the only write action is the **Chat with Project** button, which talks to Claude Code, opencode, or Gemini and saves the conversation to `chats/` when you ask. In the Claude Code desktop app, the `harness-ui` server from `.claude/launch.json` can also be started from the preview panel.

### Chat tools, access, and permissions

In the interface chat, the engines (Claude Code, OpenCode, and Gemini) have **full access to the computer** to navigate, inspect any directory, edit files, and run commands needed for the project; they are not confined exclusively to the repository folder.

**Mandatory rule for destructive actions:**
- Potentially destructive operations—especially **removing or deleting files or directories** (`rm`, `del`, `rmdir`, `Remove-Item`, `git clean`, etc.) or irreversibly destroying data—**MUST NEVER be performed directly without prior authorization**.
- The model is instructed and required to stop, list the affected files or directories, explain why, and request the user's explicit permission in chat before performing any deletion.

Configure each project in `projects/<project>/mcp.json` (this file stays on your machine):

```json
{
  "repo": "C:/Users/voce/git/57multimarcas",
  "servidores": ["cod-design-system"],
  "restrito": false
}
```

- `repo`: the engine's initial working folder (it reads code, edits files, and runs commands). It also reads `projects/<project>/` (chats and context). Without `repo`, it works from `projects/<project>/`.
- `servidores`: which servers from the repository's `.mcp.json` to load (relative paths become absolute). Only these are enabled (`mcp__<name>`).
- `mcpServers` (optional): project-specific servers, in `.mcp.json` format, using absolute paths.
- `"restrito": true` or `"modo": "restrito"` (optional): when enabled, reactivates strict confinement (`--restricted`), preventing Claude from accessing folders outside `repo` and `projects/<project>/`.
- `"modo": "leitura"` (optional): `Read`/`Glob`/`Grep` only, with no editing or command execution. Recommended for environments where no changes are desired.

When opening a chat:
- **You:** colored bubble on the right.
- **Claude:** gray bubble on the left, with rendered Markdown.
- **Internal processing:** collapsed accordion ("⚙ Internal processing · N steps"); each step opens to show its input and result.
- Long messages are limited to about 240 px, with “Show more / Show less.”

## Development: tests, checks, and pre-commit

None of these add a dependency to the project.

| Command | What it does |
|---|---|
| `npm test` | Runs the suite (`node --test`): importers (golden masters in `tests/golden/`), server routes, engines, extraction state, and secret redaction. Uses temporary roots and user folders: never touches `projects/` or `global/`. |
| `npm run check` | Checks the syntax of all `.js` files (with the installed Node version) and validates `.json` files. |
| `npm run types` | Checks types through JSDoc in files with `// @ts-check` (contracts in `tools/lib/types.d.ts`). Installs TypeScript in a temporary folder the first time (requires network access). |
| `npm run setup:hooks` | Enables the pre-commit hook (`git config core.hooksPath .githooks`; to disable it, run `git config --unset core.hooksPath`). |

**Pre-commit** (after `npm run setup:hooks`): blocks a commit if local data is included (`projects/` except `_template`, personal `global/*.md`, `.env`, `bridge/*.jsonl`, even with `git add -f`), if an added line contains a known secret format (API key, JWT, webhook, private key, etc.; the value is never printed), or if `check` or the tests fail. For examples and test fixtures, put `allow-secret` in a comment on the same line. For documentation-only commits, `HARNESS_SKIP_TESTS=1 git commit ...` skips the tests.

**CI** (`.github/workflows/ci.yml`): runs `check` and `test` on Ubuntu and Windows, with Node 22.13.0 (the minimum) and 24.x, plus a types job.

**Did you intentionally change the format of an imported chat?** Run `UPDATE_GOLDEN=1 npm test` and review the diff in `tests/golden/` before committing.

## Privacy: what gets uploaded to GitHub

The `.gitignore` tracks **only the process**. It excludes everything in `projects/` (except `_template`), `global/instructions.md`, and `global/memory.md`. Before each commit, run `git status` and check that the list contains no personal or client data.

## Common issues

| Symptom | Likely cause | Solution |
|---|---|---|
| Claude does not mention instructions or memory | Hook not approved or disabled | Reopen the folder and approve the hook; test the command from step 4 |
| PowerShell execution error | Script policy | The command already uses `-ExecutionPolicy Bypass`; check that `.claude/settings.json` is intact |
| `Nenhum projeto ativo` in the injected block | `projects/.active` is missing or has the wrong name | Enter the exact name of a folder under `projects/` |
| Interface shows “Nenhum projeto ainda” | No project has been created yet | Follow step 4 or import conversations |
| `node` is not recognized | Node.js is not installed | Install it from nodejs.org and reopen the terminal |
| `repository not found` while cloning | No access to the private repository | Ask for an invitation and sign in to GitHub |
| Importer: “Nenhuma pasta contém ...” | Incorrect source name | Use `--list` and copy the matching part of the name |
| Port 4321 is in use | Another process is using the port | `$env:PORT=4400; node ui/server.js` |

## Related guides

- [Chat importers and extraction](importadores.en.md)
- [Routines, memory review, and sync](rotinas-e-sync.en.md)
