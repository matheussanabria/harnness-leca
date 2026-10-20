// @ts-check
// Testes unitários para o Centro de Orquestração M2 (Contratos, Event Engine, Adaptadores e API)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createEvent, validateEvent, EVENT_CATALOG } = require("../ui/server/services/orchestration/event-contract");
const { EventEngine } = require("../ui/server/services/orchestration/event-engine");
const { collectClaudeEvents } = require("../ui/server/services/orchestration/adapters/claude-adapter");
const { collectGeminiEvents } = require("../ui/server/services/orchestration/adapters/gemini-adapter");
const { collectOpenCodeEvents } = require("../ui/server/services/orchestration/adapters/opencode-adapter");
const { pollAllSources } = require("../ui/server/services/orchestration/orchestration-collector");

test("M2 Contrato: valida campos obrigatórios e rejeita eventos inválidos", () => {
  const validEvt = createEvent({
    type: "execution.started",
    source: { kind: "native", provider: "claude", confidence: "explicit" },
    executionId: "exec-123",
    agentId: "claude",
    payload: { prompt: "teste" }
  });

  assert.ok(validEvt.id);
  assert.equal(validEvt.type, "execution.started");
  assert.equal(validEvt.schemaVersion, 1);
  assert.equal(validEvt.source.confidence, "explicit");

  // Rejeita tipo não catalogado
  assert.throws(() => {
    // @ts-ignore
    createEvent({
      type: "tipo.inventado",
      source: { kind: "native", provider: "claude", confidence: "explicit" },
      payload: {}
    });
  }, /Contrato de evento violado/);

  // Rejeita nível de confiança inválido
  assert.throws(() => {
    // @ts-ignore
    createEvent({
      type: "execution.started",
      source: { kind: "native", provider: "claude", confidence: "super_confiante" },
      payload: {}
    });
  }, /source\.confidence/);
});

test("M2 EventEngine: ingestão, deduplicação e limite de histórico", () => {
  const engine = new EventEngine({ maxHistory: 3 });

  const evt1 = createEvent({
    id: "evt-1",
    type: "execution.started",
    source: { kind: "native", provider: "claude", sourceEventId: "src-10", confidence: "explicit" },
    executionId: "ex-1",
    payload: {}
  });

  const res1 = engine.ingest(evt1);
  assert.equal(res1.accepted, true);

  // Duplicata por ID
  const dup1 = engine.ingest(evt1);
  assert.equal(dup1.accepted, false);
  assert.equal(dup1.duplicate, true);

  // Duplicata por sourceEventId
  const evt1DiffId = createEvent({
    id: "evt-diff",
    type: "execution.progressed",
    source: { kind: "native", provider: "claude", sourceEventId: "src-10", confidence: "explicit" },
    executionId: "ex-1",
    payload: {}
  });
  const dupSource = engine.ingest(evt1DiffId);
  assert.equal(dupSource.accepted, false);
  assert.equal(dupSource.duplicate, true);

  // Limite de histórico (maxHistory = 3)
  const evt2 = createEvent({ id: "evt-2", type: "task.created", source: { kind: "native", provider: "gemini", confidence: "observed" }, payload: {} });
  const evt3 = createEvent({ id: "evt-3", type: "task.started", source: { kind: "native", provider: "gemini", confidence: "observed" }, payload: {} });
  const evt4 = createEvent({ id: "evt-4", type: "task.completed", source: { kind: "native", provider: "gemini", confidence: "observed" }, payload: {} });

  engine.ingest(evt2);
  engine.ingest(evt3);
  engine.ingest(evt4);

  const history = engine.getEvents({ limit: 10 });
  assert.equal(history.length, 3);
  assert.equal(history[0].id, "evt-2");
  assert.equal(history[2].id, "evt-4");
});

test("M2 EventEngine: projeção de estado de execuções e tarefas", () => {
  const engine = new EventEngine();

  engine.ingest(createEvent({
    id: "e-start",
    type: "execution.started",
    source: { kind: "native", provider: "claude", confidence: "explicit" },
    executionId: "exec-99",
    agentId: "claude",
    projectId: "demo",
    payload: {}
  }));

  let state = engine.getState("demo");
  assert.equal(state.summary.runningExecutions, 1);
  const ex = state.executions.find(e => e.id === "exec-99");
  assert.ok(ex);
  assert.equal(ex.status, "running");

  // Adiciona tarefa e ferramenta
  engine.ingest(createEvent({
    type: "task.started",
    source: { kind: "native", provider: "claude", confidence: "explicit" },
    executionId: "exec-99",
    taskId: "task-1",
    payload: { title: "Compilar código" }
  }));

  engine.ingest(createEvent({
    type: "tool.completed",
    source: { kind: "native", provider: "claude", confidence: "explicit" },
    executionId: "exec-99",
    payload: { toolName: "run_command", hint: "npm run build" }
  }));

  engine.ingest(createEvent({
    type: "execution.completed",
    source: { kind: "native", provider: "claude", confidence: "explicit" },
    executionId: "exec-99",
    payload: {}
  }));

  state = engine.getState("demo");
  assert.equal(state.summary.runningExecutions, 0);
  assert.equal(state.summary.completedExecutions, 1);
  const updatedEx = state.executions.find(e => e.id === "exec-99");
  assert.equal(updatedEx.status, "completed");
  assert.equal(updatedEx.tasks.length, 1);
  assert.equal(updatedEx.tools.length, 1);
  assert.equal(updatedEx.tools[0].name, "run_command");
});

test("M2 Adaptadores: tolerância a falhas e isolamento quando diretório não existe", () => {
  const tmpDir = path.join(os.tmpdir(), `harness-test-m2-${Date.now()}`);

  // Coleta em pasta inexistente reporta integration.status_changed desconectada sem quebrar
  const claudeEvents = collectClaudeEvents({ claudeDir: path.join(tmpDir, "claude-fake") });
  assert.ok(claudeEvents.length >= 1);
  assert.equal(claudeEvents[0].type, "integration.status_changed");
  assert.equal(claudeEvents[0].payload.available, false);

  const geminiEvents = collectGeminiEvents({ brainDir: path.join(tmpDir, "gemini-fake") });
  assert.ok(geminiEvents.length >= 1);
  assert.equal(geminiEvents[0].type, "integration.status_changed");
  assert.equal(geminiEvents[0].payload.available, false);

  const opencodeEvents = collectOpenCodeEvents({ dbPath: path.join(tmpDir, "opencode-fake.db") });
  assert.ok(opencodeEvents.length >= 1);
  assert.equal(opencodeEvents[0].type, "integration.status_changed");
  assert.equal(opencodeEvents[0].payload.available, false);

  // Coletor orquestrador não lança erro fatal mesmo com falhas
  const pollRes = pollAllSources("demo-slug");
  assert.ok(pollRes.collected >= 0);
  assert.ok(Array.isArray(pollRes.errors));
});

test("M2 Adaptador OpenCode: mapeia subagentes reais via parent_id no SQLite", () => {
  const tmpDb = path.join(os.tmpdir(), `opencode-test-${Date.now()}.db`);
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(tmpDb);

  db.exec(`
    CREATE TABLE session (
      id TEXT PRIMARY KEY,
      title TEXT,
      directory TEXT,
      time_created INTEGER,
      time_updated INTEGER,
      agent TEXT,
      model TEXT,
      parent_id TEXT
    );
  `);

  const nowSec = Math.floor(Date.now() / 1000);
  db.exec(`
    INSERT INTO session (id, title, directory, time_created, time_updated, agent, model, parent_id)
    VALUES
      ('ses_root', 'Sessão Pai', 'C:/proj', ${nowSec - 100}, ${nowSec - 50}, 'build', 'claude-3', NULL),
      ('ses_child', 'Subagente QA', 'C:/proj', ${nowSec - 40}, ${nowSec - 10}, 'qa', 'claude-3', 'ses_root');
  `);
  db.close();

  const events = collectOpenCodeEvents({ dbPath: tmpDb, maxAgeMs: 600000 });
  try { fs.unlinkSync(tmpDb); } catch {}

  const childExec = events.find(e => e.executionId === "ses_child" && e.type.startsWith("execution."));
  assert.ok(childExec);
  assert.equal(childExec.parentExecutionId, "ses_root");
  assert.equal(childExec.source.confidence, "explicit");

  const subTask = events.find(e => e.taskId === "opencode-sub-ses_child");
  assert.ok(subTask);
  assert.equal(subTask.parentExecutionId, "ses_root");
});

test("M2 API HTTP: endpoints de estado, eventos, capabilities e operações", async () => {
  const { createServer } = require("../ui/server");
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    // 1. GET /api/orchestration/state
    const stateRes = await fetch(`${base}/api/orchestration/state`);
    assert.equal(stateRes.status, 200);
    const state = await stateRes.json();
    assert.ok(state.timestamp);
    assert.ok(Array.isArray(state.agents));
    assert.ok(Array.isArray(state.executions));
    assert.ok(Array.isArray(state.integrations));

    // 2. GET /api/orchestration/events
    const eventsRes = await fetch(`${base}/api/orchestration/events?limit=5`);
    assert.equal(eventsRes.status, 200);
    const eventsData = await eventsRes.json();
    assert.ok(Array.isArray(eventsData.events));

    // 3. GET /api/orchestration/capabilities
    const capRes = await fetch(`${base}/api/orchestration/capabilities`);
    assert.equal(capRes.status, 200);
    const capData = await capRes.json();
    assert.ok(capData.capabilities.claude);
    assert.equal(capData.capabilities.claude.pauseSupported, false, "Pausa deve estar explicitamente false");
    assert.ok(capData.capabilities.proc_manager);

    // 4. POST /api/orchestration/operations - Rejeita ação inválida
    const invalidOpRes = await fetch(`${base}/api/orchestration/operations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": base },
      body: JSON.stringify({ action: "acao.fantasma", target: { provider: "claude" } })
    });
    assert.equal(invalidOpRes.status, 400);
    const invalidData = await invalidOpRes.json();
    assert.equal(invalidData.status, "rejected");

    // 5. POST /api/orchestration/operations - Suporta project.sync
    const syncOpRes = await fetch(`${base}/api/orchestration/operations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": base },
      body: JSON.stringify({ action: "project.sync", target: { projectId: "saude-dispensacao" } })
    });
    assert.equal(syncOpRes.status, 200);
    const syncData = await syncOpRes.json();
    assert.ok(syncData.operationId);
    assert.equal(syncData.status, "completed");
    assert.equal(syncData.action, "project.sync");

    // 6. GET /api/orchestration/stream - Conexão SSE
    const streamRes = await fetch(`${base}/api/orchestration/stream`);
    assert.equal(streamRes.status, 200);
    assert.ok(streamRes.headers.get("content-type").includes("text/event-stream"));
    streamRes.body?.cancel();

  } finally {
    server.closeAllConnections();
    server.close();
  }
});
