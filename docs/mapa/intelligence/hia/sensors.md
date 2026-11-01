---
domain: intelligence
module: hia
feature: sensors
summary: Report-only checks of chat answers: syntax, lint, secrets, emoji, assertion-less tests and Mermaid in code blocks.
paths: [tools/lib/hia/sensors/*.js, tests/hia-sensors-*.test.js]
keywords: [sensors, quality gate, lint, biome, javac, python, json, mermaid, secrets, emoji, tests, hia]
updated: 2026-11-01
---
# Answer sensors

Deterministic checks that run on a chat answer after the quality gate. No model, no quota, and the code in the answer is never executed: it only goes to parsers (Biome, `ast.parse`, `JSON.parse`) and to `javac -proc:none`. Report-only: they never block, retry or edit the answer. `HIA_SENSORS=false` turns them off.

| File | Responsibility |
|---|---|
| `tools/lib/hia/sensors/index.js` | `runSensors(text)`: runs every fenced block through the sensors of its language plus the text rules, within a time budget (up to 12 blocks, 20 KB each); `summarizeErrors` gives the short chat notice. |
| `tools/lib/hia/sensors/extract.js` | Finds fenced code blocks with a normalized language tag and the line in the answer; detects an answer that ends inside an unclosed block. |
| `tools/lib/hia/sensors/exec.js` | Async process runner (does not block the chat server) and a temp-dir helper outside the repository. |
| `tools/lib/hia/sensors/biome.js` | Syntax errors (error) and lint findings (warning) for js, jsx, ts, tsx and css through Biome in a temp dir with its own config; unused or undeclared names and style rules are dropped as noise in partial snippets. |
| `tools/lib/hia/sensors/syntax.js` | JSON, Python and Java syntax. JSON with comments or `...` is treated as an illustration; javac errors count only when they are of the parse kind (unresolved imports and symbols do not). |
| `tools/lib/hia/sensors/rules.js` | Pure rules: secrets (value never shown), emoji in code (project rule), test code without assertions, Mermaid structure, unclosed code fence. |
| `tests/hia-sensors-rules.test.js` | Extraction and rule tests, kill switch and the answer-line shift. |
| `tests/hia-sensors-process.test.js` | Tests against the real Biome, Python and javac; a tool that is not installed skips its tests. |
| `tests/hia-sensors-engine.test.js` | The opencode engine with a fake turn: notice, `sensors` in the done event, unchanged answer, kill switch. |

Used by `tools/lib/engines/opencode.js`: errors become one `[Sensors]` line in the thinking stream, the findings go in the `onDone` payload (`sensors`) and the counts in HIA telemetry (`sensorErrors`, `sensorWarnings`, `sensorCodes`).
