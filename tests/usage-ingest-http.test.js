// @ts-check
// T3.1: usage summary endpoint (router level) and runtime lifecycle.
const os = require("os");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("stream");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-usage-http-"));
process.env.HARNESS_ROOT = TMP_ROOT;
const SLUG = "demo-proj";
fs.mkdirSync(path.join(TMP_ROOT, "projects", SLUG), { recursive: true });

const store = require("../ui/server/services/events/event-store");
const { createUsageIngestor } = require("../ui/server/services/usage-ingest/usage-ingestor");
const runtime = require("../ui/server/services/usage-ingest/usage-runtime");
const { centralEventRoutes } = require("../ui/server/routes/central-events.routes");
const fx = require("./usage-ingest-fixtures");

const NOW = Date.parse("2026-10-24T12:00:00.000Z");

test.after(() => {
  runtime.resetUsageRuntime();
  store.closeStore(SLUG);
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

function get(url) {
  const route = centralEventRoutes.find((r) => r.method === "GET" && r.path.test(url.split("?")[0]));
  assert.ok(route, "route registered");
  const req = Readable.from([]);
  // @ts-ignore
  req.socket = { remoteAddress: "127.0.0.1" };
  // @ts-ignore
  req.headers = {};
  // @ts-ignore
  req.url = url;
  return new Promise((resolve) => {
    const res = { headersSent: false, writeHead(code) { this.status = code; }, write() { return true; }, end(body) { resolve({ status: this.status, body: JSON.parse(body) }); }, on() {} };
    const params = /** @type {RegExpMatchArray} */ (url.split("?")[0].match(route.path)).slice(1);
    route.handler({ req, res, params });
  });
}

test("summary: totals, groups, nulls where unknown and coverage", async () => {
  const root = path.join(TMP_ROOT, "claude");
  const estimator = (c) => (c.model === "claude-sonnet-5-5" ? { amount: 1.5, currency: "USD", kind: "estimated", basis: "api-equivalent", priceTableVersion: "t", missing: [] } : null);
  const l = (o) => fx.assistantLine(o);
  fx.writeLines(path.join(root, "C--work-demo-proj", "s-a.jsonl"), [
    l({ id: "a1", out: 10, input: 1, cacheRead: 2, cacheCreation: 3, ts: "2026-10-20T10:00:00.000Z" }),
    l({ id: "a2", out: 20, input: 4, cacheRead: 5, cacheCreation: 6, ts: "2026-10-21T10:00:00.000Z" }),
    l({ id: "a3", model: "claude-mystery-9", out: 7, input: 1, ts: "2026-10-21T11:00:00.000Z" }),
    l({ id: "a4", out: 0, noUsage: true }),
    "{broken \"usage\" \"assistant\"",
  ], { mtimeMs: NOW - 3600 * 1000 });
  fx.writeLines(path.join(root, "C--work-demo-proj", "s-a", "subagents", "agent-1.jsonl"), [l({ id: "a5", out: 3, sidechain: true, agentId: "ag", ts: "2026-10-21T12:00:00.000Z" })], { mtimeMs: NOW - 3600 * 1000 });
  const ing = createUsageIngestor({ root, now: () => NOW, host: "h", estimator, resolveProject: (h) => (h.includes("demo-proj") ? SLUG : null) });
  const handle = runtime.startUsageIngest({ env: {}, ingestor: ing, intervalMs: 3600000 });
  assert.ok(handle);
  await new Promise((r) => setTimeout(r, 200)); // first tick runs right after start
  handle.stop();

  const all = await get(`/api/project/${SLUG}/usage/summary`);
  assert.equal(all.status, 200);
  assert.equal(all.body.totals.calls, 4);
  assert.deepEqual(all.body.totals.tokens, { input: 6, output: 40, cacheRead: 7, cacheCreation: 9, reasoning: null });
  assert.equal(all.body.totals.cost.amount, 4.5);
  assert.equal(all.body.totals.cost.kind, "estimated");
  assert.equal(all.body.coverage.callsWithCost, 3);
  assert.equal(all.body.coverage.callsWithoutModelPrice, 1);
  assert.equal(all.body.coverage.sidechainCalls, 1);
  assert.equal(all.body.coverage.linesUnparsable, 1);
  assert.equal(all.body.groups, null);

  const byDay = await get(`/api/project/${SLUG}/usage/summary?groupBy=day&since=2026-10-21T00:00:00Z`);
  assert.deepEqual(byDay.body.groups.map((g) => [g.key, g.calls]), [["2026-10-21", 3]]);
  const byModel = await get(`/api/project/${SLUG}/usage/summary?groupBy=model`);
  const mystery = byModel.body.groups.find((g) => g.key === "claude-mystery-9");
  assert.equal(mystery.cost.amount, null, "unknown price stays null, not 0");
  assert.equal(mystery.coverage.callsWithoutModelPrice, 1);
  const bySession = await get(`/api/project/${SLUG}/usage/summary?groupBy=session`);
  assert.equal(bySession.body.groups[0].key, "claude:s-a");
  assert.equal(bySession.body.groups[0].calls, 4);

  const text = JSON.stringify([all.body, byDay.body, byModel.body, bySession.body]);
  for (const sentinel of [fx.SENTINEL, fx.SENTINEL_REPLY, fx.SENTINEL_PATH]) assert.ok(!text.includes(sentinel));
});

test("summary: empty project gives nulls, bad parameters give 400", async () => {
  fs.mkdirSync(path.join(TMP_ROOT, "projects", "empty-proj"), { recursive: true });
  const empty = await get("/api/project/empty-proj/usage/summary");
  store.closeStore("empty-proj");
  assert.equal(empty.body.totals.calls, 0);
  assert.equal(empty.body.totals.tokens.input, null);
  assert.equal(empty.body.totals.cost.amount, null);
  assert.equal((await get(`/api/project/${SLUG}/usage/summary?groupBy=nope`)).status, 400);
  assert.equal((await get(`/api/project/${SLUG}/usage/summary?since=garbage`)).status, 400);
  assert.equal((await get("/api/project/missing-proj/usage/summary")).status, 404);
});

test("runtime: HARNESS_USAGE=0 disables, errors are counted, backlog shortens the next delay", async () => {
  assert.equal(runtime.startUsageIngest({ env: { HARNESS_USAGE: "0" } }), null);
  let errors = 0;
  const failing = { tick() { throw new Error("x"); }, getStats: () => ({}), recordError() { errors += 1; } };
  const h1 = runtime.startUsageIngest({ env: {}, ingestor: failing, intervalMs: 3600000 });
  await new Promise((r) => setTimeout(r, 50));
  h1?.stop();
  assert.equal(errors, 1);

  let ticks = 0;
  const backlog = { tick() { ticks += 1; return { backlog: ticks < 4 }; }, getStats: () => ({}) };
  const h2 = runtime.startUsageIngest({ env: {}, ingestor: backlog, intervalMs: 3600000, backlogDelayMs: 5 });
  await new Promise((r) => setTimeout(r, 250));
  h2?.stop();
  assert.equal(ticks, 4, "chunked: ticks continue quickly while a backlog remains, then wait the full interval");
  assert.equal(runtime.getUsageStats().enabled, true);
});
