# Plan: modernise the usage telemetry display (Harness Leca)

**Not checked:** I couldn't reach 9Router at `127.0.0.1:20128` or `%APPDATA%/9router`; both were blocked. Anything about 9Router's database or API below is a guess to confirm in task 1. Everything else comes from reading the code.

## 1. What exists today, per provider
- **Shared pipeline:** `usage-runtime.js` runs a timer that writes `usage.observed` events into the per-project event store (`event-retention.js` keeps 180 days / 200k events). `usage-summary.js` serves `GET /api/project/:slug/usage/summary` (`central-events.controller.js`), grouped by day, model, session, origin or engine. Cost is an estimate of what the tokens would cost on the API, using `tools/lib/pricing/prices.json`. That price table is still marked `pending-user-review` and was fetched on 2026-10-24.
- **UI:** the "Consumo" tab is `office3d/orchestration/tab-usage.js`, built from `modules/usage-panel.js` and its `usage-api`, `usage-view-model`, `usage-view`, `usage-render` and `usage-format` modules, styled by `css/office/20-usage-panel.css`. It shows token and cost cards, daily bars, a model table, the top 10 sessions and a main-vs-subagent split. Usage only appears in the office panel, not the main UI.
- **Claude subscription:** we read token counts from `~/.claude/projects` transcripts (`usage-config.js`, `call-normalizer.js`). **Missing:** the plan, the 5-hour and weekly limits, percent used and reset times. Transcripts don't contain them.
- **Codex subscription:** we read `~/.codex/sessions` rollouts (`codex-ingestor.js`, `codex-config.js`). **Stale:** each `token_count` event also carries `rate_limits` (`codex-config.js` line 14 notes this), but `codex-call-normalizer.js` ignores it, so the free limit and reset data is thrown away. Codex ingest stats only show up nested under `usage.codex`.
- **Gemini/Antigravity:** nothing is collected for usage. `agent-activity.service.js` reads `~/.gemini/antigravity-ide/brain` transcripts only to show who is online.
- **OpenCode:** nothing is collected for usage. `~/.local/share/opencode/opencode.db` is only used for presence and chat import, even though its assistant messages store tokens, cost and model (to confirm).
- **9Router:** only a liveness probe (`tools/lib/engine-autostart.js`) and `tools/hia-combo-report.js`. That report covers combo *suggestions* in `logs/telemetry/hia-executions.jsonl`, not real usage. There is no per-combo or per-model usage, cost, fallback or error data. `combo-map.js` names the combos (`harness-planejamento`, `-implementacao`, `-design`, ...).
- **Structural gap:** the summary is per project, but subscription quotas are per account. A global read model is needed.

## 2. Unified data model (additive, no change to `usage.observed`)
- **`UsageCall`** (existing event, extended): `engine`, `provider`, `model`, `combo?`, `upstreamModel?`, `attempt`/`fallbackFrom?`, `status` (ok|error|ratelimited), `errorClass?`, `latencyMs?`, `tokens{input,output,cacheRead,cacheCreation,reasoning}`, `cost{amount,currency,kind: estimated|reported|subscription-included, basis}`.
- **`QuotaSnapshot`** (new event type `usage.quota`, global store): `provider` (claude|codex|gemini|opencode|9router), `plan` (e.g. Pro, Max, Plus, free), `window` (5h|weekly|daily|monthly), `used`, `limit`, `unit` (percent|requests|tokens|usd), `resetsAt`, `observedAt`, `source`, `confidence` (exact|derived|unknown).
- **`ComboStat`** (read model): `combo`, `model`, `calls`, `errors`, `fallbacks`, `p50/p95Latency`, `tokens`, `cost`, `lastAt`.
- Rules: unknown stays `null` (keep ADR-TEL-006 coverage). A subscription is never shown as cash spend; it's shown as a gauge, with the API-equivalent cost as secondary text.

## 3. Ingestion sources (read-only, no secrets)
- **Claude:** transcripts as today. For quota, the candidate is the `rate_limits` field that Claude Code's statusline hook receives: a tiny statusline script would append it to `logs/telemetry/claude-quota.jsonl`. Don't read OAuth tokens or call the account API. If that isn't available, fall back to a plan and limit the user enters in config.
- **Codex:** extend `codex-call-normalizer.js` to emit `usage.quota` from `rate_limits` (used percent, window minutes, resets). This includes the 11 events that carry only a rate-limit update.
- **Gemini/Antigravity:** a new `gemini-ingestor` over the brain `transcript.jsonl` and the Gemini CLI session files. Copy only token fields on an allow-list (same privacy rule as ADR-TEL-007). Quota comes from config, or stays `unknown`.
- **OpenCode:** a new `opencode-ingestor` that opens `opencode.db` read-only (the pattern in `presence-sources-db.js`) and keeps only per-message tokens, cost, model and provider IDs. Tag a message as 9Router when its provider is `9router`, so it isn't counted twice against the 9Router feed.
- **9Router:** first choice is its local HTTP usage/stats API on 127.0.0.1. Fallback is a read-only open of its database in `%APPDATA%/9router`. Never read the provider key tables; allow-list columns only. Add real per-call outcomes from `hia-chat-dispatcher.service.js` (status, fallback, latency).

## 4. Display proposal
- **Office panel (compact):** one strip of provider cards. Each card has a ring gauge (percent of the window used), a "resets in Xh" chip, a plan badge and a confidence badge (FontAwesome icons, no emoji). Below it, today's calls, errors and fallbacks, plus a link to the full view.
- **Main UI (new "Consumo" page):**
  - provider cards with stacked gauges (5-hour and weekly);
  - a combo table (combo → model rows; calls, error %, fallback %, p95, tokens, cost, last used);
  - a trend chart (daily stacked by provider; toggle between calls, tokens and cost);
  - a model leaderboard;
  - a coverage and price-table notice (pending review);
  - stale-data warnings when a source's `observedAt` is more than 1 hour old.
- **Shared code:** reuse `usage-view-model.js` and split the rest into small modules (`quota-gauges.js`, `combo-table.js`, `trend-chart.js`) to stay under the 200–300 line limit per file.

## 5. Ordered tasks
1. **(S)** Spike: inspect 9Router's API and database schema, opencode.db `message.data`, and the Claude statusline `rate_limits`. Output: field maps with no values.
2. **(M)** Add `usage.quota` to the event allow-list, a global store, and `GET /api/usage/quotas`. Tests: allow-list, retention, keeping the latest snapshot per window.
3. **(S)** Collect Codex `rate_limits`. Tests: fixture rollouts, including the 11 rate-limit-only events.
4. **(M)** Claude quota capture via the statusline script and an ingestor, plus a config fallback. Tests: parser, missing fields come out as `unknown`.
5. **(M)** OpenCode ingestor (read-only SQLite, checkpointed). Tests: temporary database fixture, idempotency, no double count with 9Router.
6. **(L)** 9Router ingestor plus a `ComboStat` read model and `GET /api/usage/combos`, with real dispatcher outcomes added. Tests: fixture database/API, error and fallback counts.
7. **(M)** Gemini/Antigravity token ingestor. Tests: fixture transcripts, privacy check that no content is kept.
8. **(M)** Office panel provider strip and gauges. Tests: view-model unit tests, a11y labels.
9. **(L)** Main UI page with the combo table and trend. Tests: view-model, empty, stale and error states; `npm test` stays green.
10. **(S)** Refresh `prices.json` (needs user review) and update `MAPA.md` and the docs.

## Open questions
- Which Claude, Codex and Gemini plans do you have, and are the limits from manual config acceptable when no source reports them?
- Can we add a Claude statusline hook to your Claude Code setup?
- Should 9Router traffic that comes through OpenCode be credited to the 9Router combo, to OpenCode, or both?
- Should usage stay per project, global, or both (default: quotas global, calls per project)?
- Should the price table be marked as reviewed so the "estimated" warning can go away?
