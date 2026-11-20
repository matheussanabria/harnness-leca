// EP-23.03: engine host in a separate process. A real host child (with a fake engine preloaded) and the web
// server in this process: a web restart mid-answer loses nothing, stop still stops, the host refuses calls
// without its token, a missing host gives 503 or is started on demand, and the host writes only chat_runs*.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "harness-engine-host-"));
for (const dir of ["projects/demo/chats", "global"]) fs.mkdirSync(path.join(TMP, dir), { recursive: true });
const SQL_LOG = path.join(TMP, "host-writes.log");
Object.assign(process.env, {
  HARNESS_ROOT: TMP,
  HARNESS_DB_PATH: path.join(TMP, "harness.sqlite"),
  HARNESS_ENGINE_HOST_TOKEN_FILE: path.join(TMP, "engine-host.token"),
  HARNESS_ENGINE_HOST_AUTOSTART: "0",
  HIA_ROUTING_ENABLED: "false",
});
const HOST_SCRIPT = path.join(__dirname, "..", "ui", "engine-host.js");
const FAKE = path.join(__dirname, "fixtures", "engine-host-fake.js");

const { createServer } = require("../ui/server");
const client = require("../ui/server/services/engine-host-client");
const { readToken, TOKEN_HEADER } = require("../ui/server/services/engine-host/protocol");

const children = [];
let hostBase;

function startHostChild(env = {}) {
  const child = spawn(process.execPath, ["-r", FAKE, HOST_SCRIPT], { env: { ...process.env, HARNESS_ENGINE_HOST_PORT: "0", HARNESS_TEST_SQL_LOG: SQL_LOG, ...env } });
  children.push(child);
  return new Promise((resolve, reject) => {
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += chunk;
      const m = /listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(out);
      if (m) resolve(m[1]);
    });
    child.on("exit", (code) => reject(new Error(`host exited ${code}: ${out}`)));
  });
}

async function startWeb() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
function stopWeb(web) {
  web.server.closeAllConnections();
  web.server.close();
}

/** Reads SSE events from a fetch response until `until(events)` is true or the stream ends. */
async function readEvents(res, until = () => false) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const events = [];
  let buffer = "";
  while (!until(events)) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) if (line.startsWith("data: ")) events.push(JSON.parse(line.slice(6)));
  }
  return { events, reader };
}

const postChat = (base, prompt, signal) => fetch(`${base}/api/chat`, {
  method: "POST", signal, headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ engine: "fakehost", prompt, slug: "demo" }),
});

test.before(async () => {
  hostBase = await startHostChild();
  process.env.HARNESS_ENGINE_HOST_URL = hostBase;
});
test.after(() => {
  for (const child of children) child.kill();
  require("../ui/server/db/connection").closeDb();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* Windows may still hold a handle */ }
});

test("restarting the web server mid-answer loses nothing: the reattach gets the rest and done", async () => {
  const web1 = await startWeb();
  const ac = new AbortController();
  const first = await readEvents(await postChat(web1.base, "chunks=20 delay=40", ac.signal), (ev) => ev.filter((e) => e.type === "text").length >= 3);
  const runId = first.events.find((e) => e.type === "run").runId;
  const nextSeq = first.events[first.events.length - 1].seq + 1;
  ac.abort();
  stopWeb(web1); // what node --watch does when a file under ui/server is saved

  const web2 = await startWeb();
  try {
    const res = await fetch(`${web2.base}/api/chat/attach?runId=${runId}&from=${nextSeq}`);
    assert.equal(res.status, 200);
    const rest = await readEvents(res);
    const all = [...first.events, ...rest.events];
    assert.equal(all.filter((e) => e.type === "text").length, 20, "every chunk arrives once");
    assert.equal(all[all.length - 1].type, "done");
    assert.deepEqual(all.map((e) => e.seq), all.map((_e, i) => i), "seq is continuous across the restart");
  } finally {
    stopWeb(web2);
  }
});

test("stop through the web server still stops the engine in the host", async () => {
  const web = await startWeb();
  try {
    const ac = new AbortController();
    const res = await postChat(web.base, "chunks=200 delay=30", ac.signal);
    const { events } = await readEvents(res, (ev) => ev.some((e) => e.type === "text"));
    const runId = events.find((e) => e.type === "run").runId;
    const stop = await fetch(`${web.base}/api/chat/stop`, { method: "POST", headers: { "Content-Type": "application/json", Origin: web.base }, body: JSON.stringify({ runId }) });
    assert.deepEqual(await stop.json(), { ok: true, stopped: true });
    ac.abort();
    const list = await (await fetch(`${hostBase}/runs`, { headers: { [TOKEN_HEADER]: readToken() } })).json();
    assert.ok(!list.runs.includes(runId), "the run is no longer active in the host");
  } finally {
    stopWeb(web);
  }
});

test("the host refuses calls without its token or relayed by a proxy", async () => {
  assert.equal((await fetch(`${hostBase}/health`)).status, 401);
  assert.equal((await fetch(`${hostBase}/health`, { headers: { [TOKEN_HEADER]: "wrong" } })).status, 401);
  assert.equal((await fetch(`${hostBase}/health`, { headers: { [TOKEN_HEADER]: readToken(), "X-Forwarded-For": "8.8.8.8" } })).status, 403);
  const ok = await (await fetch(`${hostBase}/health`, { headers: { [TOKEN_HEADER]: readToken() } })).json();
  assert.equal(ok.protocol, 1);
  assert.match(hostBase, /^http:\/\/127\.0\.0\.1:/, "binds loopback only");
});

/** @returns {Promise<number>} a port nobody listens on */
function freePort() {
  return new Promise((resolve) => {
    const probe = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

test("host down with autostart off: the chat answers 503 with a clear message", async () => {
  const web = await startWeb();
  process.env.HARNESS_ENGINE_HOST_URL = `http://127.0.0.1:${await freePort()}`;
  try {
    const res = await postChat(web.base, "chunks=1");
    assert.equal(res.status, 503);
    assert.match((await res.json()).error, /host de motores/);
    // Under node --test the autostart stays off unless a test asks for it: no stray detached host.
    delete process.env.HARNESS_ENGINE_HOST_AUTOSTART;
    assert.equal((await postChat(web.base, "chunks=1")).status, 503);
  } finally {
    process.env.HARNESS_ENGINE_HOST_AUTOSTART = "0";
    process.env.HARNESS_ENGINE_HOST_URL = hostBase;
    stopWeb(web);
  }
});

test("host down with autostart on: the web server starts it detached and waits for /health", async () => {
  const port = await freePort();
  const saved = { ...process.env };
  Object.assign(process.env, { HARNESS_ENGINE_HOST_PORT: String(port), HARNESS_ENGINE_HOST_URL: `http://127.0.0.1:${port}`, HARNESS_ENGINE_HOST_TOKEN_FILE: path.join(TMP, "auto.token") });
  process.env.HARNESS_ENGINE_HOST_AUTOSTART = "1";
  try {
    await client.ensureHost();
    const info = await client.health();
    assert.equal(info.ok, true);
    assert.equal(fs.existsSync(path.join(TMP, "auto.token")), true, "the host created its token");
    await (await client.hostRequest("POST", "/shutdown")).resume();
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});

test("the host writes only chat_runs* (and the migration bookkeeping) in harness.sqlite", () => {
  const writes = fs.readFileSync(SQL_LOG, "utf8").split("\n").filter(Boolean);
  assert.ok(writes.some((sql) => /chat_run_events/.test(sql)), "the run journal was written by the host");
  const foreign = writes.filter((sql) => !/\b(chat_runs|chat_run_events|schema_migrations)\b/.test(sql));
  assert.deepEqual(foreign, []);
});
