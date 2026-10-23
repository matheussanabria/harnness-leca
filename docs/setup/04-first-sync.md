# 04. First import, sync and export

Part of the [setup series](01-overview.md). Prerequisite: [installation](02-installation.md) done and at least one project under `projects/` (create or [adopt](05-adopt-existing-projects.md) one first, because `sync` never creates projects).

## How conversations find their project

An imported conversation belongs to a project when the project **slug** (or an **alias** from `projects/.sources.json`) appears as whole segments of the conversation's working-folder path. Example: a session started in `C:\Users\you\git\57multimarcas` goes to project `57multimarcas`. For a different folder name add an alias:

```json
{ "health-records": ["prontuario"] }
```

`node tools/adopt-project.js` writes this alias for you.

## Step 1: see what exists (read-only)

```powershell
node tools/import-claude-code-chats.js --list     # Claude Code folders and conversation counts
node tools/import-opencode-chats.js --list        # opencode sessions grouped by folder
node tools/import-gemini-chats.js --list          # Antigravity / Gemini conversations
```

Codex has no `--list`: use `--dry-run` in step 2.

## Step 2: simulate

```powershell
npm run sync:dry                                   # all engines, all projects, writes nothing
node tools/sync.js --project my-project --dry-run  # one project
```

`sync` options: `--project <slug>`, `--engine claude,gemini,opencode` (subset), `--dry-run`, `--no-extract` (skip the local extraction pass).

## Step 3: run the first import

```powershell
npm run sync                                       # Claude Code + Gemini/Antigravity + opencode
node tools/import-codex-chats.js --from my-project --project my-project   # Codex, separate script
```

Re-running is safe: files are updated in place, never duplicated. Each conversation becomes `projects/<slug>/chats/YYYY-MM-DD-title.md`. Tool calls appear as collapsed `:::tool` blocks, truncated to 1,500 characters.

To import a folder whose name does not match any project, target it explicitly:

```powershell
node tools/import-claude-code-chats.js --from folder-fragment --project my-project --dry-run
node tools/import-opencode-chats.js --from folder-fragment --project my-project
```

Useful flag: `--no-tools` leaves tool calls out and makes files much smaller.

## Step 4: check the result

```powershell
node tools/extraction-state.js --project my-project status
```

It lists chats that are new, analyzed or changed since analysis. Open `npm run ui` and look at the project's chat list to confirm titles, dates and engines.

## Step 5: turn chats into memory (optional)

Extraction proposes memories, rules, decisions and terms into `projects/<slug>/context/`. **Nothing enters `memory.md` until you approve it** in the UI card "Memory" (promote, edit or discard). Run extraction only with a free or local model unless you decide otherwise: see [rotinas-e-sync.md](rotinas-e-sync.md) (Portuguese) for the routine settings.

## Step 6: export the curated memory back to the engines

```powershell
node tools/export-context.js --dry-run             # preview
npm run export:context                             # write
node tools/export-context.js --report              # bytes and approximate tokens per project and target
```

Targets: the Claude Code project memory block (`~/.claude/projects/<folder>/memory/MEMORY.md`, managed section only), the Gemini / Antigravity knowledge item plus global rule, and the local `.claude/context/` and `.gemini/context/` folders.

To continue old chats inside Claude Code:

```powershell
npm run export:claude-sessions                     # add --project <slug> or --dry-run; --force overwrites
claude --resume
```

## Expected outcome

- `projects/<slug>/chats/` is filled and the UI lists the conversations.
- `extraction-state ... status` shows the pending count.
- After export, a new Claude Code session in the project folder already mentions the curated memory.

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| `sync` imports nothing for a project | Folder name and slug differ: add an alias or use the importer with `--from` and `--project` |
| `Project "x" does not exist in projects/` | `sync` never creates projects: create or adopt it first |
| opencode import fails with a `node:sqlite` error | Node is older than 22.13: upgrade Node |
| Claude executable not found | Set `CLAUDE_BIN` in `global/.env` |
| Chats contain something sensitive | Redaction is heuristic: edit or delete the file, and re-check before sharing |
