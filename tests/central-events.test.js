// @ts-check
// Testes — Event log, projeções e stream recuperável (EP-09.02)

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-events-root-"));
process.env.HARNESS_ROOT = ROOT;
test.after(() => fs.rmSync(ROOT, { recursive: true, force: true }));

const { appendEvent, readEvents, storeStats, closeStore, normalizeEvent, TYPE_ALIASES } = require("../ui/server/services/events/event-store");
const { projectSessions, projectWorkflows, projectAttention } = require("../ui/server/services/events/event-projector");
const { formatSse, formatHeartbeat } = require("../ui/server/services/events/event-stream");

/**
 * Cria um projeto temporário e devolve o slug (o log vive em projects/<slug>).
 * @returns {{ slug: string, cleanup: () => void }}
 */
function tempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-events-"));
  const unique = `${path.basename(dir).replace(/[^a-z0-9]/gi, "").slice(0, 10).toLowerCase()}${Date.now().toString(36).slice(-4)}`;
  const slug = `tmp-eventos-${unique}`;
  fs.mkdirSync(path.join(ROOT, "projects", slug), { recursive: true });
  return {
    slug,
    cleanup: () => {
      try {
        fs.rmSync(path.join(ROOT, "projects", slug), { recursive: true, force: true, maxRetries: 3, retryDelay: 60 });
      } catch {
        // O projeto temporario vive em projects/, que e ignorado pelo git: deixar para tras e seguro.
      }
    },
  };
}

test("event log - grava, lê por cursor e não duplica o mesmo id", () => {
  const { slug, cleanup } = tempProject();
  try {
    const first = appendEvent(slug, { type: "session.discovered", sessionId: "s1", payload: { provider: "claude" } });
    assert.equal(first.duplicated, false);
    assert.ok(first.cursor);

    const again = appendEvent(slug, { id: first.event.id, type: "session.discovered", sessionId: "s1" });
    assert.equal(again.duplicated, true);
    assert.equal(again.cursor, first.cursor);

    appendEvent(slug, { type: "execution.started", sessionId: "s1", executionId: "e1" });

    const all = readEvents(slug, {});
    assert.equal(all.events.length, 2);
    assert.equal(all.events[0].type, "session.discovered");
    assert.equal(all.events[0].sessionId, "s1");
    assert.equal(all.events[0].trust, "observed");

    const after = readEvents(slug, { cursor: first.cursor });
    assert.equal(after.events.length, 1);
    assert.equal(after.events[0].type, "execution.started");
  } finally {
    closeStore(slug);
    cleanup();
  }
});

test("event log - o alias de execução vira o tipo canônico", () => {
  const { slug, cleanup } = tempProject();
  try {
    appendEvent(slug, { type: "execution.completed", sessionId: "s1", executionId: "e1" });
    const { events } = readEvents(slug, {});
    assert.equal(events[0].type, "execution.succeeded");
    assert.equal(TYPE_ALIASES["execution.completed"], "execution.succeeded");
  } finally {
    closeStore(slug);
    cleanup();
  }
});

test("event log - o envelope sai completo e o cursor avança", () => {
  const { slug, cleanup } = tempProject();
  try {
    appendEvent(slug, { type: "workflow.transitioned", sessionId: "s1", executionId: "e1", payload: { status: "running", stageId: "dev" } });
    const { events, cursor } = readEvents(slug, {});
    const event = events[0];
    assert.ok(event.id);
    assert.ok(event.at);
    assert.equal(event.source.provider, "harness");
    assert.equal(event.source.kind, "internal");
    assert.equal(event.trust, "observed");
    assert.equal(event.projectId, slug);
    assert.ok(cursor);
  } finally {
    closeStore(slug);
    cleanup();
  }
});

test("event log - o log sobrevive ao fechamento e reabertura do store", () => {
  const { slug, cleanup } = tempProject();
  try {
    appendEvent(slug, { type: "session.discovered", sessionId: "s1" });
    closeStore(slug);
    const reopened = readEvents(slug, {});
    assert.equal(reopened.events.length, 1);
    assert.equal(reopened.events[0].sessionId, "s1");
  } finally {
    closeStore(slug);
    cleanup();
  }
});

test("projeções - a sessão acumula execução, workflow e atenção", () => {
  const { slug, cleanup } = tempProject();
  try {
    appendEvent(slug, { type: "session.discovered", sessionId: "s1", payload: { provider: "claude" } });
    appendEvent(slug, { type: "execution.started", sessionId: "s1", executionId: "e1" });
    appendEvent(slug, { type: "workflow.blocked", sessionId: "s1", executionId: "e1" });
    appendEvent(slug, { type: "attention.opened", sessionId: "s1", payload: { severity: "high" } });

    const { sessions } = projectSessions(slug);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].executionStatus, "running");
    assert.equal(sessions[0].workflowStatus, "blocked");
    assert.equal(sessions[0].attentionStatus, "open");
    assert.equal(sessions[0].provider, "claude");

    const workflows = projectWorkflows(slug);
    assert.equal(workflows.executions.length, 1);
    assert.equal(workflows.executions[0].status, "running");

    const attention = projectAttention(slug);
    assert.equal(attention.items.length, 1);
    assert.equal(attention.items[0].severity, "high");
  } finally {
    closeStore(slug);
    cleanup();
  }
});

test("projeções - atenção resolvida sai da fila", () => {
  const { slug, cleanup } = tempProject();
  try {
    appendEvent(slug, { type: "attention.opened", sessionId: "s1", payload: { id: "a1" } });
    appendEvent(slug, { type: "attention.resolved", sessionId: "s1", payload: { id: "a1" } });
    const attention = projectAttention(slug);
    assert.equal(attention.items.length, 0);
  } finally {
    closeStore(slug);
    cleanup();
  }
});

test("projeções - a reconstrói o mesmo estado a partir do log", () => {
  const { slug, cleanup } = tempProject();
  try {
    appendEvent(slug, { type: "session.discovered", sessionId: "s1", payload: { provider: "claude" } });
    appendEvent(slug, { type: "execution.succeeded", sessionId: "s1", executionId: "e1" });
    const first = projectSessions(slug);
    const second = projectSessions(slug);
    assert.deepEqual(first.sessions, second.sessions);
    assert.equal(first.sessions[0].executionStatus, "succeeded");
  } finally {
    closeStore(slug);
    cleanup();
  }
});

test("stream - o formato SSE traz id, event e data", () => {
  const event = normalizeEvent({ type: "session.updated", sessionId: "s1", id: "e-1" }, "proj");
  const sse = formatSse(event, "42");
  assert.match(sse, /^id: 42\n/);
  assert.match(sse, /event: session\.updated\n/);
  assert.match(sse, /data: \{/);
  assert.match(sse, /\n\n$/);

  const heartbeat = formatHeartbeat("42");
  assert.match(heartbeat, /^: keep-alive/);
  assert.match(heartbeat, /cursor=42/);
});

test("event log - o resumo traz total, tipos e extremos de cursor", () => {
  const { slug, cleanup } = tempProject();
  try {
    appendEvent(slug, { type: "session.discovered", sessionId: "s1" });
    appendEvent(slug, { type: "session.updated", sessionId: "s1" });
    const stats = storeStats(slug);
    assert.equal(stats.total, 2);
    assert.equal(stats.byType["session.discovered"], 1);
    assert.equal(stats.byType["session.updated"], 1);
    assert.equal(stats.firstCursor, "1");
    assert.equal(stats.lastCursor, "2");
  } finally {
    closeStore(slug);
    cleanup();
  }
});
