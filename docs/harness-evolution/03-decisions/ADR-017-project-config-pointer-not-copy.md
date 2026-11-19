---
id: ADR-017
titulo: Project configuration - the harness points at the project repo, never copies product artifacts
status: aceita
data: 2026-11-16
historias: []
tags: [harness-evolution, adr, project, config, repo, resolver, hybrid]
---

# ADR-017: Project configuration, pointer not copy

## Context

Every project can use every harness feature: Studio, Ateliê, mind map, diagrams, Scrum, layers map and gates. Some
projects keep their files only in the harness (`projects/<slug>/`). Others, such as `saude-dispensacao`, keep them in
their own repository, pointed at by `projects/<slug>/mcp.json` → `repo`.

The full survey is in `docs/architecture/02-project-config-hybrid.md`. In short:

- **At least seven resolvers read `repo`, each with its own rules:**
  - `getProjectRepoInfo` lives in a controller (`ui/server/controllers/inspect.controller.js:11`).
  - `loadProjectConfig` (`tools/lib/project-mcp.js:38`) throws when the folder is missing.
  - `resolveDossierRoot` (`workflow-dossier-paths.js:55`), `proc-manager-config.js:12`, `jira-snapshot.js:11`,
    `jira-refresh.js:26` and `pacote-revisao/config.js:22` each keep their own copy.
- **The projects folder is resolved three ways.** Only `config.getProjects()` honours `HARNESS_PROJECTS_DIR`.
- **DIS paths are hardcoded in generic code:** `_jira-dis.json` (4 places), `doc/sistema/features`, `_prototipos.json`,
  `_historias-arquivos.json` and `docs/logic`.
- **The gate configuration exists twice:** harness `rastreio.config.json` and repo `harness-gates.json`, with different
  paths. ADR-016 already planned to keep it in the repo (line 95).
- **The DS MCP server config is circular:** the repo `.mcp.json` points back to the harness folder
  `projects/<slug>/design/ds`.
- **Adoption never writes the pointer.** `tools/adopt-project.js:73-87` does not create `mcp.json`, and the setup docs
  do not mention `repo`.

## Decision

1. **The owner of an artifact decides where it lives.**

   | Kind | Lives in |
   |---|---|
   | Product artifacts, versioned with the code and needed without the harness: dossiers, `rastreio.yml`, `regras.md`, `mapa-camadas.json`, gates config and lock, prototype snapshot, DS MCP server | Project repo |
   | Harness working state: chats, memory, canvas boards, routines, run history, screen state, Ateliê working copies | `projects/<slug>/` |
   | Machine-specific values: absolute repo path, output folders | `projects/<slug>/`, never committed in the repo; credentials stay in env vars |

2. **The harness keeps a pointer, never a copy, of a product artifact.** A project with no repo uses the same layout
   inside `projects/<slug>/`.

3. **One resolver**, `tools/lib/project-root.js` → `resolveProject(slug)`, is the only code that reads the pointer. It
   returns `{ mode, projectDir, repo, paths }`.
   - Precedence, first match wins:
     1. Harness overlay `projects/<slug>/project.json` (machine-specific values only).
     2. Repo manifest `<repo>/.harness/harness.json` (relative paths, committed).
     3. `global/project-defaults.json`.
   - Modes:
     - `harness`: no repo.
     - `repo`: the repo has a manifest.
     - `hybrid`: there is a repo but no manifest yet. Use the repo paths that exist, else the harness, and report each
       fallback.
   - It uses `getProjects()`, so `HARNESS_PROJECTS_DIR` works everywhere.

4. **No project-specific file name in generic code.** Names such as `_jira-dis.json` come from the manifest.

5. `mcp.json` → `repo` stays readable during the migration. The resolver accepts it as a legacy overlay until every
   project has `project.json`.

## Alternatives considered

| Alternative | Pros | Cons |
|---|---|---|
| Replicate everything inside the harness | One place to look; works with no repo | Copies drift (as `rastreio.config.json` already did); the project team cannot run gates or read the layers map without the harness; two sources of truth |
| Everything in the repo, including chats and memory | Fully portable | Puts working notes and personal chat history into a product repo; the repo team inherits harness noise; harness-only projects need a fake repo |
| Keep the current per-feature resolvers and only document them | No code change | Every new project or folder layout needs code edits; the inconsistencies stay |

## Consequences

- **Easier:**
  - Adopting a second project with a different folder layout becomes configuration, not code.
  - Worktrees and tests honour `HARNESS_PROJECTS_DIR` everywhere.
  - The project team can run gates without the harness, as ADR-016 wanted.
- **Harder:** every feature must go through `resolveProject`. A direct `path.join(projectDir, ...)` for a product
  artifact becomes a review finding.
- **Migration**, each step shippable on its own, complete route:
  1. Add `tools/lib/project-root.js` with tests. Make `getProjectRepoInfo` and `project-mcp.js` delegate to it.
  2. Replace the tool-side resolvers and the hardcoded repo paths with `resolveProject(slug).paths.<name>`.
  3. `adopt-project` asks for the repo path, writes `project.json` and offers to create `.harness/harness.json`.
  4. Create `.harness/harness.json` in `saude/dispensacao` (with the user's approval, since it is the project repo).
     Retire the harness `rastreio.config.json`.
  5. Make the DS MCP env relative to the repo, or resolve it at start-up, to break the circular path.
  6. Add `node tools/project.js doctor`, which prints the mode, every resolved path and every fallback.
