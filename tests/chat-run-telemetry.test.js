// @ts-check
const os = require("os");
const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");
const test = require("node:test");
const assert = require("node:assert/strict");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-chat-run-"));
process.env.HARNESS_ROOT = TMP_ROOT;
process.env.HIA_ROUTING_ENABLED = "false";
process.env.HARNESS_MAX_CHATS = "3";

const SLUG = "projeto-chat";
fs.mkdirSync(path.join(TMP_ROOT, "projects", SLUG), { recursive: true });

const E = require("../tools/lib/engines");
const shadow = require("../tools/lib/runtime/shadow");
shadow.interceptShadowRequest = () => {}; // sem classificacao em background (rede) nos testes
const { apiChat } = require("../ui/server/controllers/chat.controller");
const { readEvents } = require("../ui/server/services/events/event-store");
const { projectSessions } = require("../ui/server/services/events/event-projector");
const ingest = require("../ui/server/services/events/event-ingest");
const telemetry = require("../ui/server/services/chat-run-telemetry.service");

test.after(() => {
  require("../ui/server/services/events/event-store").closeStore(SLUG);
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

/** Motor falso: guarda os handlers para o teste dirigir o stream. */
const calls = [];
for (const id of ["fakea", "fakeb"]) {
  E.engines.set(id, /** @type {any} */ ({ id, stream: (args) => calls.push({ id, ...args }) }));
}

function fakeRes() {
  const res = /** @type {any} */ (new EventEmitter());
  Object.assign(res, { writableEnded: false, writableFinished: false, destroyed: false, status: 0, written: [] });
  res.writeHead = (status) => { res.status = status; };
  res.flushHeaders = () => {};
  res.write = (chunk) => { res.written.push(String(chunk)); return true; };
  res.end = (chunk) => {
    if (chunk) res.written.push(String(chunk));
    res.writableEnded = true;
    res.writableFinished = true;
    res.emit("close");
  };
  res.disconnect = () => { res.destroyed = true; res.emit("close"); };
  return res;
}

async function chat(body) {
  const req = /** @type {any} */ (new EventEmitter());
  req.socket = { localPort: 1 };
  const res = fakeRes();
  const pending = apiChat({ req, res });
  process.nextTick(() => {
    req.emit("data", JSON.stringify({ slug: SLUG, prompt: "SEGREDO-NO-PROMPT", ...body }));
    req.emit("end");
  });
  await pending;
  return { res, call: calls[calls.length - 1] };
}

const stored = () => readEvents(SLUG, { limit: 1000 }).events;
const ofRun = (runId) => stored().filter((e) => e.runId === runId);
const types = (runId) => ofRun(runId).map((e) => e.type);

function latestRunId() {
  const started = stored().filter((e) => e.type === "run.started");
  return started[started.length - 1].runId;
}

test("execucao normal: started, id nativo, succeeded e run.finished", async () => {
  const { res, call } = await chat({ engine: "fakea", model: "m-1" });
  const runId = latestRunId();
  assert.deepEqual(types(runId), ["session.discovered", "run.started", "execution.started"]);
  call.onChunk({ type: "text", text: "ola", sessionId: "native-111" });
  call.onChunk({ type: "text", text: "de novo", sessionId: "native-111" });
  call.onDone({ sessionId: "native-111", fullText: "RESPOSTA-SECRETA" });
  assert.deepEqual(types(runId), [
    "session.discovered", "run.started", "execution.started", "session.updated", "execution.succeeded", "run.finished",
  ]);
  const events = ofRun(runId);
  const started = events.find((e) => e.type === "run.started");
  assert.equal(started.payload.model, "m-1");
  assert.equal(started.relation, "declared");
  assert.match(started.engineInstanceId, /^fakea@/);
  assert.equal(started.traceId, runId);
  const updated = events.find((e) => e.type === "session.updated");
  assert.equal(updated.nativeSessionId, "native-111");
  assert.equal(updated.relation, "native");
  assert.equal(events.find((e) => e.type === "execution.succeeded").payload.status, "succeeded");
  assert.equal(res.status, 200);
  const session = projectSessions(SLUG).sessions.find((s) => s.sessionId === runId);
  assert.equal(session.executionStatus, "succeeded");
  assert.equal(session.provider, "fakea");
});

test("erro do motor: execution.failed com codigo, sem mensagem", async () => {
  const { call } = await chat({ engine: "fakea" });
  const runId = latestRunId();
  call.onError(new Error("rate limit reached for key SEGREDO"));
  assert.deepEqual(types(runId).slice(-2), ["execution.failed", "run.finished"]);
  const failed = ofRun(runId).find((e) => e.type === "execution.failed");
  assert.equal(failed.payload.status, "failed");
  assert.equal(failed.payload.errorCode, "limit");
  assert.ok(!JSON.stringify(failed.payload).includes("SEGREDO"));
  assert.equal(projectSessions(SLUG).sessions.find((s) => s.sessionId === runId).executionStatus, "failed");
});

test("cliente desconecta: cancelled com reason client_disconnected, terminal unico", async () => {
  const { res, call } = await chat({ engine: "fakea" });
  const runId = latestRunId();
  res.disconnect();
  assert.equal(call.signal.aborted, true);
  call.onError(new Error("aborted")); // o motor reage ao abort depois do close
  call.onDone({ sessionId: "x", fullText: "tarde demais" });
  assert.deepEqual(types(runId), [
    "session.discovered", "run.started", "execution.started", "execution.cancelled", "run.finished",
  ]);
  const cancelled = ofRun(runId).find((e) => e.type === "execution.cancelled");
  assert.equal(cancelled.payload.reason, "client_disconnected");
  assert.equal(projectSessions(SLUG).sessions.find((s) => s.sessionId === runId).executionStatus, "cancelled");
});

test("compare: uma execucao por motor, mesmo traceId", async () => {
  const a = await chat({ engine: "fakea", traceId: "cmp-1" });
  const runA = latestRunId();
  const b = await chat({ engine: "fakeb", traceId: "cmp-1" });
  const runB = latestRunId();
  assert.notEqual(runA, runB);
  for (const runId of [runA, runB]) {
    assert.equal(ofRun(runId).find((e) => e.type === "run.started").traceId, "cmp-1");
  }
  a.call.onDone({ sessionId: "n-a", fullText: "" });
  b.call.onError(new Error("x"));
  assert.equal(ofRun(runA).find((e) => e.type === "execution.succeeded").traceId, "cmp-1");
  assert.equal(ofRun(runB).find((e) => e.type === "execution.failed").traceId, "cmp-1");
});

test("duas sessoes do mesmo motor (id fixo do Ollama) ficam independentes na projecao", async () => {
  const one = await chat({ engine: "fakea" });
  const runOne = latestRunId();
  const two = await chat({ engine: "fakea" });
  const runTwo = latestRunId();
  one.call.onChunk({ type: "text", text: "a", sessionId: "ollama-local" });
  two.call.onChunk({ type: "text", text: "b", sessionId: "ollama-local" });
  one.call.onDone({ sessionId: "ollama-local", fullText: "" });
  const view = (id) => projectSessions(SLUG).sessions.find((s) => s.sessionId === id);
  assert.equal(view(runOne).executionStatus, "succeeded");
  assert.equal(view(runTwo).executionStatus, "running");
  assert.equal(view("ollama-local"), undefined);
  assert.equal(ofRun(runTwo).filter((e) => e.type === "session.updated").length, 0);
  two.call.onDone({ sessionId: "ollama-local", fullText: "" });
  assert.equal(view(runTwo).executionStatus, "succeeded");
});

test("retomada: o id nativo valido do cliente vira a chave de sessao", async () => {
  const { call } = await chat({ engine: "fakea", sessionId: "native-resume" });
  const runId = latestRunId();
  assert.equal(ofRun(runId)[0].sessionId, "native-resume");
  assert.equal(ofRun(runId)[0].nativeSessionId, "native-resume");
  assert.equal(ofRun(runId).find((e) => e.type === "run.started").payload.resumed, true);
  call.onDone({ sessionId: "native-resume", fullText: "" });
});

test("nenhum texto de prompt ou saida e armazenado", async () => {
  const { call } = await chat({ engine: "fakea" });
  call.onChunk({ type: "text", text: "TEXTO-DE-SAIDA", sessionId: "native-priv" });
  call.onDone({ sessionId: "native-priv", fullText: "TEXTO-DE-SAIDA" });
  const dump = JSON.stringify(stored());
  assert.ok(!dump.includes("SEGREDO-NO-PROMPT"));
  assert.ok(!dump.includes("TEXTO-DE-SAIDA"));
});

test("store falhando nao afeta a resposta; falhas sao contadas", async () => {
  const original = ingest.ingestEvent;
  telemetry.resetChatTelemetryStats();
  const warn = console.warn;
  let warnings = 0;
  console.warn = () => { warnings += 1; };
  ingest.ingestEvent = () => { throw new Error("disco cheio"); };
  try {
    const { res, call } = await chat({ engine: "fakea" });
    call.onChunk({ type: "text", text: "ok", sessionId: "native-f" });
    call.onDone({ sessionId: "native-f", fullText: "ok" });
    assert.equal(res.status, 200);
    assert.ok(res.writableFinished);
    assert.ok(res.written.some((line) => line.includes('"type":"done"')));
    assert.ok(telemetry.getChatTelemetryStats().failed >= 5);
    assert.equal(warnings, 1);
  } finally {
    ingest.ingestEvent = original;
    console.warn = warn;
  }
});

test("429: rejeicao por capacidade e visivel, sem spawn nem sessao", async () => {
  const held = [];
  for (let i = 0; i < 3; i += 1) held.push(await chat({ engine: "fakea" }));
  const spawnsBefore = calls.length;
  const rejected = await chat({ engine: "fakeb", traceId: "cmp-429" });
  assert.equal(rejected.res.status, 429);
  assert.equal(calls.length, spawnsBefore);
  const event = stored().filter((e) => e.type === "run.finished" && e.payload.status === "rejected").pop();
  assert.equal(event.payload.reason, "capacity");
  assert.equal(event.payload.limit, 3);
  assert.equal(event.sessionId, null);
  assert.equal(event.traceId, "cmp-429");
  assert.equal(projectSessions(SLUG).sessions.some((s) => s.sessionId === event.runId), false);
  for (const h of held) h.call.onDone({ sessionId: "z", fullText: "" });
});

test("replay do mesmo evento e no-op (chave de idempotencia por execucao)", async () => {
  const { call } = await chat({ engine: "fakea" });
  const runId = latestRunId();
  const before = ofRun(runId).length;
  const started = ofRun(runId).find((e) => e.type === "run.started");
  const again = ingest.ingestEvent(SLUG, { type: "run.started", source: started.source, runId, idempotencyKey: started.idempotencyKey });
  assert.equal(again.duplicated, true);
  assert.equal(ofRun(runId).length, before);
  call.onDone({ sessionId: "n", fullText: "" });
});
