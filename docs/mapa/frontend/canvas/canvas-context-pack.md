---
domain: frontend
module: canvas
feature: canvas-context-pack
summary: Pure builder that turns a mind-map selection into a budgeted Markdown and JSON context pack for agents (EP-19.05).
paths: [ui/web/src/features/context-pack/*.ts, tests/context-pack*.test.js]
keywords: [context-pack, mindmap, agent, markdown, json, budget, truncation, ep-19]
updated: 2026-11-04
---
# Context pack (EP-19.05)

`buildContextPack(doc, selectedId, { budget, boardTitle })` takes the selected node, its whole subtree and its ancestor path. The kept set is chosen breadth first so a cut never leaves an orphan, and rendered in pre-order so Markdown and JSON describe the same tree. The Markdown never exceeds `budget` (default 4000, minimum 200).

| File | Responsibility |
|---|---|
| `ui/web/src/features/context-pack/types.ts` | Pack, options and JSON node types, schema id, default and minimum budget, text caps. |
| `ui/web/src/features/context-pack/selection.ts` | Subtree (breadth first), ancestor path, nested tree from kept entries and pre-order flattening. |
| `ui/web/src/features/context-pack/markdown.ts` | Text normalization and capping, path line, bullet rendering and the truncation marker. |
| `ui/web/src/features/context-pack/fitting.ts` | Length arithmetic for the budget: greedy prefix and the selected-node-only case. |
| `ui/web/src/features/context-pack/build.ts` | `buildContextPack`: budget clamp, truncation order, path cutting from the root side, empty pack. |
| `ui/web/src/features/context-pack/clipboard.ts` | `copyText(text, env?)`: Clipboard API with a hidden textarea fallback; never throws, returns a boolean. |
| `ui/web/src/features/context-pack/index.ts` | Public exports of the feature. |
| `tests/context-pack.test.js`, `tests/context-pack-clipboard.test.js` | Determinism, budget boundaries, truncation order, parity of Markdown and JSON, nesting and input immutability. |
