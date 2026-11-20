// @ts-check
// EP-17.02 regression: a hard refresh with cleared storage (or another browser) resumes the same engine session,
// because the server, not the browser, holds it. Incident of 2026-11-01: Ctrl+F5 opened a second OpenCode session.
import test from "node:test";
import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = /** @type {any} */ ({
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
});

/** Fake server: sessions by project + file, like /api/chat/conversations. */
const server = new Map();
const calls = [];
const realFetch = globalThis.fetch;
const ok = (body) => ({ ok: true, status: 200, json: async () => body });
globalThis.fetch = /** @type {any} */ (async (url, init = {}) => {
  const u = new URL(String(url), "http://x");
  const body = init.body ? JSON.parse(String(init.body)) : null;
  calls.push(`${init.method || "GET"} ${u.pathname}`);
  if (u.pathname === "/api/chat/conversations/sessions") {
    const key = `${body.project}/${body.file}`;
    server.set(key, { ...(server.get(key) || {}), [body.engine]: body.sessionId });
    return ok({ sessions: server.get(key) });
  }
  if (u.pathname === "/api/chat/conversations/import-sessions") {
    let imported = 0;
    for (const [file, sessions] of Object.entries(body.byFile)) {
      const key = `${body.project}/${file}`;
      const known = server.get(key) || {};
      for (const [engine, id] of Object.entries(sessions)) if (id && !known[engine]) { known[engine] = id; imported += 1; }
      server.set(key, known);
    }
    return ok({ imported });
  }
  if (u.pathname === "/api/chat/conversations" && u.searchParams.get("file")) {
    const sessions = server.get(`${u.searchParams.get("project")}/${u.searchParams.get("file")}`);
    return sessions ? ok({ id: "c1", sessions }) : { ok: false, status: 404, json: async () => ({}) };
  }
  return { ok: false, status: 404, json: async () => ({}) };
});
test.after(() => { globalThis.fetch = realFetch; });

let n = 0;
const reload = () => import(`../ui/public/js/modules/chat-session-store.js?server=${++n}`);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test.beforeEach(() => {
  store.clear();
  server.clear();
  calls.length = 0;
});

test("hard refresh with cleared storage resumes the same engine session from the server", async () => {
  const a = await reload();
  a.setEngineSession("inv", "2026-11-01-prd.md", "opencode", "ses_e6811a9c");
  await flush();
  assert.deepEqual(server.get("inv/2026-11-01-prd.md"), { opencode: "ses_e6811a9c" }, "the session reached the server");

  store.clear(); // Ctrl+F5 with cleared site data, or another browser profile
  const b = await reload();
  assert.equal(b.getEngineSession("inv", "2026-11-01-prd.md", "opencode"), null, "the browser alone has nothing");
  await b.reconcileEngineSessions("inv", "2026-11-01-prd.md");
  assert.equal(b.getEngineSession("inv", "2026-11-01-prd.md", "opencode"), "ses_e6811a9c", "same session, no new one");
});

test("the server wins for engines it knows; engines only the browser knows are sent up", async () => {
  server.set("inv/c.md", { opencode: "ses_server" });
  const a = await reload();
  a.setEngineSession("inv", "c.md", "opencode", "ses_stale");
  a.setEngineSession("inv", "c.md", "gemini", "gem_local");
  server.set("inv/c.md", { opencode: "ses_server" }); // a newer session recorded by another browser
  delete server.get("inv/c.md").gemini;
  await a.reconcileEngineSessions("inv", "c.md");
  await flush();
  assert.equal(a.getEngineSession("inv", "c.md", "opencode"), "ses_server");
  assert.equal(server.get("inv/c.md").gemini, "gem_local");
});

test("drafts never reach the server; saving a draft sends every engine session it holds", async () => {
  const a = await reload();
  a.setEngineSession("inv", null, "claude", "cl_1");
  a.setEngineSession("inv", null, "codex", "cx_1");
  await flush();
  assert.equal(calls.length, 0, "a draft has no file yet");
  a.moveEngineSessions("inv", null, "2026-11-20-novo.md");
  await flush();
  assert.deepEqual(server.get("inv/2026-11-20-novo.md"), { claude: "cl_1", codex: "cx_1" });
});

test("the localStorage map is imported once per project", async () => {
  store.set("harness:engine-sessions:v1", JSON.stringify({ "inv::a.md": { opencode: "ses_a" }, "inv::draft": { claude: "x" }, "outro::b.md": { claude: "y" } }));
  const a = await reload();
  await a.migrateLocalSessionsOnce("inv");
  assert.deepEqual([...server.keys()], ["inv/a.md"], "only saved chats of this project");
  calls.length = 0;
  await a.migrateLocalSessionsOnce("inv");
  assert.equal(calls.length, 0, "the second load does not import again");
});

test("server unreachable: the cache keeps working and the import is retried later", async () => {
  globalThis.fetch = /** @type {any} */ (async () => { throw new Error("offline"); });
  try {
    store.set("harness:engine-sessions:v1", JSON.stringify({ "inv::a.md": { opencode: "ses_a" } }));
    const a = await reload();
    await a.reconcileEngineSessions("inv", "a.md");
    assert.equal(a.getEngineSession("inv", "a.md", "opencode"), "ses_a");
    await a.migrateLocalSessionsOnce("inv");
    assert.equal(store.has("harness:engine-sessions:imported:inv"), false);
  } finally {
    globalThis.fetch = /** @type {any} */ (realFetch);
  }
});
