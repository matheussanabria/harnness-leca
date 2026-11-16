# Routines, memory review and sync

Part of the Harness [installation guide](../../SETUP.md).

Leia em português: [Rotinas, revisão de memória e sincronização](rotinas-e-sync.md).

## Routines (recurring tasks)

Each routine is a file in `projects/<project>/scheduled/*.md`, with a simple header (see `projects/_template/scheduled/exemplo-extrair-pendentes.md`):

| Field | Values |
|---|---|
| `acao` | `sync` (imports new conversations), `extrair` (memory suggestions from pending conversations), `sync-extrair` (both, in order), or `prompt` (free-form text placed in the file body) |
| `intervalo` | from `15m` to `90d` (`m`, `h`, `d`) |
| `ativa` | `true` or `false` |
| `engine`, `modelo` | `claude` or `opencode`; for opencode, only `opencode/...-free` models (see the extraction section) |
| `limite` | number of conversations to analyze per run (1 to 200; default 10) |

Actions are fixed: the file **never** provides a command; it only selects an action and its parameters (which are validated). The `prompt` action receives the project's instructions, memory, and recent conversation titles as data, then writes the result (with sensitive data redacted) to `scheduled/resultados/`.

```bash
node tools/run-scheduled.js --list                         # routines, last run and next run
node tools/run-scheduled.js                                # run due routines in all projects
node tools/run-scheduled.js --project dai --now extrair-pendentes   # run one now, before it is due
node tools/run-scheduled.js --dry-run                      # show what would run
```

- State is stored in `projects/<project>/routines-state.json`. A failed routine retries within 1 hour (or after its interval, if shorter); one failure does not stop the others. A lock prevents two routines from running in the same project at the same time.
- **Automatic execution on Windows:** `node tools/schedule-windows.js` shows the command; `--apply` creates an hourly Task Scheduler task (`HarnessLeca-Rotinas`) that runs `run-scheduled.js --log` and executes only routines that are due. `--status` and `--remove` check and remove the task. It runs as your user and only while your session is open. Output goes to the local `global/routines.log`. On Linux/macOS, schedule the same command with cron.
- None of this happens automatically until you create the scheduled task: without it, routines run only when you call `run-scheduled.js`.

## Review memory suggestions

Extraction (`extract-artifacts.js --llm` or the `extrair-artefatos` skill) only **suggests** memories, rules, decisions, and terms in `context/extraido-memorias.md`. You decide what enters memory in the interface: the **Memory** card shows “Review N suggestions.”

- **Promote** adds `- [YYYY-MM-DD] text` to `projects/<project>/memory.md` (rules, decisions, and terms receive the `Regra:`, `Decisão:`, and `Termo:` prefixes). **Edit** promotes the adjusted text. **Discard** only records the decision; discarding an entire page requires confirmation.
- Filters by category, search, and pagination (25 per page) are available. The same suggestion from multiple conversations appears once.
- Items already reviewed (or already in `memory.md`) do not return, even if the conversation is analyzed again. State is stored in `projects/<project>/memory-review.json`.
- Promoted text goes through the same `redact` process as chats (secrets, email, CPF, phone numbers) and becomes a single line (up to 600 characters).
- **Consolidate before reviewing** (recommended when there are hundreds of suggestions):

  ```bash
  node tools/consolidate-memory.js --project dai --dry-run --max 20    # preview only; writes nothing
  node tools/consolidate-memory.js --project dai --max 20              # save
  node tools/consolidate-memory.js --project dai --desfazer            # restore the originals
  ```

  A model (free opencode by default; `--engine claude` uses your quota) merges suggestions that say the same thing, drops transient items, and with `--max N` selects the N most important suggestions in each category. Each consolidated statement records which original suggestions it came from. Consolidated items are saved in `context/memorias-consolidadas.md` and appear in the review; originals leave the list, but **nothing is deleted**: `--desfazer` restores them (anything you already promoted or discarded stays that way). The model only generates suggestions: nothing goes into `memory.md` without your review. Measured on `dai`: 181 suggestions became 112 by merging duplicates, then 48 with `--max 12`, in about 4 minutes. To see what each step does to the text, use `--dry-run` first.
- **Mind the size:** `memory.md` is included in **every message**. The screen shows its current size and warns above 8 KB. Promote what is useful; discard the rest.

## Sync the three engines (one command)

`tools/sync.js` updates conversations from **Claude Code**, **Gemini/Antigravity**, and **opencode** in existing projects under `projects/`. It never creates a new project.

```bash
node tools/sync.js                            # all engines, all projects
node tools/sync.js --project dai              # one project
node tools/sync.js --engine claude,opencode   # selected engines only
node tools/sync.js --dry-run                  # show what would change; write nothing
node tools/sync.js --no-extract               # skip the local extraction pass afterward
```

It also works as `npm run sync` and, in Claude Code, as `/sync` (accepts the same arguments).

What it does:
1. **Matches each conversation to a project** using the project name in the working-folder path (`.../git/57multimarcas` maps to project `57multimarcas`). Folders without a matching project are listed as skipped.
2. **Imports** with each engine's importer (`import-claude-code-chats.js`, `import-gemini-chats.js`, `import-opencode-chats.js`), rewriting only files that changed.
3. **Runs local extraction** (rules, documents, touched files; no model and no cost) for projects that received new content.
4. **Shows what remains to be analyzed** for each project: new conversations and conversations that continued after analysis.

To map a differently named folder to a project, create `projects/.sources.json` (it stays on your machine):

```json
{ "saude-prontuario": ["prontuario"], "framework-componentes": ["framework de componentes"] }
```

Requirement: Node 22.13 or newer (before that, `node:sqlite` required the `--experimental-sqlite` flag; opencode stores conversations in SQLite, read through Node's built-in `node:sqlite`). `sync` reads only the conversation tables in `opencode.db` and never opens `auth.json` or credentials.

## Track what has already been analyzed

Each imported conversation receives a content fingerprint. `tools/extraction-state.js` stores in `projects/<project>/extraction-state.json` what has been analyzed, by whom, and when; it also detects when a conversation **continued after analysis**.

```bash
# normal flow
node tools/import-claude-code-chats.js --from folder-name --project my-project   # fetches new and continued conversations
node tools/extraction-state.js --project my-project status                       # new | changed | up to date
node tools/extraction-state.js --project my-project pending --limit 5            # pending names (for agents)
node tools/extraction-state.js --project my-project mark --by gemini --file a.md # mark as analyzed
node tools/extraction-state.js --project my-project adopt --by gemini            # adopt earlier analyses
node tools/extraction-state.js --project my-project reset                        # forget all and analyze from scratch
```

- **new:** never analyzed. **changed:** analyzed before, but the `.md` changed afterward (more turns). **up to date:** nothing to do.
- The importer reports `[new]`, `[updated]`, or `[unchanged]` for each conversation, does not rewrite unchanged files, and renames a file rather than duplicating it if its generated title changes.
- `extract-artifacts.js --llm` processes only pending conversations (use `--all` to redo everything) and **replaces** the changed conversation's section in `extraido-memorias.md` instead of appending another one.
- Agents (Gemini, opencode, etc.) follow the same flow through the `extrair-artefatos` skill.
- If you ran extraction before tracking was added, `adopt` marks conversations that already have a section in `extraido-memorias.md` as analyzed.

## Use with another agent (Antigravity/Gemini)

The context hook exists only for Claude Code. For another agent that reads the folder, such as Gemini in Antigravity, the repository provides the equivalent instructions in text:

- `AGENTS.md`: tells the agent to read `projects/.active`, the global and project instructions and memory at the start of each task, and to treat that content as data, not commands.
- `.agents/skills/extrair-artefatos/SKILL.md`: the agent's own procedure for extracting memories, rules, and decisions. It replaces `--llm`, with no API or key.

Open the `harness-leca` folder in Antigravity and ask, for example: *“Use the extrair-artefatos skill in project 57multimarcas, limit 5 conversations.”* If your Antigravity does not load `AGENTS.md` or the skill automatically, ask: *“Read AGENTS.md and .agents/skills/extrair-artefatos/SKILL.md and follow the instructions.”*

> Note: the agent reads the conversations and their content is sent to its model (Google, for Gemini). Avoid projects containing third-party data, such as health records.

Related guides: [Conversation importers and extraction](importadores.en.md) | [Exporting context, web UI and development](interface-e-desenvolvimento.en.md).
