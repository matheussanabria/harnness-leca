// @ts-check
// Reproducao executavel de defeitos suspeitos do event log (A1-ep09-overlap, achados 3 e 5; plano 00, secao 3).
// Cada teste documenta o comportamento CORRETO esperado; T1.3 corrigiu os defeitos e removeu as marcas `todo`.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("stream");
const { setTimeout: sleep } = require("node:timers/promises");
const { removeDir } = require("./helpers/temp-dir");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-events-defects-"));
process.env.HARNESS_ROOT = TMP_ROOT;
process.env.SQLITE_TMPDIR = TMP_ROOT;

const mkProject = (slug) => fs.mkdirSync(path.join(TMP_ROOT, "projects", slug), { recursive: true });

const { handle } = require("../ui/server/router");
const { apiProjectEventStream } = require("../ui/server/controllers/central-events.controller");
const { appendEvent, openStore, storeStats, closeStore } = require("../ui/server/services/events/event-store");
const { projectSessions, projectWorkflows, projectAttention } = require("../ui/server/services/events/event-projector");

function fakeRes() {
  return {
    headersSent: false,
    writableEnded: false,
    status: 0,
    body: "",
    headers: {},
    chunks: [],
    writeHead(code, headers) {
      this.status = code;
      this.headersSent = true;
      this.headers = headers || {};
    },
    setHeader() {},
    write(chunk) {
      this.chunks.push(String(chunk));
      return true;
    },
    end(body) {
      if (body) this.body = String(body);
      this.writableEnded = true;
    },
    on() {},
  };
}

function fakeReq(url, headers = {}) {
  const req = Readable.from([]);
  // @ts-ignore
  req.socket = { remoteAddress: "127.0.0.1" };
  // @ts-ignore
  req.headers = headers;
  // @ts-ignore
  req.url = url;
  // @ts-ignore
  req.method = "GET";
  return req;
}

/** Abre o stream pelo controller, espera um ciclo de polling e devolve as mensagens SSE de eventos. */
async function collectSse(slug, { query = "", headers = {} } = {}) {
  const res = fakeRes();
  const stream = await apiProjectEventStream({
    req: fakeReq(`/api/project/${slug}/sessions/stream${query}`, headers),
    res,
    params: [slug],
  });
  await sleep(1300);
  stream.close();
  const text = res.chunks.join("");
  const messages = text
    .split("\n\n")
    .map((block) => block.trim())
    .filter((block) => block && !block.startsWith(":"))
    .map((block) => {
      const msg = { id: "", event: "", data: "" };
      for (const line of block.split("\n")) {
        if (line.startsWith("id: ")) msg.id = line.slice(4);
        else if (line.startsWith("event: ")) msg.event = line.slice(7);
        else if (line.startsWith("data: ")) msg.data = line.slice(6);
      }
      return msg;
    });
  return { text, messages };
}

function seed(slug, count, make) {
  const db = openStore(slug);
  db.exec("BEGIN");
  try {
    for (let i = 1; i <= count; i++) appendEvent(slug, make(i));
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

test.after(() => {
  for (const slug of ["p-route", "p-sse", "p-order", "p-window", "p-prune"]) closeStore(slug);
  removeDir(TMP_ROOT);
});

// ---------------------------------------------------------------- 1. route shadowing

test("defect 1 - GET /sessions/stream via the real router reaches the stream handler", async () => {
  mkProject("p-route");
  const res = fakeRes();
  const out = await handle(fakeReq("/api/project/p-route/sessions/stream"), res);
  try {
    assert.equal(res.status, 200, `expected 200 SSE, got ${res.status} body=${res.body}`);
    assert.match(String(res.headers["Content-Type"]), /text\/event-stream/);
  } finally {
    out?.close?.();
  }
});

// ---------------------------------------------------------------- 2. SSE reconnect

function seedSse() {
  mkProject("p-sse");
  seed("p-sse", 3, (i) => ({ id: `sse-${i}`, type: "session.updated", sessionId: "s1", payload: { n: i } }));
}

test("control - ?cursor=2 resumes after event 2 (cursor query param works)", async () => {
  seedSse();
  const { messages } = await collectSse("p-sse", { query: "?cursor=2" });
  assert.deepEqual(messages.map((m) => JSON.parse(m.data).id), ["sse-3"]);
});

test("defect 2a - Last-Event-ID header resumes after that event", async () => {
  seedSse();
  const { messages } = await collectSse("p-sse", { headers: { "last-event-id": "2" } });
  assert.deepEqual(messages.map((m) => JSON.parse(m.data).id), ["sse-3"]);
});

test("defect 2b - each event in a batch carries its own cursor as SSE id", async () => {
  seedSse();
  const { messages } = await collectSse("p-sse");
  assert.equal(messages.length, 3);
  const ids = messages.map((m) => m.id);
  assert.equal(new Set(ids).size, 3, `ids must be distinct, got ${JSON.stringify(ids)}`);
  const rows = openStore("p-sse").prepare("SELECT id, seq FROM events ORDER BY seq").all();
  const seqById = Object.fromEntries(rows.map((r) => [r.id, String(r.seq)]));
  for (const m of messages) assert.equal(m.id, seqById[JSON.parse(m.data).id]);
});

// ---------------------------------------------------------------- 3. out-of-order

function outOfOrderEvents() {
  const common = { sessionId: "s1", executionId: "e1" };
  appendEvent("p-order", { id: "o-1", type: "execution.succeeded", at: "2026-10-24T10:00:05.000Z", ...common });
  appendEvent("p-order", { id: "o-2", type: "execution.started", at: "2026-10-24T10:00:00.000Z", ...common });
}

test("defect 3a - late execution.started (earlier at) does not regress the session projection", () => {
  mkProject("p-order");
  outOfOrderEvents();
  const [session] = projectSessions("p-order").sessions;
  assert.equal(session.executionStatus, "succeeded");
  assert.equal(session.lastEventAt, "2026-10-24T10:00:05.000Z");
});

test("defect 3b - late execution.started does not regress the workflow projection", () => {
  mkProject("p-order");
  const [execution] = projectWorkflows("p-order").executions;
  assert.equal(execution.status, "succeeded");
});

// ---------------------------------------------------------------- 4. projection window

test("defect 4 - projections reflect events beyond the first 5000", () => {
  mkProject("p-window");
  const total = 5200;
  seed("p-window", total, (i) => {
    if (i === total) return { id: "w-last", type: "attention.opened", sessionId: "late", executionId: "late-exec", payload: { id: "att-late" } };
    if (i === total - 1) return { id: "w-exec", type: "execution.started", sessionId: "late", executionId: "late-exec" };
    return { id: `w-${i}`, type: "session.updated", sessionId: `early-${i % 10}`, payload: {} };
  });
  assert.equal(storeStats("p-window").total, total);
  const sessions = projectSessions("p-window").sessions;
  assert.ok(sessions.some((s) => s.sessionId === "late"), "session 'late' (event 5200) missing from sessions projection");
  const workflows = projectWorkflows("p-window").executions;
  assert.ok(workflows.some((w) => w.executionId === "late-exec"), "execution 'late-exec' missing from workflows projection");
  const attention = projectAttention("p-window").items;
  assert.ok(attention.some((a) => a.id === "att-late"), "attention 'att-late' missing from attention projection");
});

// ---------------------------------------------------------------- 5. pruning

test("defect 5 - a cursor older than the pruned range gets a reset signal", async () => {
  mkProject("p-prune");
  seed("p-prune", 20100, (i) => ({ id: `pr-${i}`, type: "session.updated", sessionId: "s1", payload: {} }));
  const stats = storeStats("p-prune");
  assert.equal(stats.total, 20000);
  assert.ok(Number(stats.firstCursor) > 5, `store was not pruned past cursor 5 (first=${stats.firstCursor})`);
  const { text } = await collectSse("p-prune", { query: "?cursor=5" });
  const hasReset = /event: (stream\.)?reset|event: cursor\.(reset|expired)/i.test(text);
  assert.ok(hasReset, `no reset signal for pruned cursor 5 (first surviving cursor ${stats.firstCursor}); stream resumed at first survivor`);
});
