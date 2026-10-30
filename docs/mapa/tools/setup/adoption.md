---
domain: tools
module: setup
feature: adoption
summary: Adopting an existing project into the harness: CLI, read-only stack detection and seed rendering.
paths: [tools/adopt-project.js, tools/lib/adopt/detect-stack.js, tools/lib/adopt/render.js, tests/adopt-project.test.js]
keywords: [adopt, adoption, onboarding, stack, detect, seed, instructions, memory]
updated: 2026-10-30
---
# Adopt an existing project

| File | Responsibility |
|---|---|
| `tools/adopt-project.js` | Adoption CLI (`npm run adopt`). |
| `tools/lib/adopt/detect-stack.js` | Read-only stack detection from manifests. |
| `tools/lib/adopt/render.js` | Renders the seed `instructions.md` and `memory.md`. |
| `tests/adopt-project.test.js` | Adoption CLI behavior. |

- Docs: `jira-setup.md` lists `docs/setup/05-adopt-existing-projects.md` and `docs/agents/ADOPTION.md`.
