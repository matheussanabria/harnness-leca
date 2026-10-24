# Atelier quality pilot - Stage 1, spike 2: first runs of the quality prompt

Date: 2026-10-24. Branch: `feat/atelier-quality-pilot`. Code under test: commit `6e38f1d` (opt-in quality prompt, `/directions` mode).

Legend: **[Fact]** observed in a run or file. **[Estimate]** derived, assumption stated. **[Gap]** not verified.

## 1. Summary

1. [Fact] The quality prompt works end to end on DeepSeek v4.1 flash with `--variant low`: two first-fold directions, saved through the real save and history path, inside the contract on every mechanical check.
2. [Fact] On the same model without a reasoning limit, two runs returned nothing. The model has a 32,000-token output limit shared between reasoning and the answer, and both runs spent all 32,000 on reasoning.
3. [Fact] Nemotron-3-ultra produced richer output but broke the contract: it used file tools and wrote into the repository root, wrapped screens in `<html>`/`<head>`, used 3 hex colours and invented 1 token.
4. [Fact] Run 1 was invalid for a second reason: Git Bash rewrote the `/directions` argument into a Windows path.
5. Recommendation: use DeepSeek v4.1 flash with `--variant low` as the pilot model, and the same model and settings for both flows in Stage 4.

## 2. Runs

Briefing: "Torra Nova" (fixed, see `01-stage0-audit.md`). Prompt in directions mode unless noted. All on free-tier OpenCode models.

| # | Model and settings | Valid | Time | Tokens (reported) | Outcome |
|---|---|---|---|---|---|
| 0 | DeepSeek flash, legacy prompt (Stage 0 baseline) | yes | 160 s | 56,334 (23,474 in, 9,460 out, 19,304 reasoning) | Full page, mean rating 4.8 |
| 1 | DeepSeek flash, no variant | **no**: `/directions` became `C:/Program Files/Git/directions`, prompt was in compose mode | 181 s | 62,064 (3,440 in, 0 out, 32,000 reasoning) | Empty reply |
| 2 | DeepSeek flash, `--variant minimal` | yes (mode confirmed in the prompt file) | 168 s | 62,179 (611 in, 0 out, 32,000 reasoning) | Empty reply. `minimal` is not a DeepSeek variant, so it was ignored |
| 3 | DeepSeek flash, `--variant low` | yes | 83 s | 46,536 (30,183 in, 9,896 reasoning, 6,457 out) | 3 files saved, contract met |
| 4 | Nemotron-3-ultra, no variant | yes | 155 s | 4 step events: 33,770 / 37,417 / 41,442 / 41,584 | 0 files in the reply; files written to the repo root with its own tools |

[Gap] Whether the four Nemotron step totals overlap (cached context counted more than once) was not verified, so no sum is claimed.

## 3. Findings

### 3.1 Output cap and reasoning
- [Fact] `opencode models opencode --verbose` reports `limit.output = 32000` for DeepSeek v4.1 flash, glm-5.3-flash, big-pickle and mimo-v2.6-flash; 65,536 for flint-40b; 128,000 for nemotron-3-ultra; 131,072 for beam-free and nemotron-3.5-super-vl; 262,144 for nemotron-3.5-lightning.
- [Fact] DeepSeek's valid variants are `low`, `high`, `max`. With `low`, reasoning fell from 32,000 to 9,896 tokens.
- [Estimate] The Stage 0 baseline used 28,764 of the 32,000 (reasoning plus answer), so it was already near the cap. The longer quality prompt (about 2,263 tokens of rules) pushed reasoning over it without a limit.
- Consequence: any pilot run on a 32k-output model must set reasoning to `low`. Stage 4 compares flows on one model with one setting, and the baseline should be re-run with `low` too, because the Stage 0 baseline ran without it.

### 3.2 Contract checks (mechanical, not a quality verdict)

| Check | Run 3 (DeepSeek `low`) | Run 4 (Nemotron) | Stage 0 baseline |
|---|---|---|---|
| Delivered as `<arquivo>` blocks in the reply | yes | **no** | yes |
| Hardcoded hex colours in CSS | 0 | 3 | 17 |
| Own `:root` tokens defined | 0 | 0 | 11 |
| Tokens used that are not in the palette | none | `--primary-muted` | not applicable (no Design System) |
| `<html>` or `<head>` in a screen | no | yes, both | no |
| Scripts, `on*` handlers, external URLs, images, emoji | none | none | none |
| Single `h1`, header/nav/main/footer | yes | yes | yes |
| Class prefixes `da-` / `db-` | followed | followed | not applicable |
| `@media` blocks | 1 | 3 | 3 |
| `aria-` attributes (per screen) | 7 and 6 | 17 and 20 | 1 (whole page) |
| Size of screens | 78 and 58 lines | 136 and 180 lines | 253 lines (one full page) |

Cautions: the baseline had no Design System to use, because the legacy prompt never sends one; its hex colours and invented tokens reflect that. Counting `header` and `footer` as Design System classes is weak, since they may be the model's own names. One `@media` block in a 434-line stylesheet leaves responsive behaviour unverified until the render review exists.

### 3.3 Harness issues found
- [Fact] Git Bash path conversion rewrites an argument that starts with `/`. Run the driver with `MSYS_NO_PATHCONV=1`, or pass the command through an environment variable.
- [Fact] `opencode run` treats `-f` as an array option: put the message before `-f`, or the message is read as a file path.
- [Fact] Multi-line prompts break through nested shells; attach the prompt as a file.
- [Fact] An engine that is allowed to use tools can write into the repository during an Atelier run (Nemotron wrote three untracked files in the repo root). [Gap] How the harness restricts the OpenCode engine in the real chat was not checked and should be before the pilot uses a tool-capable model.
- The output language follows the briefing: the closing notes came back in Portuguese for a Portuguese briefing, although the prompt is English.

## 4. Cleanup performed (approved)
- Nemotron's three stray files were saved into the prototype `quality-dir-nemotron` through the normal save path (CSS byte-identical; HTML gains `data-pid`), then the originals were removed from the repo root. They had never been tracked.
- The empty scaffold `quality-directions-torra-nova` (left by the failed runs) was deleted. Earlier in the session, the first failed run's copy of the same folder was deleted without asking first; it was an untouched scaffold created minutes before.

## 5. Spend so far (free tier)
[Estimate] Reported tokens across Stage 1 runs 1-3: 62,064 + 62,179 + 46,536 = 170,779, plus run 4. Only run 3 produced usable output. The approved ceiling is 300,000 tokens per pilot run, so the failed runs show why a hard stop and a per-run reasoning limit are needed.

## 6. Open items
1. User ratings of `direction-a` and `direction-b` in `quality-dir-deepseek-low` (rated separately from the full-page baseline).
2. Direction selection record next to `proto.json` (not built).
3. Re-run the baseline with `--variant low` so both flows share settings.
4. Decide whether the legacy flow also receives the Design System in Stage 4.
5. Move the driver scripts (`baseline-run.js`, `quality-run.js`, in the scratchpad) into the repo, for example `tools/atelier-pilot/`, so Stage 4 is reproducible.
6. Render review with `playwright-core` on the installed Edge.
