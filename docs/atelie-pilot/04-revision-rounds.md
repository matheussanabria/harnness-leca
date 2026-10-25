# Atelier quality pilot - revision rounds on the legacy output

Date: 2026-10-24. Branch: `feat/atelier-quality-pilot-2`. All runs: DeepSeek v4.1 flash (free tier), `--variant low`, briefing v2 (`briefing-torra-nova-v2.txt`, fixed content).

Legend: **[Fact]** measured or read in a run or file. **[Estimate]** derived, assumption stated. **[Gap]** not verified.

## 1. Summary

1. [Fact] On identical content, the legacy flow (no Design System) produced the output both assessors preferred visually; the quality flow (kit + new rules) produced fewer measurable defects but a plainer page.
2. [Fact] Fixing the legacy output's six contrast findings by asking the model to rewrite files (round 1) or to emit a CSS patch (p1, p2) was unreliable: one finding was fixed only in the second patch round, and two patches made the same element worse.
3. [Fact] A deterministic script resolved all six findings with no model call: 0 tokens, 6 ms of computation, 10.6 s including the review of the copy in a real browser.
4. [Fact] The review report was the weak link: it did not say which colours were measured, which elements owned the background, or at which widths a finding occurs. It now does.
5. [Gap] Spacing between the last benefit and the plan button is not arithmetic and was not fixed by the script. Only round 2 (`v2-legacy-r2`) was seen fixed in a render.

## 2. Runs

| Run | Method | Time | Tokens, raw total | Own tokens [Estimate] | High findings (home + confirmation) |
|---|---|---|---|---|---|
| `v2-legacy` | Legacy generation | 87 s | 47,568 | 20,944 | 4 + 2 |
| `v2-quality` | Quality generation (kit, rules) | 131 s | 59,374 | 32,750 | 0 + 0 |
| `v2-legacy-r1` | Full-file revision with the findings | 70 s | 53,584 | 26,960 | 1 + 0 (hero button got worse: 3.67 to 2.81:1) |
| `v2-legacy-r2` | CSS override patch on r1 | 33 s | 40,108 | 13,484 | 0 + 0 |
| `v2-legacy-p1` | CSS patch on the original, one step | 41 s | 41,263 | about 14,600 | 1 + 0 (hero button 2.33:1) |
| `v2-legacy-p2` | Same, with computed colours in the report | 27 s | 41,696 | 15,072 | 1 + 0 (hero button 2.63:1) |
| `v2-legacy-c1` | Deterministic contrast repair | 10.6 s | 0 | 0 | **0 + 0** |

"Own tokens" excludes OpenCode's fixed system prompt of about 26,600 tokens, which appears as cache-read when the cache is warm (r2, p2) and as input when it is cold (p1: 37,224 input and 1,792 cached). Raw totals are not comparable across runs for that reason. The estimate is input plus cache-read minus 26,624, plus reasoning and output.

## 3. Findings

### 3.1 Why model patches failed on the hero button
- [Fact] The original's label is `rgb(51, 36, 26)` on `rgb(185, 106, 46)` (3.67:1), although the stylesheet declares `color: #fff7ee` for the class. Another rule overrides it.
- [Fact] Round 1 flipped the label darker. p1 darkened the background and left the dark label, so contrast fell to 2.33:1. p2 had the measured colours in its report and still wrote "light label kept" in its own comment: the model trusts the stylesheet over the measurement. r2 passed because its patch set `color` explicitly.
- Lesson: contrast repair does not need a model.

### 3.2 Deterministic contrast repair (`tools/atelier-pilot/contrast-fix.js`)
- Keeps the polarity of the text and moves the text colour as little as needed; changes the background only when the element owns it; skips and reports anything else.
- Each rule is scoped to one element (`data-pid`) on one screen and wins by specificity (`:not(#_)`), without `!important`.
- Applied to the original: the hero label went from `rgb(51, 36, 26)` to `rgb(21, 15, 11)`; the Barista and confirmation buttons and the badge went from `rgb(185, 106, 46)` to `rgb(163, 93, 40)`; the footer notes moved by 5 per channel. Rendered desktop view: layout, stamp, dark card, testimonials band and flow unchanged.
- [Gap] Not checked: mobile views of the repaired copy by eye (the review reports no overflow and no remaining findings at 360 to 1440 px), and prototypes where a text node sits on a gradient or image (the review cannot measure those, so the script never sees them).

### 3.3 Review report improvements
- Contrast findings carry the computed text and background colours, the `data-pid`, whether the element owns its background, and every width where they occur (an earlier version showed only the first width, which led to the wrong "fails only at 360 px" reading).
- Links to anchors that do not exist are flagged.
- The earlier claim that a 390 px layout overflowed came from command-line Edge having a minimum window width, not from the page; the Playwright viewport is accurate.

## 4. Assessments on identical content
Two assessments of desktop screenshots, both favouring `v2-legacy` visually: the second assessor scored legacy 4.3 and quality 4.1 (hierarchy 4.5 / 4.0, identity 4.5 / 3.0, readability 3.5 / 4.5, goal 4.5 / 4.5, consistency 4.5 / 4.5). Earlier on different content, the baseline was scored 4.8 by the user and 4.1 by the second assessor. These are editorial scores of one run each, not measurements.

## 5. Recommended loop (to be confirmed with more briefings and models)
1. Generate with the flexible prompt (legacy flow, or the quality prompt when Design System fidelity matters).
2. Render review at 360, 390, 768 and 1440 px.
3. Deterministic contrast repair on a copy.
4. Model patch only for what the script skipped or what is not arithmetic (spacing, structure), using a CSS override block and the measured evidence.
5. Review again; stop after two rounds and report what remains.

## 6. Limits
One briefing, one model, one run per method, free-tier engine, Edge only. Costs are for a single execution. The comparison does not show that the Design System caused the quality flow's plainer look: the kit, the rules and the generation prompt changed together.

## 7. Open items
1. Spacing between a card's last benefit and its button: decide between a model patch and a review check that flags touching elements.
2. Visually inspect the mobile renders of the repaired copy.
3. Move the driver scripts (`quality-run.js`, `revise-patch.js`, the briefing runner) from the scratchpad into the repository so the comparison is reproducible.
4. Decide how the Atelier chat exposes this: a "review and fix" action that runs steps 2 to 5 behind the per-project flag.

## 8. Best-of composite round (2026-10-25)

Brief: the user compared `baseline-torra-nova` (judged the most professional), `v2-legacy-r2` and `v2-quality` and listed what to take from each. The composite keeps the baseline as its base, takes named parts of the two references, and uses the fixed content of briefing v2. Spec: the user's lists plus one merge decision (all three lists mentioned the closing CTA; it became one CTA card inside a dark section).

| Attempt | Model | Result |
|---|---|---|
| `v3-composite` | DeepSeek v4.1 flash, 92,000-character prompt | No answer: the model read the attached file with its own tools, and the read was rejected (outside its directory) |
| `v3-composite-c2` | DeepSeek v4.1 flash, 39,000-character prompt | Answered, but 28,594 reasoning plus 3,406 output tokens hit the 32,000 cap and the page was cut off |
| `v3-composite-flint` | flint-40b-free | 321 s, 32,000 output tokens, no complete file block |
| **`v3-composite-beam`** | beam-free (131,072 output limit), `--variant low` | 27 s, 43,441 raw tokens (7,427 output, 188 reasoning), two complete files saved |

Findings:
- [Fact] Prompts above roughly 40,000 characters make the free DeepSeek model read the attachment with tools instead of answering. The compact prompt (full base page, only the named HTML fragments of the references, `data-pid` stripped, CSS minified) fixed it.
- [Fact] A task with about 20 combined instructions makes 32k-output models spend nearly all of their budget on reasoning. beam-free answered directly.
- [Fact] The review of the beam page found 10 contrast findings; the deterministic repair cleared them in 7.6 to 9.9 s with 0 tokens, 0 high findings after a four-width review.
- [Fact] Two defects in the review itself were found and fixed: findings with identical text but different elements were merged (so one of two identical buttons never reached the repair), and the report was capped at 8 findings per width.
- [Fact] A repair policy matters visually. The default "keep-polarity" lightened the hero button's background (pale peach with a dark label). The new "keep-background" policy flips the label to near-white on the original terracotta and was judged better by eye. It is a policy choice, not a measurement.
- [Gap] The composite follows the spec's structure (eyebrow labels, logo mark, four-item info row, kickers, quotation icons on a dark testimonials section, CTA card, footer contact, fixed prices and delivery wording). It does not keep the baseline's strongest element, the dark product card and the dark highlighted Barista plan, and the "Como funciona" icons are a generic glyph that was not confirmed to be a coffee bean. Mobile was not viewed by eye (the review reports no overflow at 360 to 1440 px). One run, one model.

### 8.1 Final attempt: `v4-composite` and `v4-composite-fix`
Same compact method, with the two baseline elements made mandatory (dark tilted product card with stamp; dark Barista plan), a light footer to keep the dark/light alternation, an exact description of the bean icon and minimum text sizes. beam-free, `--variant low`: 25 s, 6,556 output tokens, 17,892 input, two complete files. Review: 6 contrast findings; the deterministic repair with `--policy keep-background` cleared them in 7.2 s with 0 tokens (0 high at four widths). All fixed prices and the Thursday dispatch wording are present; no "até sexta".

Rendered at 1440 px, it now has: the dark bag card and gold stamp in the hero, the four-item info row, kickers above every section title, bean markers in "Como funciona", the dark Barista card with a light button and a "Mais escolhido" tab, a dark testimonials section with quotation icons, a CTA card inside a dark section, and a light footer with contact. Remaining defects seen by eye (not caught by the review): the Barista button sits about 15 px lower than the other two plan buttons; its label reads pale although it meets the ratio, because the repair stops at the minimum; section titles wrap and leave a single word on the second line ("xícara.", "rotina."); the bean markers show the tilted ellipse without a visible centre line. Mobile was not viewed by eye. One run, one model.
