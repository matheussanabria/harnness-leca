// @ts-check
// T5.1: additive usage summary contract (byOrigin, origin groups, session extras, unpricedModels, pricing,
// window/until presets) plus a bounded-cost measurement over 20,000 usage.observed events.
const os = require("os");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("stream");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-usage-ext-"));
process.env.HARNESS_ROOT = TMP_ROOT;
const SLUG = "ext-proj";
fs.mkdirSync(path.join(TMP_ROOT, "projects", SLUG), { recursive: true });
fs.mkdirSync(path.join(TMP_ROOT, "projects", "big-proj"), { recursive: true });

const store = require("../ui/server/services/events/event-store");
const { centralEventRoutes } = require("../ui/server/routes/central-events.routes");
const { parseUsageRange } = require("../ui/server/services/usage-ingest/usage-range");

test.after(() => {
  store.closeStore(SLUG);
  store.closeStore("big-proj");
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
    route.handler({ req, res, params: /** @type {RegExpMatchArray} */ (url.split("?")[0].match(route.path)).slice(1) });
  });
}

let n = 0;
function call(slug, o) {
  n += 1;
  const cost = o.cost === undefined ? null : { amount: o.cost, currency: "USD", kind: "estimated", basis: "api-equivalent" };
  store.appendEvent(slug, {
    id: `e-${n}`, type: "usage.observed", at: o.at, sessionId: o.session || "claude:s1",
    payload: { callId: o.callId || `c-${n}`, model: o.model ?? null, engine: "claude", sidechain: !!o.sidechain, cost, tokens: o.tokens || { input: 1, output: 2 } },
  });
}
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const H = 3600e3;

test("summary extras: byOrigin sums to totals, null stays null, origin groups, session extras, lastAt", async () => {
  call(SLUG, { at: ago(1 * H), model: "claude-sonnet-5-5", cost: 1, tokens: { input: 10, output: 5 } });
  call(SLUG, { at: ago(2 * H), model: "claude-sonnet-5-5", cost: 0.5, sidechain: true, tokens: { input: 4, output: 1 } });
  call(SLUG, { at: ago(3 * H), model: "claude-mystery-9", sidechain: true, tokens: { input: 2, output: 2 } });
  call(SLUG, { at: ago(4 * H), model: "claude-mystery-9", session: "claude:s2", tokens: { input: 1, output: 1 } });
  call(SLUG, { at: ago(5 * H), model: "claude-other", session: "claude:s2", cost: 2, tokens: { input: 1 } });
  const r = await get(`/api/project/${SLUG}/usage/summary?groupBy=session`);
  assert.equal(r.status, 200);
  const { totals } = r.body;
  const { main, subagent } = totals.byOrigin;
  assert.equal(main.calls + subagent.calls, totals.calls);
  assert.equal(main.tokens.input + subagent.tokens.input, totals.tokens.input);
  assert.equal(main.cost.amount + subagent.cost.amount, totals.cost.amount);
  assert.equal(subagent.calls, 2);
  assert.equal(subagent.cost.amount, 0.5);
  assert.equal(main.tokens.reasoning, null, "sum over no values stays null");
  assert.equal(subagent.cost.currency, "USD");
  const s1 = r.body.groups.find((g) => g.key === "claude:s1");
  assert.equal(s1.engine, "claude");
  assert.deepEqual(s1.origin, { main: 1, subagent: 2 });
  assert.deepEqual(s1.model, ["claude-sonnet-5-5", "claude-mystery-9"]);
  assert.ok(s1.lastAt >= ago(1.5 * H) && s1.lastAt <= ago(0));
  const byOrigin = await get(`/api/project/${SLUG}/usage/summary?groupBy=origin`);
  assert.deepEqual(byOrigin.body.groups.map((g) => [g.key, g.calls]), [["main", 3], ["subagent", 2]]);
  assert.ok(byOrigin.body.groups.every((g) => typeof g.lastAt === "string"));
  assert.equal(r.body.groups.find((g) => g.key === "claude:s2").origin.subagent, 0);
});

test("summary extras: unpricedModels, pricing metadata, window and until", async () => {
  const r = await get(`/api/project/${SLUG}/usage/summary`);
  assert.deepEqual(r.body.coverage.unpricedModels, [{ model: "claude-mystery-9", calls: 2 }]);
  assert.equal(r.body.pricing.basis, "api-equivalent");
  assert.match(r.body.pricing.version, /^\d{4}-\d{2}-\d{2}/);
  assert.equal(typeof r.body.pricing.reviewStatus, "string");
  assert.match(r.body.pricing.retrievedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(r.body.window, null);

  const w = await get(`/api/project/${SLUG}/usage/summary?window=24h`);
  assert.equal(w.body.totals.calls, 5);
  assert.equal(w.body.window, "24h");
  assert.ok(Date.parse(w.body.since) < Date.now() - 23 * H);
  const all = await get(`/api/project/${SLUG}/usage/summary?window=all`);
  assert.equal(all.body.since, null);
  const until = await get(`/api/project/${SLUG}/usage/summary?until=${encodeURIComponent(ago(2.5 * H))}`);
  assert.equal(until.body.totals.calls, 3, "until is exclusive upper bound");
  assert.equal(until.body.until.length, 24);
});

test("summary extras: invalid or conflicting range gives 400", async () => {
  for (const q of ["window=3d", "window=7d&since=2026-10-01T00:00:00Z", "until=garbage"]) {
    assert.equal((await get(`/api/project/${SLUG}/usage/summary?${q}`)).status, 400, q);
  }
  assert.equal((await get(`/api/project/${SLUG}/usage/summary?groupBy=origin`)).status, 200);
});

test("parseUsageRange: presets are relative to now", () => {
  const now = Date.parse("2026-10-24T12:00:00Z");
  assert.equal(parseUsageRange({ window: "7d" }, now).since, "2026-10-17T12:00:00.000Z");
  assert.equal(parseUsageRange({ window: "14d" }, now).since, "2026-10-10T12:00:00.000Z");
  assert.deepEqual(parseUsageRange({}, now), { since: null, until: null, window: null });
});

test("summary on a missing price module metadata does not break (pricing fields exist)", async () => {
  const empty = await get("/api/project/big-proj/usage/summary");
  assert.equal(empty.body.totals.calls, 0);
  assert.deepEqual(empty.body.coverage.unpricedModels, []);
  assert.equal(empty.body.totals.byOrigin.main.cost.amount, null);
});

test("query cost: 20,000 usage.observed events stay bounded", async () => {
  const db = store.openStore("big-proj");
  const ins = db.prepare("INSERT INTO events (id, type, at, session_id, payload) VALUES (?, 'usage.observed', ?, ?, ?)");
  db.exec("BEGIN");
  for (let i = 0; i < 20000; i += 1) {
    const payload = JSON.stringify({ callId: `k${i}`, model: `m${i % 7}`, engine: "claude", sidechain: i % 4 === 0, cost: i % 9 ? { amount: 0.01 } : null, tokens: { input: 5, output: 7, cacheRead: 100 } });
    ins.run(`big-${i}`, ago((i % 20000) * 20e3), `claude:s${i % 40}`, payload);
  }
  db.exec("COMMIT");
  const t0 = process.hrtime.bigint();
  const full = await get("/api/project/big-proj/usage/summary?groupBy=session");
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const t1 = process.hrtime.bigint();
  const day = await get("/api/project/big-proj/usage/summary?window=24h");
  const msDay = Number(process.hrtime.bigint() - t1) / 1e6;
  console.log(`# usage summary 20k events: all+groupBy=session ${ms.toFixed(0)} ms, window=24h ${msDay.toFixed(0)} ms`);
  assert.equal(full.body.totals.calls, 20000);
  assert.ok(day.body.totals.calls > 0 && day.body.totals.calls < 20000);
  assert.ok(ms < 2000, `summary took ${ms} ms`);
});
