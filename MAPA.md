# Harness Leca map

Entry point for agents (Claude Code, Codex, Gemini, opencode) to find files and responsibilities without scanning the repository. Do not read this tree top to bottom.

## How to use it

1. Know the file you are touching: `node tools/mapa.js find <path>` prints the map file that covers it.
2. Know only the topic: `node tools/mapa.js find <keywords>` (for example `find atelier agent loop`) ranks map files by module, keywords and summary.
3. Read only that file. Its frontmatter (first 9 lines) says what it covers; the table lists each file and what it does.
4. Nothing found: `docs/mapa/INDEX.md` lists every map file with a one-line summary.

## Layout

```
AGENTS.md, CLAUDE.md, SETUP.md   rules, conventions, installation
global/                          instructions and memory shared by all projects
projects/<slug>/                 instructions.md, memory.md, chats/, context/, scheduled/
tools/                           CLI scripts and shared libraries (tools/lib)
scripts/                         pre-commit, checks and regression runner
ui/server/                       HTTP backend (router, controllers, services)
ui/public/                       web interface (HTML, CSS, legacy ES modules; built islands in ui/public/dist (gitignored))
ui/web/                          React islands (TypeScript, Vite, Biome; ADR-011)
docs/mapa/<domain>/<module>/     the map: one file per feature
tests/                           node:test suites
```

## Domains

<!-- mapa:index:start -->
| Domain | Modules | Files | Size |
|---|---|---|---|
| `agents` | skills | 1 | 0.7 KB |
| `backend` | artifacts, atelier, canvas, chat, core, deploy, orchestration, projects, prototype, screen-state | 13 | 33.1 KB |
| `design` | atelier-quality, system | 3 | 10.1 KB |
| `frontend` | canvas, chat, css, design, office, studio, web, window-manager | 16 | 41.3 KB |
| `intelligence` | hia, runtime | 7 | 17.4 KB |
| `office` | hq | 3 | 9.1 KB |
| `planning` | product, projects | 5 | 13.5 KB |
| `telemetry` | program, usage | 9 | 28.4 KB |
| `tools` | engines, mapa, setup, testing | 11 | 26.6 KB |
<!-- mapa:index:end -->

## Map file format

`docs/mapa/<domain>/<module>/<feature>.md`, at most 8 KB, with this frontmatter:

```
---
domain: backend            # equals the first folder
module: atelier            # equals the second folder
feature: agent-loop        # file name without .md
summary: One line, 120 characters at most.
paths: [ui/server/services/atelier-*.js]   # globs of the files the table covers
keywords: [atelier, loop]
updated: 2026-10-30
---
```

The body is a table `| File | Responsibility |`: one backticked relative path per row, one sentence each.

## Keeping it current

- Creating, moving, splitting or removing a file: edit the row (and `paths`) in the feature file that covers it, in the same task.
- A new area: create `docs/mapa/<domain>/<module>/<feature>.md`, then run `node tools/mapa.js build --write` to refresh the domain table and `docs/mapa/INDEX.md`.
- `node tools/mapa.js check` validates frontmatter, the size cap, dead `paths` globs and files outside every entry; `--strict` turns warnings into errors.
- The pre-commit (`scripts/pre-commit.js`) and the context engine (`getMapSection`) read this map.
