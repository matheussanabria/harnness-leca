// @ts-check
// T1.3: retencao por classe (ADR-TEL-001), cursor podado, ordenacao das projecoes,
// roteamento e idempotencia de publishDiscovered.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("stream");
const { removeDir } = require("./helpers/temp-dir");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-events-retention-"));
process.env.HARNESS_ROOT = TMP_ROOT;
process.env.SQLITE_TMPDIR = TMP_ROOT;
const SLUGS = ["r-ops", "r-time", "r-size", "r-gap", "r-ord", "r-disc", "r-route"];
for (const slug of SLUGS) fs.mkdirSync(path.join(TMP_ROOT, "projects", slug), { recursive: true });

const { handle } = require("../ui/server/router");
const store = require("../ui/server/services/events/event-store");
const { RETENTION, pruneUsage } = require("../ui/server/services/events/event-retention");
const { resolveResumeCursor, formatReset } = require("../ui/server/services/events/event-stream");
const { projectSessions, projectAttention, projectWorkflows } = require("../ui/server/services/events/event-projector");
const { publishDiscovered } = require("../ui/server/services/canonical-sessions/session-registry-orchestrator.service");

const SAVED = { ...RETENTION };
test.after(() => {
  Object.assign(RETENTION, SAVED);
  for (const slug of SLUGS) store.closeStore(slug);
  removeDir(TMP_ROOT);
});

function fakeRes() {
  return {
    headersSent: false, writableEnded: false, status: 0, body: "", headers: {}, chunks: [],
    writeHead(code, headers) { this.status = code; this.headers = headers || {}; this.headersSent = true; },
    setHeader() {},
    write(chunk) { this.chunks.push(String(chunk)); return true; },
    end(body) { if (body) this.body = String(body); this.writableEnded = true; },
    on() {},
  };
}

function fakeReq(url, method = "GET") {
  const req = Readable.from([]);
  Object.assign(req, { socket: { remoteAddress: "127.0.0.1" }, headers: {}, url, method });
  return req;
}

test("retention - pruning by count never evicts usage.observed", () => {
  RETENTION.operationalMax = 50;
  const now = new Date().toISOString();
  for (let i = 0; i < 10; i++) store.appendEvent("r-ops", { id: `u-${i}`, type: "usage.observed", at: now, idempotencyKey: `u${i}` });
  for (let i = 0; i < 120; i++) store.appendEvent("r-ops", { id: `o-${i}`, type: "session.updated", sessionId: "s" });
  const stats = store.storeStats("r-ops");
  assert.equal(stats.byType["usage.observed"], 10);
  assert.equal(stats.byType["session.updated"], 50);
  Object.assign(RETENTION, SAVED);
});

test("retention - usage older than the age window is pruned, recent is kept", () => {
  const old = new Date(Date.now() - (RETENTION.usageMaxAgeDays + 5) * 86400000).toISOString();
  store.appendEvent("r-time", { id: "t-new", type: "usage.observed", idempotencyKey: "tn" });
  const db = store.openStore("r-time");
  db.prepare("INSERT INTO events (id, type, at) VALUES (?, 'usage.observed', ?)").run("t-old", old);
  assert.equal(pruneUsage(db), 1);
  const ids = db.prepare("SELECT id FROM events").all().map((r) => r.id);
  assert.deepEqual(ids, ["t-new"]);
});

test("retention - usage size cap removes the oldest usage rows", () => {
  RETENTION.usageMaxEvents = 5;
  const db = store.openStore("r-size");
  for (let i = 0; i < 9; i++) store.appendEvent("r-size", { id: `s-${i}`, type: "usage.observed", idempotencyKey: `k${i}` });
  pruneUsage(db);
  const ids = db.prepare("SELECT id FROM events ORDER BY seq").all().map((r) => r.id);
  assert.deepEqual(ids, ["s-4", "s-5", "s-6", "s-7", "s-8"]);
  Object.assign(RETENTION, SAVED);
});

test("stream - gapAfter flags a pruned cursor and not a contiguous one", () => {
  RETENTION.operationalMax = 5;
  for (let i = 0; i < 12; i++) store.appendEvent("r-gap", { id: `g-${i}`, type: "session.updated", sessionId: "s" });
  Object.assign(RETENTION, SAVED);
  const first = Number(store.storeStats("r-gap").firstCursor);
  assert.equal(first, 8);
  assert.deepEqual(store.gapAfter("r-gap", 2), { gap: true, firstCursor: "8" });
  assert.equal(store.gapAfter("r-gap", first - 1).gap, false);
  assert.equal(store.gapAfter("r-gap", 12).gap, false);
  assert.match(formatReset("2", "8"), /^id: 7\nevent: stream\.reset\ndata: .*"firstCursor":"8"/);
});

test("stream - Last-Event-ID wins over ?cursor= and invalid values are ignored", () => {
  assert.equal(resolveResumeCursor("7", "2"), "7");
  assert.equal(resolveResumeCursor("", "2"), "2");
  assert.equal(resolveResumeCursor("abc", "x"), "0");
  assert.equal(resolveResumeCursor("-1", undefined), "0");
});

test("projection - ordering by at is independent of arrival order, terminal wins", () => {
  const e = { sessionId: "s1", executionId: "e1" };
  store.appendEvent("r-ord", { id: "a1", type: "execution.failed", at: "2026-10-24T10:00:09.000Z", ...e });
  store.appendEvent("r-ord", { id: "a2", type: "execution.started", at: "2026-10-24T10:00:01.000Z", ...e });
  store.appendEvent("r-ord", { id: "a3", type: "workflow.blocked", at: "2026-10-24T10:00:05.000Z", ...e });
  store.appendEvent("r-ord", { id: "a4", type: "workflow.unblocked", at: "2026-10-24T10:00:02.000Z", ...e });
  store.appendEvent("r-ord", { id: "a5", type: "attention.resolved", at: "2026-10-24T10:00:08.000Z", sessionId: "s1", payload: { id: "x" } });
  store.appendEvent("r-ord", { id: "a6", type: "attention.opened", at: "2026-10-24T10:00:03.000Z", sessionId: "s1", payload: { id: "x" } });
  const [s] = projectSessions("r-ord").sessions;
  assert.equal(s.executionStatus, "failed");
  assert.equal(s.workflowStatus, "blocked");
  assert.equal(s.attentionStatus, "resolved");
  assert.equal(s.lastEventAt, "2026-10-24T10:00:09.000Z");
  assert.equal(projectWorkflows("r-ord").executions[0].status, "failed");
  assert.equal(projectAttention("r-ord").items.length, 0);
});

test("projection - a newer execution of the same session replaces a finished one", () => {
  store.appendEvent("r-ord", { id: "b1", type: "execution.succeeded", at: "2026-10-24T11:00:00.000Z", sessionId: "s2", executionId: "e1" });
  store.appendEvent("r-ord", { id: "b2", type: "execution.started", at: "2026-10-24T11:05:00.000Z", sessionId: "s2", executionId: "e2" });
  const s2 = projectSessions("r-ord").sessions.find((s) => s.sessionId === "s2");
  assert.equal(s2?.executionStatus, "running");
});

test("publishDiscovered - republishing publishes only genuinely new sessions", () => {
  const s = (id) => ({ id, primaryProvider: "claude", title: id });
  publishDiscovered("r-disc", [s("d1")], 1);
  publishDiscovered("r-disc", [s("d1"), s("d2")], 1);
  publishDiscovered("r-disc", [s("d1"), s("d2")], 1);
  const events = store.readEvents("r-disc", {}).events.filter((ev) => ev.type === "session.discovered");
  assert.deepEqual(events.map((ev) => ev.sessionId).sort(), ["d1", "d2"]);
});

test("router - stream is reachable and previously reachable routes still resolve", async () => {
  const stream = await handle(fakeReq("/api/project/r-route/sessions/stream"), fakeRes());
  stream?.close?.();
  const checks = [
    ["/api/project/r-route/events", "GET", 200],
    ["/api/project/r-route/projections", "GET", 200],
    ["/api/project/r-route/sessions", "GET", 200],
    ["/api/project/r-route/sessions/some-id", "GET", null],
  ];
  for (const [url, method, expected] of checks) {
    const res = fakeRes();
    const out = await handle(fakeReq(url, method), res);
    out?.close?.();
    if (expected) assert.equal(res.status, expected, url);
    else assert.notEqual(res.status, 0, `${url} handled`);
  }
  const res = fakeRes();
  const out = await handle(fakeReq("/api/project/r-route/sessions/stream"), res);
  out?.close?.();
  assert.equal(res.status, 200);
  assert.match(String(res.headers["Content-Type"]), /text\/event-stream/);
});
