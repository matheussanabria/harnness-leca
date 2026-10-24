# Atelier quality pilot - Stage 0: audit and baseline

Date: 2026-10-24. Branch: `feat/atelier-quality-pilot`. Read-only audit plus one baseline generation. No production code changed.

Source plan: `docs/atelie-resumo-executivo-plano-aprovacao.md` (approval record in section 9 is still pending for the pilot itself).

Legend: **[Fact]** verified in a file or command cited. **[Estimate]** derived, with the assumption stated. **[Gap]** not verified.

Method: static audit run on the free OpenCode model `opencode/deepseek-v4.1-flash-free`, then every key claim re-checked against the code by hand. The baseline reproduces the current chat-to-prototype flow headlessly (see section 5).

## 1. Summary

1. [Fact] The prompt sent to the model contains output-format rules only. It has no guidance on visual quality, hierarchy, tokens, responsiveness or alternatives (`ui/public/js/modules/prototype-chat-bridge.js:18-25`).
2. [Fact] The Design System reaches the preview sandbox and the component catalog, but not the model. The only link is an optional MCP instruction that fires when the project profile sets `mcpServer` (`prototype-chat-bridge.js:73-75`).
3. [Fact] No screenshot or visual-review code exists for prototypes. `package.json` has no dependencies. Playwright is only used by `tools/ds-docs/capture-site.js`, which captures Design System DOM and is not part of the test run.
4. [Fact] A chat reply is applied automatically after the stream ends (`chat-send.js:296`, `applyAtelierReply`), saved through `withHistory`, with no review step.
5. [Fact] The `ux-ui-designer` and `frontend-engineer` contracts live outside this repo (`../dai/.agents/`). They describe textual prototypes and Design System use. Neither asks for alternatives or render review. The agent is optional: `activeDaiAgent` defaults to empty (`chat-store.js:29`) and only `AGENT.md` is injected.
6. [Fact] 45 test files cover the Atelier and Studio. Gaps: the MCP-rule branch, the client apply POSTs, route-level handlers, and anything visual.
7. [Fact] The baseline cost 56,334 tokens and 160 s for one generation on a free model.

Conclusion: the plan's premise holds for this repository. The cheapest lever is the prompt (briefing, direction, Design System context). The riskiest piece is render review, because it adds the first dependency.

## 2. Current flow

```
chat message
  -> chat-send.js:216  wrapAtelierPrompt()        RULES (format only) + current screen HTML/CSS
  -> engine (daiAgent travels separately, chat-send.js:222)
  -> reply stream ends
  -> chat-send.js:296  applyAtelierReply()
  -> POST /api/project/:slug/design/prototypes/:id/files   {rawResponse}
  -> prototype.controller.js:133  apiPrototypesSaveFiles
       parseDelimitedFiles -> withHistory(kind:"files") -> savePrototypeFiles (version bump, snapshot)
  -> prototype-atelier.js refreshAtelierPreview()  reloads the iframe in place
```

Session logic in `wrapAtelierPrompt` (`prototype-chat-bridge.js:64-72`): a fresh session sends rules plus code; a resumed session with unchanged content sends only the request; changed content sends a "changed since last message" wrapper.

## 3. Findings by question

### 3.1 Prompt
- Rules: exact `<arquivo caminho="...">` blocks, body fragment only (no `<html>`, `<head>`, `<script>`, `on*` handlers), allowed paths `screens/<id>.html`, `styles/proto.css`, `data/*.json`, rewrite the whole file, then explain in 1-2 sentences.
- Nothing about design quality, layout patterns, breakpoints, naming, tokens or the Design System.
- The prompt text is in Portuguese; project rules now require English for agent-facing files, so a new prompt should be English (decision for Stage 1).

### 3.2 Agents and skills
- Stage-to-agent mapping: `prototype` and `extracted` go to `ux-ui-designer`; `design_system` and `boilerplate` go to `frontend-engineer` (`global/design/defaults.json:30-34`).
- No `AGENT.md` or `manifest.yaml` inside this repo. `tools/lib/dai.js:7` hardcodes `C:\Users\matheuss.rodrigues\git\DAI`.
- `ux-ui-designer` delivers text wireframes and textual prototypes, reads the project Design System, and only asks to "validate visual fidelity with QA" in the tests stage.
- No Atelier module references either agent or any skill directly.

### 3.3 Render review
- No `screenshot`, `puppeteer`, `html2canvas`, `captureScreenshot` or canvas capture in `ui/`, `tools/`, `tests/` or `package.json`. The only hit is vendored `three.min.js`.
- Visual feedback available today is DOM metrics from the bridge (`HARNESS_PROTO_METRICS`, `prototype-atelier-messages.js:35`).
- [Gap] Not verified: vendored or minified code could contain unused capture APIs. Nothing was run in a browser.

### 3.4 Design System
- `window.DOCS` is read only by the import tooling (`tools/ds-docs/extract.js`, `tools/import-ds-docs.js`), which writes `design/ds/components/`, `registry.json`, `tokens.css`, `components.css`.
- The sandbox injects `tokens.css`, `theme.css`, `components.css`, `styles/proto.css`, `head.html` into the iframe (`prototype-sandbox-common.service.js:18-44`).
- The model sees no tokens, component inventory or component HTML.
- [Gap] Whether any MCP server is connected at runtime was not verified. `projects/saude-dispensacao/design/profile.json` has no `mcpServer`. The `harness-leca` project has no `design/profile.json` at all; its nine prototypes (`contabilidade`, `dentista`, `mercado-livre`, `moda`, `portfolio`, `portfolio-2`, `salao`, `tecnologia`, `teste-haiku`) were created with `engine: "manual"`, so their original briefings were not recorded.

### 3.5 Contracts to preserve
| Area | Contract |
|---|---|
| Preview | `GET .../prototypes/:id/render/:screenId`: restrictive CSP, nonce, injected bridge |
| Inspector | iframe to parent `HARNESS_PROTO_SELECT`, `_METRICS`, `_TREE`, `_GOTO`, `_READY`, `_MULTI_CLICK`, `_SET_MULTI`, `_SHORTCUT`; parent to iframe `HIGHLIGHT`, `SELECT_BY_PID`, `TOGGLE_VISIBILITY`, `TOGGLE_LOCK`, `CLEAR_HIGHLIGHT`, `MODE` (18 message types in total) |
| Save | `POST .../files` with `{files}` or `{rawResponse}`; sanitizes HTML, injects `data-pid`, bumps `version`, snapshots, runs in `withHistory(kind:"files")` |
| Edit | `POST .../edit/apply` ops `setText/setClasses/setAttr/setToken/setStyles/setHtml/moveTo`; fingerprint mismatch returns 409; structural ops on `.../edit/structural` |
| History | `withHistory`; journal and content-addressed blobs in `.history/`; max 150 entries; routes `history`, `undo`, `redo`, `goto`, `checkpoint` |
| `proto.json` | `{schema:1,id,title,version,activeScreen,screens:[{id,title,file}],components:[],metadata:{engine,createdAt,updatedAt,lastEngine}}` |

### 3.6 Tests
45 files under `tests/prototype-*.test.js` and `tests/studio-*.test.js`. Prompt building is covered by `prototype-chat-bridge.test.js`. Gaps: MCP-rule branch, `applyAtelierReply` and `applySingleFileToAtelier` POSTs, route-level handlers for `/files` and `/edit/apply`, and any visual or DOM-snapshot test. Test execution and coverage were not run in this stage.

## 4. Gap against the plan

| Plan front | State today | Work implied |
|---|---|---|
| Briefing | No structure; the user's chat message is the briefing | Briefing record plus prompt section |
| Visual direction | No alternatives step | Two-frame first-fold generation; canvas already supports one frame per screen |
| Design System | Not in the prompt | Compact component and token summary in the prompt; log gaps |
| Content | Not addressed | Prompt rule for representative and fictional data |
| Interactions | Data files allowed; no guidance | Prompt rule plus review check |
| Review | None | New: render, capture, checks, bounded correction rounds |
| Traceability | `withHistory` plus `proto.json` metadata | Add direction and review records next to `proto.json` |

## 5. Baseline

Purpose: a reference for the Stage 4 comparison. One run, one model, so it is initial evidence only.

**Method.** `baseline-run.js` (scratchpad, not in the repo) creates a scratch prototype with the real `initPrototype`, builds the fresh-session prompt from the real `RULES` text and the real default screen, sends it to OpenCode, parses the reply with the real `parseDelimitedFiles`, and saves with the real `withHistory` plus `savePrototypeFiles`. The prompt was passed to the model as an attached file because multi-line arguments broke through the shell; this differs slightly from the chat path.

**Fixed briefing** (kept for the Stage 4 comparison): landing page for "Torra Nova", a fictional weekly-roasted specialty coffee subscription. Audience 25-45, online buyers. Primary action "Comecar assinatura". Content: value proposition, 3-step how it works, 3 plans (Explorador, Barista, Mestre) with fictional prices, 2 testimonials, 3 FAQ items, footer. Identity: warm, artisanal, premium, avoid a generic template look. Constraints: fully fictional data, no external images, desktop and mobile.

**Result** (prototype `baseline-torra-nova`, in `projects/harness-leca/design/prototypes/`, gitignored):

| Measure | Value | Source |
|---|---|---|
| Model | `opencode/deepseek-v4.1-flash-free` | run |
| Wall time | 160 s | measured |
| Tokens total | 56,334 | OpenCode `--format json` |
| Input / output / reasoning | 23,474 / 9,460 / 19,304 | OpenCode (reasoning is 34% of total) |
| Cache read | 4,096 | OpenCode |
| Cost | unavailable (free tier) | not reported |
| Saved OK through history | yes | `savedOk: true` |
| Files | `screens/home.html` 10,683 chars (253 lines); `styles/proto.css` 16,859 chars (196 lines) | run |

Mechanical observations (not a quality verdict): no external URLs, no images or SVG, no emoji, 3 `@media` blocks, 10 CSS custom properties, two font stacks via variables, all three plan names present, a FAQ present, one `aria-` attribute in the whole page.

**Quality ratings** (user, 1-5, from opening the prototype in the Atelier):

| Criterion | Score |
|---|---|
| Hierarchy | 5 |
| Identity | 5 |
| Legibility | 4 |
| Fit to objective | 5 |
| Consistency | 5 |
| Mean | 4.8 |

Implication: on this briefing the current flow already scores near the ceiling, so a "higher mean than baseline" rule can barely be met (maximum gain 0.2). Stage 4 needs either a harder briefing (more screens, data states, a Design System constraint) or criteria that separate the runs by measurable checks (overflow at 360/390/768/1440 px, keyboard path, contrast, Design System adherence) as well as the 1-5 ratings. Usability, rework and regressions are still **not measured**: no width, overflow or keyboard check has been run.

## 6. Proposed consumption ceiling (needs your approval)

[Estimate] Assumptions: the baseline's 56,334 tokens is one full-page generation; each alternative of the first fold costs about 0.4x; composition about 1.3x because the prompt carries Design System context; each correction round about 0.8x because it resends code.

| Step | Estimate (tokens) |
|---|---|
| Two first-fold alternatives | ~45,000 |
| Composition | ~73,000 |
| Up to two correction rounds | ~90,000 |
| Total expected | ~210,000 (about 3.7x baseline) |

Proposed ceiling: **300,000 tokens** per pilot run on a free model, with a hard stop and a report if exceeded. Reasoning tokens dominate on this model, so set the variant to low reasoning where available. If a paid or quota-limited engine is ever used for the comparison, the ceiling must be restated in that engine's units.

Effort estimate (engineering, excluding review sessions): prompt and briefing record, small; Design System summary for the prompt, small to medium; render and capture step, medium (first dependency, needs a decision on Playwright); review checks and bounded correction loop, medium; opt-in switch and tests, small. Nothing here is committed to a date.

## 7. Decisions (2026-10-24)

| # | Decision | Status |
|---|---|---|
| 1 | Consumption ceiling of 300,000 tokens per pilot run, hard stop and report if exceeded | Approved (user followed the recommendation) |
| 2 | Baseline ratings recorded in section 5 (mean 4.8) | Done |
| 3 | Render review dependency | Recommendation below; awaiting confirmation |
| 4 | Design System source: none exists for `harness-leca`; extract from `Downloads/Framework de componentes próprio/Design System v2.dc.html` | Decided. Open issue below |
| 5 | Prompt language: English | Decided |
| 6 | Activation: opt-in per project through the profile | Decided |

**Render review dependency (recommendation).** Use `playwright-core` as an optional dev dependency, launched with `channel: "msedge"` so it drives the Microsoft Edge already installed on Windows. [Fact] `msedge.exe` is present at `C:\Program Files (x86)\Microsoft\Edge\Application\`. This avoids downloading a bundled browser (about 150 MB) and keeps the same API that `tools/ds-docs/capture-site.js` already expects. The review step stays opt-in, so the base install and `npm test` are unaffected. [Gap] Capture behaviour on a machine without Edge is not handled; the step must fail with a clear message instead of silently skipping.

**Design System source (open issue).** [Fact] `Design System v2.dc.html` is a 318 KB file with no `window.DOCS`, so `tools/ds-docs/extract.js` cannot read it as is. It carries `ext-resource-dependency` metadata and a `dc-script` block, which suggests a different generator. [Gap] Its internal structure was not inspected. Stage 1 starts with a short spike to decide whether to adapt the extractor or write a second reader, and to confirm the result fits the prompt budget as a compact summary of tokens and components.
