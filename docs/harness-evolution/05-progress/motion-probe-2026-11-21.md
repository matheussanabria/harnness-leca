# Motion probe, 2026-11-21 (EP-24.04, RF7)

Command: `node tools/motion-probe.js [--model ...]`. Real prompt (tag instruction plus proto context), real models through OpenCode free models, answers applied with the app's own motion tools to a temporary prototype. A failed first try is retried once with the tool errors.

## Default model
| Model | Scenario | First try | After correction | Orphan tracks | Note |
|---|---|---|---|---|---|
| opencode/deepseek-v4.1-flash-free | entrada | PASS | - | 0 | 1 track(s), 600 ms |
| opencode/deepseek-v4.1-flash-free | cascata | PASS | - | 0 | 3 track(s), 1200 ms |
| opencode/deepseek-v4.1-flash-free | destaque | PASS | - | 0 | 1 track(s), 1500 ms |
| opencode/deepseek-v4.1-flash-free | saida | PASS | - | 0 | 3 track(s), 3000 ms |

Valid on first try: 4/4; valid after one correction: 4/4.

## Two more models
| Model | Scenario | First try | After correction | Orphan tracks | Note |
|---|---|---|---|---|---|
| opencode/mimo-v2.6-flash-free | entrada | PASS | - | 0 | 1 track(s), 3000 ms |
| opencode/mimo-v2.6-flash-free | cascata | PASS | - | 0 | 3 track(s), 1200 ms |
| opencode/mimo-v2.6-flash-free | destaque | PASS | - | 0 | 1 track(s), 1500 ms |
| opencode/mimo-v2.6-flash-free | saida | PASS | - | 0 | 3 track(s), 3000 ms |
| opencode/nemotron-3.5-super-vl-free | entrada | PASS | - | 0 | 1 track(s), 600 ms |
| opencode/nemotron-3.5-super-vl-free | cascata | PASS | - | 0 | 3 track(s), 3000 ms |
| opencode/nemotron-3.5-super-vl-free | destaque | PASS | - | 0 | 1 track(s), 1500 ms |
| opencode/nemotron-3.5-super-vl-free | saida | FAIL | PASS | 0 | 3 track(s), 4000 ms |

Valid on first try: 7/8; valid after one correction: 8/8.

## Findings
- 11/12 valid on the first try and 12/12 after one correction, across three models; no orphan tracks (every target was a real `data-pid`).
- The one failure (nemotron, `saida`) was fixed by the model from the returned validation errors, which confirms RF3.
- Quality gap found: when a model builds the timeline with `motion_set_keys` only, the timeline took the 3000 ms default instead of the requested length (mimo `entrada`, nemotron `cascata`); the animation was right but held the last frame until 3 s. Fixed in the same story: without an explicit `duration`, a new timeline ends at its last key and an existing one grows to fit new keys (test in `tests/motion-tools.test.js`).
- Claude was not probed (it spends quota; run with `--engine claude --allow-claude` when wanted).
