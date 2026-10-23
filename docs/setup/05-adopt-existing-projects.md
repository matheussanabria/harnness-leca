# 05. Adopt projects you already have

Part of the [setup series](01-overview.md). Use this when a codebase already exists on your machine and you want it to follow the harness structure (instructions, memory, context, chats), with its past conversations from every engine.

## What "adopted" means

A project is adopted when it has `projects/<slug>/` with `instructions.md`, `memory.md`, `chats/`, `context/`, `scheduled/`, and its folder name is routed to that slug. **Your code is never moved or modified.** The harness only reads manifest files in the source folder.

## One command

```powershell
node tools/adopt-project.js --path C:\Users\you\git\my-app --dry-run   # preview
node tools/adopt-project.js --path C:\Users\you\git\my-app             # do it
```

Options:

| Option | Effect |
|---|---|
| `--path <folder>` | Source project folder (required) |
| `--slug <slug>` | Project name; default is the folder name, normalized to lowercase |
| `--dry-run` | Print what would be created, write nothing |
| `--activate` | Write the slug to `projects/.active` |
| `--sync` | Then run `node tools/sync.js --project <slug>` to import conversations |

Also available as `npm run adopt -- --path <folder>`.

## What it does

1. **Detects the stack** from `package.json` (Angular, React, Next.js, Vue, NestJS, Express, TypeScript, Vite, Jest, ESLint...), `pom.xml` / `build.gradle` (Java version, Spring Boot, JUnit, Liquibase, Checkstyle), `pyproject.toml` / `requirements.txt` (Django, FastAPI, Flask, pytest), `go.mod`, `Cargo.toml`, `*.csproj`, Dockerfile and Compose. It also looks one folder level down for monorepos, skips `node_modules`, `.git`, `dist` and similar, and never follows symlinks.
2. **Creates** `projects/<slug>/` from the template.
3. **Writes `instructions.md`** with the detected stack, the detected scripts (dev, start, build, test, lint), a README summary, base rules for the assistant, and a short list of **questions for you** (architecture conventions, branch rules, definition of done, off-limits areas). Only facts found on disk are stated.
4. **Writes `memory.md`** with dated facts (stack, scripts, whether it is a git repo).
5. **Adds an alias** in `projects/.sources.json` when the folder name differs from the slug, so conversations are matched.
6. **Never overwrites** an existing `instructions.md` or `memory.md`.

## After adopting

```powershell
node tools/sync.js --project my-app --dry-run
node tools/sync.js --project my-app
node tools/import-codex-chats.js --from my-app --project my-app      # Codex is separate
node tools/extraction-state.js --project my-app status
```

Then open `projects/my-app/instructions.md`, answer the "To confirm with the owner" questions and delete the lines that do not apply. That file is yours: the harness and its agents never edit it unless you ask.

## Several projects at once

```powershell
foreach ($d in Get-ChildItem C:\Users\you\git -Directory) {
  node tools/adopt-project.js --path $d.FullName --dry-run
}
```

Review the dry-run output, then rerun without `--dry-run` for the folders you want.

## Conversations started under a different folder name

If an old session ran in `C:\old\app-v1` but the project is `my-app`, either add `"my-app": ["app-v1"]` to `projects/.sources.json` or target it directly:

```powershell
node tools/import-claude-code-chats.js --from app-v1 --project my-app
```

## Deeper onboarding (optional)

For architecture mapping, key-file selection and agent configuration beyond stack detection, ask your assistant to use the `project-onboarding-scanner` skill on the repository. Agents should read [docs/agents/ADOPTION.md](../agents/ADOPTION.md).
