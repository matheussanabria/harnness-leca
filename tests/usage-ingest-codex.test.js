// @ts-check
// T3.4: Codex rollout usage ingest (per-call usage, dedup, checkpoints, subagent exclusion, privacy, bounds).
const os = require("os");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-codex-usage-"));
process.env.HARNESS_ROOT = TMP_ROOT;
const SLUG = "demo-proj";
fs.mkdirSync(path.join(TMP_ROOT, "projects", SLUG), { recursive: true });

const store = require("../ui/server/services/events/event-store");
const { createCodexIngestor } = require("../ui/server/services/usage-ingest/codex-ingestor");
const { summarizeUsage } = require("../ui/server/services/usage-ingest/usage-summary");
const runtime = require("../ui/server/services/usage-ingest/usage-runtime");
const fx = require("./codex-usage-fixtures");

const NOW = Date.parse("2026-10-24T12:00:00.000Z");
const OLD = NOW - 3600 * 1000;
let seq = 0;

test.after(() => {
  store.closeStore(SLUG);
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

function setup() {
  const home = fx.makeHome(path.join(TMP_ROOT, `codex-${++seq}`));
  return { home, dir: path.join(TMP_ROOT, `codex-${seq}`) };
}

function ingestor(dir, extra = {}) {
  const estimator = (/** @type {any} */ c) => (c.model === "gpt-5.4" ? { amount: 0.25, currency: "USD", kind: "estimated", basis: "api-equivalent", priceTableVersion: "t", missing: [] } : null);
  return createCodexIngestor({
    codexHome: dir, now: () => NOW, host: "h", estimator,
    resolveProject: (c) => (c.includes("demo-proj") ? SLUG : null), ...extra,
  });
}

const usageEvents = () => store.readEvents(SLUG, { types: ["usage.observed"], limit: 5000 }).events;
const mine = (/** @type {string} */ id) => usageEvents().filter((e) => e.sessionId === `codex:${id}`);

/** Standard rollout: 3 calls, one re-emitted total, one rate-limit-only event, a message that mentions token_count. */
function standardLines(id) {
  return [
    fx.metaLine(id), fx.turnLine("gpt-5.4"), fx.messageLine(),
    fx.tokenLine({ last: { input_tokens: 100, cached_input_tokens: 40, output_tokens: 10, reasoning_output_tokens: 4, total_tokens: 110, cache_write_input_tokens: 5 } }),
    fx.tokenLine({ last: { input_tokens: 100, cached_input_tokens: 40, output_tokens: 10, reasoning_output_tokens: 4, total_tokens: 110 } }),
    fx.tokenLine({ nullInfo: true, last: {} }),
    fx.tokenLine({ last: { input_tokens: 50, cached_input_tokens: 0, output_tokens: 7, total_tokens: 57 }, total: { input_tokens: 150, cached_input_tokens: 40, output_tokens: 17, total_tokens: 167 } }),
  ];
}

test("per-call usage comes from last_token_usage; re-emitted totals and null info are skipped; null vs 0", () => {
  const { home, dir } = setup();
  const id = fx.uuid();
  home.addThread(id, "C:\\work\\demo-proj");
  // Second event first repeats the first total exactly (same call re-emitted).
  const lines = standardLines(id);
  lines[4] = lines[3];
  home.rollout(id, lines, { mtimeMs: OLD });
  const ing = ingestor(dir);
  ing.tick();
  const ev = mine(id);
  assert.equal(ev.length, 2);
  const [a, b] = ev.map((e) => e.payload);
  assert.deepEqual(a.tokens, { input: 100, output: 10, cacheRead: 40, cacheCreation: 5, reasoning: 4 });
  assert.equal(b.tokens.cacheRead, 0, "a real zero stays zero");
  assert.equal(b.tokens.cacheCreation, null, "absent stays null");
  assert.equal(b.tokens.reasoning, 0);
  assert.equal(a.model, "gpt-5.4");
  assert.equal(a.cost.amount, 0.25);
  assert.deepEqual([a.provider, a.engine, a.semantics, a.sidechain], ["openai", "codex", "final", false]);
  assert.equal(ev[0].source.provider, "codex");
  assert.equal(ev[0].source.kind, "rollout");
  assert.equal(ev[0].relation, "inferred");
  assert.match(ev[0].idempotencyKey || "", /^usage\|codex\|/);
  const st = ing.getStats();
  assert.equal(st.callsPublished, 2);
  assert.equal(st.repeatedTotals, 1);
});

test("unknown model gives cost null; the call is still published", () => {
  const { home, dir } = setup();
  const id = fx.uuid();
  home.addThread(id, "C:\\work\\demo-proj");
  home.rollout(id, [fx.metaLine(id), fx.turnLine("codex-auto-review"), fx.tokenLine({ last: { input_tokens: 9, output_tokens: 1, total_tokens: 10 } })], { mtimeMs: OLD });
  ingestor(dir).tick();
  const [e] = mine(id);
  assert.equal(e.payload.cost, null);
  assert.equal(e.payload.model, "codex-auto-review");
  assert.equal(e.payload.tokens.input, 9);
});

test("incremental reads keep the model; restart with checkpoint reads nothing; checkpoint loss replays as a no-op", () => {
  const { home, dir } = setup();
  const id = fx.uuid();
  home.addThread(id, "C:\\work\\demo-proj");
  const first = home.rollout(id, standardLines(id), { mtimeMs: OLD });
  const a = ingestor(dir);
  a.tick();
  assert.equal(mine(id).length, 2);
  const bytes1 = a.getStats().bytesRead;
  assert.equal(bytes1, first.bytes);
  const more = home.rollout(id, [fx.tokenLine({ last: { input_tokens: 5, output_tokens: 1, total_tokens: 6 }, total: { input_tokens: 155, cached_input_tokens: 40, output_tokens: 18, total_tokens: 173 } })], { append: true, mtimeMs: NOW - 1000 });
  a.tick();
  assert.equal(a.getStats().bytesRead - bytes1, more.bytes, "only appended bytes are read");
  assert.equal(mine(id).length, 3);
  assert.equal(mine(id)[2].payload.model, "gpt-5.4", "the model of the earlier turn_context carries over");

  const b = ingestor(dir); // restart: loads the checkpoint, model and offset come back
  b.tick();
  assert.equal(b.getStats().bytesRead, 0);
  home.rollout(id, [fx.tokenLine({ last: { input_tokens: 2, output_tokens: 1, total_tokens: 3 }, total: { input_tokens: 157, cached_input_tokens: 40, output_tokens: 19, total_tokens: 176 } })], { append: true, mtimeMs: NOW - 1000 });
  b.tick();
  assert.equal(mine(id)[3].payload.model, "gpt-5.4", "model restored from the checkpoint");

  store.closeStore(SLUG);
  fs.rmSync(path.join(TMP_ROOT, "projects", SLUG, "coordination", "usage-ingest-codex-checkpoints.json"));
  const c = ingestor(dir);
  c.tick();
  assert.equal(mine(id).length, 4, "replay publishes nothing new");
  assert.equal(c.getStats().duplicates, 4);
  assert.equal(c.getStats().callsPublished, 0);
});

test("subagent threads are excluded by spawn edge and by the session_meta source", () => {
  const { home, dir } = setup();
  const parent = fx.uuid();
  const child = fx.uuid();
  const orphan = fx.uuid();
  home.addThread(parent, "C:\\work\\demo-proj");
  home.addThread(child, "C:\\work\\demo-proj", parent);
  home.addThread(orphan, "C:\\work\\demo-proj"); // no edge row: only the meta marks it as a subagent
  home.rollout(parent, standardLines(parent), { mtimeMs: OLD });
  home.rollout(child, standardLines(child), { mtimeMs: OLD });
  const sub = standardLines(orphan);
  sub[0] = fx.metaLine(orphan, { subagent: true });
  home.rollout(orphan, sub, { mtimeMs: OLD });
  const ing = ingestor(dir);
  ing.tick();
  ing.tick();
  assert.equal(mine(parent).length, 2);
  assert.equal(mine(child).length, 0);
  assert.equal(mine(orphan).length, 0);
  assert.equal(ing.getStats().filesSubagent, 2);
});

test("unmatched project and unknown thread are skipped and counted", () => {
  const { home, dir } = setup();
  const other = fx.uuid();
  const unknown = fx.uuid();
  home.addThread(other, "C:\\elsewhere\\nothing");
  home.rollout(other, standardLines(other), { mtimeMs: OLD });
  home.rollout(unknown, standardLines(unknown), { mtimeMs: OLD });
  const ing = ingestor(dir);
  ing.tick();
  assert.equal(ing.getStats().callsPublished, 0);
  assert.equal(ing.getStats().filesUnmatched, 2);
});

test("per-tick call bound is respected and the backlog drains", () => {
  const { home, dir } = setup();
  const id = fx.uuid();
  home.addThread(id, "C:\\work\\demo-proj");
  const lines = [fx.metaLine(id), fx.turnLine("gpt-5.4")];
  for (let i = 1; i <= 5; i += 1) lines.push(fx.tokenLine({ last: { input_tokens: i, output_tokens: 1, total_tokens: i + 1 }, total: { input_tokens: i * 10, output_tokens: i, total_tokens: i * 10 + i } }));
  home.rollout(id, lines, { mtimeMs: OLD });
  const ing = ingestor(dir, { limits: { maxCallsPerTick: 2 } });
  assert.equal(ing.tick().backlog, true);
  assert.equal(mine(id).length, 2);
  while (ing.tick().backlog);
  assert.equal(mine(id).length, 5);
});

test("sentinels never reach the store, stats, checkpoints or the summary; codex totals do not disturb claude totals", () => {
  const { home, dir } = setup();
  const id = fx.uuid();
  home.addThread(id, "C:\\work\\demo-proj");
  home.rollout(id, standardLines(id), { mtimeMs: OLD });
  const ing = ingestor(dir);
  ing.tick();
  const before = summarizeUsage(SLUG, { groupBy: "engine" });
  const codex = before.groups.find((g) => g.key === "codex");
  assert.ok(codex && codex.calls >= 2);
  assert.equal(before.totals.calls, before.groups.reduce((n, g) => n + g.calls, 0));
  const blobs = [JSON.stringify(ing.getStats()), JSON.stringify(before), JSON.stringify(summarizeUsage(SLUG, { groupBy: "session" })), JSON.stringify(usageEvents())];
  store.closeStore(SLUG);
  const cdir = path.join(TMP_ROOT, "projects", SLUG, "coordination");
  for (const f of fs.readdirSync(cdir)) blobs.push(fs.readFileSync(path.join(cdir, f)).toString("latin1"));
  for (const blob of blobs) for (const s of [fx.SENTINEL, fx.SENTINEL_REPLY, fx.SENTINEL_PATH]) assert.ok(!blob.includes(s), `${s} leaked`);
});

test("runtime exposes codex counters and an injected claude ingestor never starts the real codex ingest", () => {
  const codex = { tick: () => ({ backlog: false }), getStats: () => ({ callsPublished: 7 }) };
  const claude = { tick: () => ({ backlog: false }), getStats: () => ({ callsPublished: 1 }) };
  const h = runtime.startUsageIngest({ env: {}, ingestor: claude, codexIngestor: codex, intervalMs: 3600000 });
  assert.equal(runtime.getUsageStats().codex.callsPublished, 7);
  h?.stop();
  const h2 = runtime.startUsageIngest({ env: {}, ingestor: claude, intervalMs: 3600000 });
  assert.equal(runtime.getUsageStats().codex, undefined);
  h2?.stop();
  runtime.resetUsageRuntime();
});
