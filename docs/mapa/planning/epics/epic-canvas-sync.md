---
domain: planning
module: epics
feature: epic-canvas-sync
summary: Projects an epic folder (story frontmatter) into a Canvas mind-map board and keeps its status in sync.
paths: [tools/epic-canvas.js, tools/lib/epic-canvas/*.js, tests/epic-canvas.test.js, .agents/skills/epic-evolution-architect/SKILL.md]
keywords: [epic, canvas, mindmap, status, sync, story, skill, epic-evolution-architect]
updated: 2026-11-04
---
# Epic to Canvas sync

One-way projection: story files are the source of truth, the Canvas board `Epic EP-xx` is a view.

| File | Responsibility |
|---|---|
| `tools/epic-canvas.js` | CLI: `<epic-dir> [--out file] [--push <base-url> --project <slug>]`. |
| `tools/lib/epic-canvas/parse.js` | Reads README and `NN.NN-slug.md` frontmatter into `{id,title,status,stories[]}`. |
| `tools/lib/epic-canvas/mindmap.js` | Builds the `mindmap@1` document: root with done/total, one node per story with `[status]` and `after` dependencies. |
| `tools/lib/epic-canvas/push.js` | Creates or updates the board through `/api/canvas/boards` with the `rev` check. |
| `tests/epic-canvas.test.js` | Frontmatter parsing, story collection, valid single-root tree. |
| `.agents/skills/epic-evolution-architect/SKILL.md` | Step 6 tells the skill to mirror the epic on the Canvas. |
