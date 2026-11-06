---
domain: tools
module: canvas
feature: canvas-chat-probe
summary: Probe that checks whether real models obey the <mindmap> and <board> chat formats of the Canvas bridges (P-109).
paths: [tools/canvas-chat-probe.js, tools/lib/canvas-probe/*.js, tests/canvas-chat-probe.test.js]
keywords: [canvas, probe, mindmap, board, mermaid, chat bridge, P-109, opencode, validation]
updated: 2026-11-06
---
# Canvas chat probe

Runs a battery of scenarios against a real engine and judges each answer with the app's own code: the legacy bridge (`ui/public/js/modules/canvas-chat-bridge.js`) builds the prompt and extracts blocks; the island parsers (`parseOutline`, `normalizeBoardBlock`) check them. Node 24 imports the `.ts` sources directly. Default engine is the free opencode; `claude` needs `--allow-claude`.

| File | Responsibility |
|---|---|
| `tools/canvas-chat-probe.js` | CLI: `--list`, `--dry` (prompts only), `--engine`, `--model a,b`, `--only`, `--repeat`, `--allow-paid` (9Router combos, OpenRouter), `--out` (Markdown), `--raw` (answers JSON). |
| `tools/lib/canvas-probe/scenarios.js` | 14 scenarios (7 mind map, 7 board): create, expand, replace, depth, chat-only, resumed session, recovery after an ignored first reply, unsupported Mermaid type. |
| `tools/lib/canvas-probe/bridge-env.js` | Loads the bridge and the TS parsers under plain Node with a window stub. |
| `tools/lib/canvas-probe/prompts.js` | Builds the exact app prompt; approximates a resumed session with a transcript (rules not repeated). |
| `tools/lib/canvas-probe/judge.js` | Verdict and codes per answer (NO_BLOCK, WRONG_MODE, TOO_FEW_NODES, OVER_DEPTH_LIMIT, UNSUPPORTED_TYPE, NO_EDGES...). |
| `tools/lib/canvas-probe/report.js` | Markdown table per scenario and model, plus pass rate. |
| `tests/canvas-chat-probe.test.js` | Judge, prompt builder and report with canned answers (no model). |
