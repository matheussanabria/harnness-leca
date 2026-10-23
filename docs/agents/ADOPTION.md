# Harness Leca: adopting an existing project (agent procedure)

Audience: an AI agent asked to make an existing codebase follow the harness structure. Humans: [docs/setup/05-adopt-existing-projects.md](../setup/05-adopt-existing-projects.md). Ground rules are the same as in [BOOTSTRAP.md](BOOTSTRAP.md); in particular, the source code is read-only for this task and credential files are never opened.

## Target structure

```
projects/<slug>/
  instructions.md   # owner-controlled; agents never edit it without being asked
  memory.md         # one dated fact per line: - [YYYY-MM-DD] fact
  context/          # reference files, read on demand
  chats/            # imported conversations
  scheduled/        # recurring routines
projects/.sources.json   # { "<slug>": ["<folder alias>"] }
```

## Procedure

1. **Pick the slug.** Lowercase, `[a-z0-9_-]`, up to 60 characters, not `_template`. Default: the folder name.
2. **Preview.**
   ```powershell
   node tools/adopt-project.js --path <folder> --slug <slug> --dry-run
   ```
   Check the detected stack against what you can see in the manifests. If it is wrong or empty, do not invent: adopt anyway and list the gap in your report.
3. **Adopt.**
   ```powershell
   node tools/adopt-project.js --path <folder> --slug <slug>
   ```
   The tool creates the folders, writes `instructions.md` and `memory.md` only when missing, and adds the alias when the folder name differs from the slug.
4. **Import conversations.**
   ```powershell
   node tools/sync.js --project <slug> --dry-run
   node tools/sync.js --project <slug>
   node tools/import-codex-chats.js --from <folder name> --project <slug>
   ```
   If old sessions ran under a different folder name, use `--from <old name> --project <slug>` with the specific importer instead of changing aliases blindly.
5. **Verify.**
   ```powershell
   node tools/extraction-state.js --project <slug> status
   ```
   Expect chats listed as pending. Zero chats is acceptable for a project that never had engine sessions.
6. **Deepen (only if the user asks).** Use the `project-onboarding-scanner` skill for architecture mapping and key-file selection. Write its findings into `projects/<slug>/context/` (for example `onboarding.md`), not into the source repository and not into `instructions.md`.
7. **Report** to the user: slug, detected stack, files created, alias added, chats imported per engine, and the open questions from the generated `instructions.md` that only the owner can answer.

## Rules for seeded content

- Record only what exists on disk. Anything unknown becomes a question for the owner, never a guess.
- `memory.md` entries are durable facts (stack, commands, decisions). No secrets, no personal data, no duplicates; correct wrong entries instead of appending contradictions.
- Never modify `instructions.md` of an existing project without an explicit request.
- If `projects/<slug>/` already exists, adoption keeps the existing files. Say so in the report.

## Batch adoption

Run steps 2 and 3 per folder, but ask the user to approve the list of folders and slugs first. Do not scan the whole disk for candidates: use the folders the user names or those printed by the `--list` commands.

## Edge cases

| Case | Handling |
|---|---|
| Two folders with the same name | Give them different `--slug` values; each gets its own alias entry only if the names differ from the slug |
| Folder inside `projects/` | Rejected by the tool: choose the real source folder |
| Not a git repository | Allowed; the generated memory states it |
| Monorepo | Detection looks one folder level down; list sub-projects in the report and ask whether to adopt them separately |
| Same slug already used by another source folder | Stop and ask the user; do not merge two codebases into one project silently |
