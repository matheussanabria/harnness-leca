# Chat Importers and Extraction

[Leia em português](importadores.md).

Part of the Harness [installation guide](../../SETUP.en.md).

## Import conversations from other Claude Code projects

Claude Code stores each conversation as a `.jsonl` file in `~/.claude/projects/<project-folder>/`. The importer converts them to the Harness format:

```bash
# 1. list the folders and the number of conversations in each
node tools/import-claude-code-chats.js --list

# 2. simulate (writes nothing)
node tools/import-claude-code-chats.js --from folder-name --project my-project --dry-run

# 3. import
node tools/import-claude-code-chats.js --from folder-name --project my-project
```

- `--from`: part of the source folder name (use the name shown by `--list`).
- `--project`: destination in `projects/` (created from `_template` if it does not exist).
- `--no-tools`: omit tool calls (produces much smaller files).
- Running it again updates the same files without duplicating them.

Each conversation becomes an `.md` file in `projects/<project>/chats/` with a title, dates, and source. Tool calls (input and output, truncated to 1,500 characters) are stored in `:::tool` blocks that the interface displays collapsed.

> Conversations may contain sensitive data (logs, pasted passwords, customer data). They stay on your computer. Review files before sharing anything from `chats/`. The importer heuristically redacts common secret patterns (API keys, `Bearer`, `password=`/`token=`, passwords in URLs, private keys), but this does not guarantee complete coverage.

## Import Antigravity / Gemini conversations

Antigravity stores session transcripts at `~/.gemini/antigravity-ide/brain/<uuid>/.system_generated/logs/transcript.jsonl`. The importer automatically detects each conversation's project and converts it to the Harness format:

```bash
# 1. list all available Gemini sessions and the detected project
node tools/import-gemini-chats.js --list

# 2. simulate importing conversations for a project (writes nothing)
node tools/import-gemini-chats.js --project saude-dispensacao --dry-run

# 3. import all detected conversations for the project
node tools/import-gemini-chats.js --project saude-dispensacao

# 4. or import a specific session by ID
node tools/import-gemini-chats.js --from 39c79beb --project saude-dispensacao

# 5. or auto-import all detected sessions into their respective projects
node tools/import-gemini-chats.js --all-projects
```

- The interface (`http://localhost:4321`) shows both Claude chats (`✱ Claude`) and Gemini chats (`✦ Gemini`).
- Tool calls and reasoning (`:::thinking`) are fully preserved and displayed in accordions.

## Extract rules, memories, and documents from conversations

After importing, `tools/extract-artifacts.js` reads project conversations and separates reusable material. Everything goes into `projects/<project>/context/` as **suggestions to review**: nothing is copied automatically to `memory.md` or `instructions.md`.

```bash
# free, runs locally: rules, documents, files touched
node tools/extract-artifacts.js --project my-project

# optional: memories, rules, and decisions distilled by Claude (uses your quota)
node tools/extract-artifacts.js --project my-project --llm --limit 5
```

| Output | Contents |
|---|---|
| `extraido-indice.md` | Summary and list of extracted items |
| `extraido-regras.md` | Your rule-like statements (“always,” “never,” “I prefer,” etc.). Heuristic: review them. |
| `extraido-arquivos.md` | Files Claude created or edited, by conversation |
| `extraido-memorias.md` | (`--llm`) Memories, rules, decisions, and domain terms by conversation |
| `extraidos/documentos/` | `.md`/`.txt`/`.html` documents Claude saved, with full contents |
| `extraidos/respostas/` | Claude's long, structured responses (plans, analyses, tables) |

- The `extraido-*.md` files appear on the interface's **Context** card and in the list the hook passes to Claude. The `extraidos/` folder stays on disk.
- Running it again rewrites derived files. Without `--llm`, the previous `extraido-memorias.md` is preserved.
- `--limit N|all` (default 10, most recent) and `--model name` control `--llm` mode.
- **`--engine opencode`** runs extraction with an OpenCode model instead of Claude (does not use Claude quota). Default: `opencode/deepseek-v4.1-flash-free`. See available models with `opencode models`.
  - **Free models only** (`opencode/...-free`) run without requesting payment: Groq, OpenRouter, and others use your keys and may incur charges; to intentionally use them, pass `--allow-paid`.
  - **Isolation:** the model runs in an empty temporary folder with a read-only agent; writing, commands, web access, and external directories are denied (tested: requests to write, execute, and read outside the folder were refused, and nothing was created). It cannot remove *all* tools: OpenCode's free plan returns 403 for agents with no tools, and this is a service rule.
  - Each conversation is saved and marked analyzed **as soon as it finishes**; if execution stops midway, completed work remains. On service failure (e.g., usage limit), it retries once; if that also fails, the conversation remains pending.
  - About 15 to 20 seconds per conversation. Content is sent to the OpenCode model (an external service), with secrets and personal data redacted first.
- `--llm` sends a summary of each conversation (with secrets already redacted) to the model via `claude -p`, **with no tools enabled**, which is why this mode is optional. Avoid using it for projects containing third-party data, such as health data, unless necessary.
- To promote an item to memory, save the reviewed fact with `node tools/memory.js save`; the `memory.md` index is generated.

## Related guides

- [Installation guide](../../SETUP.en.md).
- [Routines, memory review, and sync](rotinas-e-sync.en.md).
- [Context export, web interface, and development](interface-e-desenvolvimento.en.md).
