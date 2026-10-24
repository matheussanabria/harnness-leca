// @ts-check
// Testes - Envelope v1, migracao por user_version, idempotencia, allowlist e sanitizador (T1.2)

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-envelope-root-"));
process.env.HARNESS_ROOT = ROOT;
test.after(() => fs.rmSync(ROOT, { recursive: true, force: true }));

const { appendEvent, readEvents, closeStore, openStore, TYPE_ALIASES } = require("../ui/server/services/events/event-store");
const { BASE_DDL, readUserVersion } = require("../ui/server/services/events/event-migrations");
const { ingestEvent, prepareEvent, IngestError } = require("../ui/server/services/events/event-ingest");
const { ALLOWED_TYPES, isAllowedType, ALIAS_TYPES } = require("../ui/server/services/events/event-type-allowlist");
const { LIMITS } = require("../ui/server/services/events/event-sanitizer");
const { EVENT_CATALOG } = require("../ui/server/services/orchestration/event-contract");

let counter = 0;
/** @returns {string} slug de projeto temporario */
function tempSlug() {
  counter += 1;
  const slug = `tmp-envelope-${process.pid}-${counter}`;
  fs.mkdirSync(path.join(ROOT, "projects", slug, "coordination"), { recursive: true });
  return slug;
}

test("migracao - banco antigo (user_version 0) abre, mantem os dados e ganha o envelope", () => {
  const slug = tempSlug();
  const file = path.join(ROOT, "projects", slug, "coordination", "events.sqlite");
  const old = new DatabaseSync(file);
  old.exec(BASE_DDL);
  old.prepare("INSERT INTO events (id, type, at, session_id, payload) VALUES (?, ?, ?, ?, ?)")
    .run("old-1", "session.discovered", "2026-01-01T00:00:00.000Z", "s-old", '{"provider":"claude"}');
  assert.equal(readUserVersion(old), 0);
  old.close();

  const db = openStore(slug);
  assert.equal(readUserVersion(db), 1);
  const cols = db.prepare("PRAGMA table_info(events)").all().map((c) => c.name);
  for (const name of ["schema_version", "ingested_at", "run_id", "relation", "idempotency_key", "engine_instance_id"]) {
    assert.ok(cols.includes(name), `coluna ${name}`);
  }
  const { events } = readEvents(slug, {});
  assert.equal(events.length, 1);
  assert.equal(events[0].id, "old-1");
  assert.equal(events[0].payload.provider, "claude");
  assert.equal(events[0].schemaVersion, 1);
  assert.equal(events[0].ingestedAt, null);
  assert.equal(events[0].runId, null);
  assert.equal(events[0].relation, null);
  closeStore(slug);
});

test("migracao - reabrir e idempotente e nao perde linhas novas", () => {
  const slug = tempSlug();
  appendEvent(slug, { type: "run.started", runId: "r1" });
  closeStore(slug);
  const db = openStore(slug);
  assert.equal(readUserVersion(db), 1);
  closeStore(slug);
  const again = openStore(slug);
  assert.equal(readUserVersion(again), 1);
  assert.equal(readEvents(slug, {}).events.length, 1);
  closeStore(slug);
});

test("migracao - user_version maior que o conhecido nao e rebaixado", () => {
  const slug = tempSlug();
  const db = openStore(slug);
  db.exec("PRAGMA user_version = 7");
  closeStore(slug);
  assert.equal(readUserVersion(openStore(slug)), 7);
  closeStore(slug);
});

test("envelope - campos persistem, ausentes ficam null e ingestedAt e do servidor", () => {
  const slug = tempSlug();
  const before = Date.now();
  const { event } = appendEvent(slug, {
    type: "run.started",
    at: "2020-01-01T00:00:00.000Z",
    ingestedAt: "1999-01-01T00:00:00.000Z",
    runId: "run-1",
    parentRunId: "run-0",
    traceId: "t1",
    agentId: "ag",
    taskId: "tk",
    workflowRunId: "wf",
    stepRunId: "st",
    attemptId: "at1",
    engineInstanceId: "claude@host",
    nativeSessionId: "native-1",
    relation: "declared",
  });
  const [read] = readEvents(slug, {}).events;
  assert.equal(read.at, "2020-01-01T00:00:00.000Z");
  assert.ok(Date.parse(String(read.ingestedAt)) >= before);
  assert.equal(read.runId, "run-1");
  assert.equal(read.parentRunId, "run-0");
  assert.equal(read.engineInstanceId, "claude@host");
  assert.equal(read.nativeSessionId, "native-1");
  assert.equal(read.relation, "declared");
  assert.equal(read.schemaVersion, 1);
  assert.equal(read.idempotencyKey, null);

  const bare = appendEvent(slug, { type: "run.finished" }).event;
  const [, second] = readEvents(slug, {}).events;
  for (const key of ["runId", "parentRunId", "traceId", "agentId", "taskId", "workflowRunId", "stepRunId", "attemptId", "engineInstanceId", "nativeSessionId", "relation", "idempotencyKey"]) {
    assert.equal(second[key], null, key);
    assert.equal(bare[key], null, key);
  }
  assert.equal(event.id.length > 0, true);
  closeStore(slug);
});

test("envelope - relation invalida no store vira null, zero e string vazia nao viram valor", () => {
  const slug = tempSlug();
  appendEvent(slug, { type: "run.started", relation: "bogus", runId: "", taskId: 0, agentId: {} });
  const [ev] = readEvents(slug, {}).events;
  assert.equal(ev.relation, null);
  assert.equal(ev.runId, null);
  assert.equal(ev.agentId, null);
  closeStore(slug);
});

test("idempotencia - mesma idempotencyKey com ids diferentes e no-op; replay nao muda a contagem", () => {
  const slug = tempSlug();
  const input = { type: "usage.observed", source: { provider: "claude", kind: "adapter" }, idempotencyKey: "call-1", payload: { tokens: { input: 10 } } };
  const first = appendEvent(slug, input);
  const replay = appendEvent(slug, { ...input, payload: { tokens: { input: 99 } } });
  assert.equal(first.duplicated, false);
  assert.equal(replay.duplicated, true);
  assert.equal(replay.cursor, first.cursor);
  assert.equal(replay.event.id, first.event.id);
  assert.equal(replay.event.payload.tokens.input, 10);
  assert.equal(readEvents(slug, {}).events.length, 1);

  const otherSource = appendEvent(slug, { ...input, source: { provider: "codex", kind: "adapter" } });
  assert.equal(otherSource.duplicated, false);
  const noKeyA = appendEvent(slug, { type: "run.started" });
  const noKeyB = appendEvent(slug, { type: "run.started" });
  assert.equal(noKeyA.duplicated, false);
  assert.equal(noKeyB.duplicated, false);
  assert.equal(readEvents(slug, {}).events.length, 4);
  closeStore(slug);
});

test("idempotencia - dedup por id continua valendo", () => {
  const slug = tempSlug();
  const a = appendEvent(slug, { id: "fixed", type: "run.started" });
  const b = appendEvent(slug, { id: "fixed", type: "run.started", idempotencyKey: "k" });
  assert.equal(b.duplicated, true);
  assert.equal(b.cursor, a.cursor);
  closeStore(slug);
});

test("allowlist - cobre catalogo EP-08.04, EP-09, aliases e tipos novos; rejeita desconhecidos", () => {
  for (const type of EVENT_CATALOG) assert.ok(isAllowedType(type), type);
  for (const type of ["session.discovered", "workflow.blocked", "approval.resolved", "attention.opened", "usage.observed", "skill.discovered", "skill.loaded", "skill.applied", "run.started", "run.finished"]) {
    assert.ok(isAllowedType(type), type);
  }
  assert.deepEqual([...ALIAS_TYPES].sort(), Object.keys(TYPE_ALIASES).sort());
  assert.ok(ALLOWED_TYPES.size > 40);
  assert.equal(isAllowedType("evil.type"), false);
  assert.equal(isAllowedType("event"), false);
});

test("ingest - tipo desconhecido e ausente sao rejeitados e nada e gravado", () => {
  const slug = tempSlug();
  assert.throws(() => ingestEvent(slug, { type: "made.up" }), (err) => err instanceof IngestError && err.code === "unknown_type" && err.status === 422);
  assert.throws(() => ingestEvent(slug, {}), (err) => err instanceof IngestError && err.code === "missing_type");
  assert.throws(() => ingestEvent(slug, []), (err) => err instanceof IngestError && err.code === "invalid_body");
  assert.equal(readEvents(slug, {}).events.length, 0);
  closeStore(slug);
});

test("ingest - alias e aceito e vira o tipo canonico", () => {
  const slug = tempSlug();
  const result = ingestEvent(slug, { type: "execution.completed", executionId: "e1" });
  assert.equal(result.event.type, "execution.succeeded");
  closeStore(slug);
});

test("ingest - trust=declared e rejeitado; observed e inferred passam; valor desconhecido segue como observed", () => {
  const slug = tempSlug();
  assert.throws(() => ingestEvent(slug, { type: "run.started", trust: "declared" }), (err) => err instanceof IngestError && err.code === "trust_declared_forbidden");
  assert.equal(ingestEvent(slug, { type: "run.started", trust: "inferred" }).event.trust, "inferred");
  assert.equal(ingestEvent(slug, { type: "run.started", trust: "weird" }).event.trust, "observed");
  closeStore(slug);
});

test("ingest - envelope invalido e rejeitado", () => {
  const slug = tempSlug();
  assert.throws(() => ingestEvent(slug, { type: "run.started", relation: "maybe" }), (err) => err.code === "invalid_relation");
  assert.throws(() => ingestEvent(slug, { type: "run.started", schemaVersion: 99 }), (err) => err.code === "unsupported_schema_version");
  assert.throws(() => ingestEvent(slug, { type: "run.started", runId: { a: 1 } }), (err) => err.code === "invalid_envelope_field");
  assert.throws(() => ingestEvent(slug, { type: "run.started", runId: "x".repeat(500) }), (err) => err.code === "invalid_envelope_field");
  assert.throws(() => ingestEvent(slug, { type: "run.started", payload: [1] }), (err) => err.code === "invalid_payload");
  closeStore(slug);
});

test("ingest - replay do mesmo input e no-op e ingestedAt do cliente e ignorado", () => {
  const slug = tempSlug();
  const body = { type: "usage.observed", idempotencyKey: "u1", ingestedAt: "1999-01-01T00:00:00.000Z", payload: { tokens: { input: 1, output: null } } };
  const first = ingestEvent(slug, body);
  const second = ingestEvent(slug, body);
  assert.equal(first.duplicated, false);
  assert.equal(second.duplicated, true);
  assert.notEqual(first.event.ingestedAt, "1999-01-01T00:00:00.000Z");
  assert.equal(second.event.payload.tokens.output, null);
  closeStore(slug);
});

test("ingest - payload acima do teto e rejeitado com 413 e segredo no payload nao chega ao banco", () => {
  const slug = tempSlug();
  const huge = { a: Array.from({ length: LIMITS.items }, () => "y".repeat(LIMITS.string)) };
  assert.throws(() => ingestEvent(slug, { type: "run.started", payload: huge }), (err) => err.code === "payload_too_large" && err.status === 413);
  const fake = `ghp_${"b".repeat(30)}`;
  ingestEvent(slug, { type: "run.started", payload: { token: fake, info: fake } });
  const raw = JSON.stringify(readEvents(slug, {}).events);
  assert.equal(raw.includes(fake), false);
  assert.equal(prepareEvent({ type: "run.started" }).input.type, "run.started");
  closeStore(slug);
});
