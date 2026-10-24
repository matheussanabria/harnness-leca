// @ts-check
// T3.1: Claude transcript usage ingest (reader, dedup, checkpoints, privacy, bounds).
const os = require("os");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-usage-"));
process.env.HARNESS_ROOT = TMP_ROOT;
const SLUG = "demo-proj";
fs.mkdirSync(path.join(TMP_ROOT, "projects", SLUG), { recursive: true });

const store = require("../ui/server/services/events/event-store");
const { createUsageIngestor } = require("../ui/server/services/usage-ingest/usage-ingestor");
const { costOf } = require("../ui/server/services/usage-ingest/usage-cost");
const fx = require("./usage-ingest-fixtures");

const NOW = Date.parse("2026-10-24T12:00:00.000Z");
const clock = { t: NOW };
let seq = 0;

/** A fresh transcript root per test; hint "C--work-demo-proj" maps to the project, others to none. */
function setup() {
  clock.t = NOW;
  const root = path.join(TMP_ROOT, `claude-${++seq}`);
  const hint = "C--work-demo-proj";
  const main = path.join(root, hint, `sess-${seq}.jsonl`);
  return { root, hint, main, sub: path.join(root, hint, `sess-${seq}`, "subagents", "agent-a1.jsonl") };
}

function ingestor(root, extra = {}) {
  const estimator = (/** @type {any} */ c) => (c.model === "claude-sonnet-5-5" ? { amount: 0.5, currency: "USD", kind: "estimated", basis: "api-equivalent", priceTableVersion: "t", missing: [] } : null);
  return createUsageIngestor({
    root, now: () => clock.t, host: "h", estimator,
    resolveProject: (h) => (h.includes("demo-proj") ? SLUG : null), ...extra,
  });
}

const usageEvents = () => store.readEvents(SLUG, { types: ["usage.observed"], limit: 1000 }).events;
const OLD = NOW - 3600 * 1000; // mtime well past quietMs: open calls flush at EOF

test.after(() => {
  store.closeStore(SLUG);
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

test("streaming duplicates collapse to the final usage and a second scan reads only appended bytes", () => {
  const s = setup();
  const l = (/** @type {any} */ o) => fx.assistantLine({ model: "claude-sonnet-5-5", input: 3, cacheRead: 100, cacheCreation: 7, ...o });
  clock.t = NOW;
  const before = usageEvents().length;
  fx.writeLines(s.main, [fx.userLine(), l({ id: "m1", out: 10 }), l({ id: "m1", out: 25 }), l({ id: "m1", out: 40, stop: "end_turn" }), l({ id: "m2", out: 5 })], { mtimeMs: NOW });
  const ing = ingestor(s.root);
  ing.tick();
  let got = usageEvents().slice(before);
  assert.equal(got.length, 1, "m2 stays open (file is not quiet yet)");
  assert.equal(got[0].payload.callId, "m1");
  assert.deepEqual(got[0].payload.tokens, { input: 3, output: 40, cacheRead: 100, cacheCreation: 7, reasoning: null });
  assert.equal(got[0].idempotencyKey, "usage|claude|m1");
  assert.equal(got[0].sessionId, `claude:sess-${seq}`);
  assert.equal(got[0].nativeSessionId, `sess-${seq}`);
  assert.equal(got[0].relation, "inferred");
  assert.equal(got[0].trust, "inferred");
  assert.equal(got[0].engineInstanceId, "claude@h");
  assert.equal(got[0].at, "2026-10-20T10:00:00.000Z");
  assert.deepEqual([got[0].source.provider, got[0].source.kind], ["claude", "transcript"]);
  assert.equal(got[0].payload.provider, "anthropic");
  assert.equal(got[0].payload.semantics, "final");
  assert.equal(got[0].payload.quality, "transcript");
  assert.equal(got[0].payload.engine, "claude");
  assert.equal(got[0].payload.cost.amount, 0.5);
  assert.equal(ing.getStats().linesMerged, 2);

  const extra = fx.writeLines(s.main, [l({ id: "m3", out: 9 })], { append: true, mtimeMs: NOW + 1000 });
  clock.t = NOW + 300000; // the file is now quiet
  ing.tick();
  assert.equal(ing.getStats().lastTickBytes, extra, "only the appended bytes are read");
  got = usageEvents().slice(before);
  assert.deepEqual(got.map((e) => e.payload.callId), ["m1", "m2", "m3"], "quiet file flushes the open call");
});

test("replay after restart is a no-op, including the held open call", () => {
  const s = setup();
  fx.writeLines(s.main, [fx.assistantLine({ id: "r1", out: 4 }), fx.assistantLine({ id: "r2", out: 6 })], { mtimeMs: NOW });
  const first = ingestor(s.root);
  first.tick();
  const count = usageEvents().length;
  const second = ingestor(s.root); // new process: state only from the checkpoint file
  second.tick();
  assert.equal(usageEvents().length, count);
  assert.equal(second.getStats().callsPublished, 0);
  assert.ok(second.getStats().bytesRead > 0 && second.getStats().bytesRead < fs.statSync(s.main).size, "replays only from the held call start");
  const cpFile = path.join(TMP_ROOT, "projects", SLUG, "coordination", "usage-ingest-checkpoints.json");
  const cp = JSON.parse(fs.readFileSync(cpFile, "utf8"));
  assert.ok(Object.keys(cp.files).every((k) => /^[0-9a-f]{20}$/.test(k)), "keys are path hashes");
  assert.ok(!fs.readFileSync(cpFile, "utf8").includes("sess-"), "no path stored");
});

test("truncation or replacement restarts from zero", () => {
  const s = setup();
  fx.writeLines(s.main, [fx.assistantLine({ id: "t1", out: 4 }), fx.assistantLine({ id: "t2", out: 4 }), fx.assistantLine({ id: "t3", out: 4 })], { mtimeMs: OLD });
  const ing = ingestor(s.root);
  ing.tick();
  fx.writeLines(s.main, [fx.assistantLine({ id: "t9", out: 8 })], { mtimeMs: OLD + 1000 });
  ing.tick();
  assert.equal(ing.getStats().resets, 1);
  assert.ok(usageEvents().some((e) => e.payload.callId === "t9"));
});

test("a partial last line is held until it completes", () => {
  const s = setup();
  const full = fx.assistantLine({ id: "p1", out: 3 });
  const second = fx.assistantLine({ id: "p2", out: 4 });
  fx.writeLines(s.main, [], { raw: `${full}\n${second.slice(0, 80)}`, mtimeMs: OLD });
  const ing = ingestor(s.root);
  ing.tick();
  assert.equal(ing.getStats().linesUnparsable, 0);
  assert.deepEqual(usageEvents().filter((e) => e.sessionId === `claude:sess-${seq}`).map((e) => e.payload.callId), ["p1"]);
  fx.writeLines(s.main, [], { raw: `${second.slice(80)}\n`, append: true, mtimeMs: OLD + 1000 });
  ing.tick();
  assert.equal(ing.getStats().linesUnparsable, 0);
  assert.ok(usageEvents().some((e) => e.payload.callId === "p2" && e.payload.tokens.output === 4));
});

test("absent usage fields stay null and a real zero stays zero; synthetic and unparsable lines are skipped", () => {
  const s = setup();
  const noInput = JSON.parse(fx.assistantLine({ id: "n1", out: 0 }));
  delete noInput.message.usage.input_tokens; // absent
  const broken = '{"type":"assistant","usage": broken';
  fx.writeLines(s.main, [JSON.stringify(noInput), fx.assistantLine({ id: "n2", noUsage: true }), fx.assistantLine({ id: "n3", model: "<synthetic>", out: 0 }), broken], { mtimeMs: OLD });
  const ing = ingestor(s.root);
  ing.tick();
  const e = usageEvents().find((x) => x.payload.callId === "n1");
  assert.deepEqual(e?.payload.tokens, { input: null, output: 0, cacheRead: null, cacheCreation: null, reasoning: null });
  assert.ok(!usageEvents().some((x) => ["n2", "n3"].includes(x.payload.callId)));
  assert.equal(ing.getStats().linesUnparsable, 1);
});

test("sidechain calls from subagent files are flagged and attributed to the parent session", () => {
  const s = setup();
  fx.writeLines(s.main, [fx.assistantLine({ id: "s-main", out: 2 })], { mtimeMs: OLD });
  fx.writeLines(s.sub, [fx.assistantLine({ id: "s-side", out: 7, sidechain: true, agentId: "a1" })], { mtimeMs: OLD });
  ingestor(s.root).tick();
  const side = usageEvents().find((e) => e.payload.callId === "s-side");
  const main = usageEvents().find((e) => e.payload.callId === "s-main");
  assert.equal(side?.payload.sidechain, true);
  assert.equal(main?.payload.sidechain, false);
  assert.equal(side?.sessionId, `claude:sess-${seq}`);
  assert.equal(side?.agentId, "a1");
});

test("unmatched project is skipped and counted; unknown model gives cost null", () => {
  const s = setup();
  const stranger = path.join(s.root, "C--elsewhere-stranger", "x.jsonl");
  fx.writeLines(stranger, [fx.assistantLine({ id: "u-x", out: 1 })], { mtimeMs: OLD });
  fx.writeLines(s.main, [fx.assistantLine({ id: "u-unk", model: "claude-mystery-9", out: 1 })], { mtimeMs: OLD });
  const ing = ingestor(s.root);
  ing.tick();
  assert.equal(ing.getStats().filesUnmatched, 1);
  assert.ok(!usageEvents().some((e) => e.payload.callId === "u-x"));
  assert.equal(usageEvents().find((e) => e.payload.callId === "u-unk")?.payload.cost, null);
  assert.equal(costOf({ provider: "anthropic", model: "m", tokens: {}, at: "" }, null), null, "no estimator -> null");
  assert.equal(costOf({ provider: "anthropic", model: "m", tokens: {}, at: "" }, () => { throw new Error("x"); }), null);
});

test("per-tick bounds are respected and the backlog drains over ticks", () => {
  const s = setup();
  fx.writeLines(s.main, Array.from({ length: 9 }, (_v, i) => fx.assistantLine({ id: `b${i}`, out: i + 1 })), { mtimeMs: OLD });
  const ing = ingestor(s.root, { limits: { maxCallsPerTick: 2 } });
  const r1 = ing.tick();
  assert.equal(r1.backlog, true);
  assert.equal(ing.getStats().callsPublished, 2);
  let guard = 0;
  while (ing.tick().backlog && guard++ < 20);
  ing.tick();
  assert.equal(ing.getStats().callsPublished, 9);

  const s2 = setup();
  const lines = Array.from({ length: 30 }, (_v, i) => fx.assistantLine({ id: `c${i}`, out: 1 }));
  fx.writeLines(s2.main, lines, { mtimeMs: OLD });
  const small = ingestor(s2.root, { limits: { maxBytesPerTick: 4000, readWindowBytes: 4000 } });
  small.tick();
  assert.ok(small.getStats().lastTickBytes <= 4000 + 1500, `bytes bound: ${small.getStats().lastTickBytes}`);
  assert.equal(small.getStats().backlog, true);
});

test("sentinel prompt, reply and path text never reach the store, stats or checkpoints", () => {
  const s = setup();
  fx.writeLines(s.main, [fx.userLine(), fx.assistantLine({ id: "z1", out: 1 }), fx.assistantLine({ id: "z2", out: 2 })], { mtimeMs: OLD });
  const ing = ingestor(s.root);
  ing.tick();
  const { summarizeUsage } = require("../ui/server/services/usage-ingest/usage-summary");
  const blobs = [JSON.stringify(ing.getStats()), JSON.stringify(summarizeUsage(SLUG, { groupBy: "session" })), JSON.stringify(usageEvents())];
  store.closeStore(SLUG);
  const dir = path.join(TMP_ROOT, "projects", SLUG, "coordination");
  for (const f of fs.readdirSync(dir)) blobs.push(fs.readFileSync(path.join(dir, f)).toString("latin1"));
  for (const blob of blobs) for (const sentinel of [fx.SENTINEL, fx.SENTINEL_REPLY, fx.SENTINEL_PATH]) assert.ok(!blob.includes(sentinel), `${sentinel} leaked`);
  assert.ok(fs.readdirSync(dir).some((f) => f.endsWith(".sqlite")), "the sqlite file was inspected");
});
