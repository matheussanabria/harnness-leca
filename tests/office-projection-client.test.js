// @ts-check
import test from "node:test";
import assert from "node:assert/strict";

import { officeAgentState } from "../ui/public/js/office/office-agent-state.js";
import { BACKOFF_MS, createProjectionClient } from "../ui/public/js/office/office-projection-client.js";
import { bindProjectionTelemetry } from "../ui/public/js/office/office-projection-bridge.js";
import { bindChatExecutionTelemetry, recomputeLocalEngines, syncAgentsFromActivity } from "../ui/public/js/office/office-agent-telemetry.js";
import { isServerTruth } from "../ui/public/js/office/office-telemetry-source.js";
import { resetChatExecution, setChatStreaming } from "../ui/public/js/modules/chat-execution-store.js";

class FakeEventSource {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.closed = false;
    this.handlers = new Map();
    FakeEventSource.instances.push(this);
  }
  addEventListener(type, fn) { this.handlers.set(type, fn); }
  close() { this.closed = true; }
  open() { this.onopen?.(); }
  fail() { this.onerror?.(); }
  emit(type, event, id) { this.handlers.get(type)?.({ data: JSON.stringify(event), lastEventId: String(id ?? "") }); }
  static last() { return FakeEventSource.instances[FakeEventSource.instances.length - 1]; }
}

const view = (sessionId, provider, status, extra = {}) => ({
  sessionId, provider, executionStatus: status, lastEventAt: new Date().toISOString(), attentionStatus: null, ...extra
});

function harness(projections) {
  FakeEventSource.instances = [];
  const timers = [];
  const fetched = [];
  const queue = [...projections];
  const fetchImpl = async (url) => {
    fetched.push(url);
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next instanceof Error) throw next;
    return { ok: true, json: async () => next };
  };
  const client = createProjectionClient({
    slug: "demo",
    onChange: () => {},
    fetchImpl,
    EventSourceImpl: FakeEventSource,
    setTimeoutImpl: (fn, ms) => { const t = { fn, ms, off: false }; timers.push(t); return t; },
    clearTimeoutImpl: (t) => { if (t) t.off = true; }
  });
  const fire = async () => { const t = timers.filter((x) => !x.off).pop(); t.off = true; t.fn(); await tick(); };
  return { client, timers, fetched, fire };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("client: loads projections, opens stream from the projection cursor and is connected on open", async () => {
  const h = harness([{ sessions: [view("a", "claude", "running")], cursor: "7" }]);
  await h.client.start();
  assert.match(h.fetched[0], /\/api\/project\/demo\/projections$/);
  assert.match(FakeEventSource.last().url, /\/api\/project\/demo\/sessions\/stream\?cursor=7$/);
  assert.equal(h.client.isConnected(), false);
  FakeEventSource.last().open();
  assert.equal(h.client.isConnected(), true);
  assert.equal(h.client.getSessions().get("a").status, "running");
});

test("client: applies stream events, drops duplicates and ids already in the projection", async () => {
  const h = harness([{ sessions: [], cursor: "5" }]);
  await h.client.start();
  const es = FakeEventSource.last();
  es.open();
  const run = { type: "execution.started", sessionId: "s", executionId: "s", at: new Date().toISOString(), payload: {} };
  es.emit("execution.started", { ...run, sessionId: "old" }, 5);
  assert.equal(h.client.getSessions().has("old"), false);
  es.emit("execution.started", run, 6);
  es.emit("execution.succeeded", { ...run, type: "execution.succeeded" }, 7);
  es.emit("execution.started", run, 6);
  assert.equal(h.client.getSessions().get("s").status, "succeeded");
});

test("client: stream error disconnects, retries with backoff and resyncs from the projection (stale running cleared)", async () => {
  const h = harness([
    { sessions: [view("a", "claude", "running")], cursor: "3" },
    { sessions: [view("a", "claude", "cancelled")], cursor: "9" }
  ]);
  await h.client.start();
  FakeEventSource.last().open();
  const first = FakeEventSource.last();
  first.fail();
  assert.equal(first.closed, true);
  assert.equal(h.client.isConnected(), false);
  assert.equal(h.timers.at(-1).ms, BACKOFF_MS.initial);
  await h.fire();
  assert.equal(h.fetched.length, 2);
  assert.match(FakeEventSource.last().url, /cursor=9$/);
  FakeEventSource.last().open();
  assert.equal(h.client.isConnected(), true);
  assert.equal(h.client.getSessions().get("a").status, "cancelled");
});

test("client: backoff doubles while the server is down and resets after a successful open", async () => {
  const h = harness([new Error("down"), new Error("down"), { sessions: [], cursor: "1" }]);
  await h.client.start();
  assert.equal(h.timers.at(-1).ms, BACKOFF_MS.initial);
  await h.fire();
  assert.equal(h.timers.at(-1).ms, BACKOFF_MS.initial * 2);
  await h.fire();
  FakeEventSource.last().open();
  FakeEventSource.last().fail();
  assert.equal(h.timers.at(-1).ms, BACKOFF_MS.initial);
});

test("client: stream.reset refetches projections and reopens the stream", async () => {
  const h = harness([{ sessions: [], cursor: "2" }, { sessions: [view("z", "gemini", "running")], cursor: "50" }]);
  await h.client.start();
  const first = FakeEventSource.last();
  first.open();
  first.emit("stream.reset", { reason: "cursor_pruned" });
  await tick();
  assert.equal(first.closed, true);
  assert.equal(h.fetched.length, 2);
  assert.match(FakeEventSource.last().url, /cursor=50$/);
  assert.equal(h.client.getSessions().get("z").status, "running");
});

test("client: stop() ignores late events and does not retry", async () => {
  const h = harness([{ sessions: [], cursor: "1" }]);
  await h.client.start();
  const es = FakeEventSource.last();
  h.client.stop();
  es.fail();
  assert.equal(h.timers.filter((t) => !t.off).length, 0);
  assert.equal(h.client.isConnected(), false);
});

test("bridge: server truth wins when connected; same chat in local store is not double counted; fallback when it drops", async () => {
  officeAgentState.reset();
  const unbindLocal = bindChatExecutionTelemetry();
  const listeners = [];
  const state = { activeProject: "demo", subscribe: (fn) => listeners.push(fn), listeners };
  const h = harness([{ sessions: [view("r1", "claude", "running")], cursor: "1" }]);
  let created = null;
  const unbind = bindProjectionTelemetry(state, {
    onFallback: recomputeLocalEngines,
    createClient: (opts) => { created = createProjectionClient({ ...opts, fetchImpl: async () => ({ ok: true, json: async () => ({ sessions: [view("r1", "claude", "running")], cursor: "1" }) }), EventSourceImpl: FakeEventSource, setTimeoutImpl: () => ({}), clearTimeoutImpl: () => {} }); return created; }
  });
  await tick();
  FakeEventSource.last().open();
  assert.equal(isServerTruth(), true);
  assert.equal(officeAgentState.getAgentState("claude").activeCount, 1);

  // The same chat is also running in this document: the local store must not add a second one.
  setChatStreaming("demo", "chat-local", true, "claude");
  assert.equal(officeAgentState.getAgentState("claude").activeCount, 1);
  // Poll heuristic (Claude always "active") must not override server truth either.
  syncAgentsFromActivity({ agents: { claude: { status: "active", activeCount: 1, currentTask: "terminal" } } });
  assert.equal(officeAgentState.getAgentState("claude").currentTask, "Execução streaming");

  // Stream drops: fall back to the same-document store.
  FakeEventSource.last().fail();
  assert.equal(isServerTruth(), false);
  assert.equal(officeAgentState.getAgentState("claude").activeCount, 1);
  setChatStreaming("demo", "chat-local", false);
  assert.equal(officeAgentState.getAgentState("claude").activeCount, 0);

  unbind();
  unbindLocal();
  resetChatExecution("demo", "chat-local");
  void h;
});
