// @ts-check
// Testes — API do event log e do stream recuperável (EP-09.02)

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("stream");
const { removeDir } = require("./helpers/temp-dir");

const ROOT = path.resolve(".");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-events-http-"));
process.env.HARNESS_ROOT = TMP_ROOT;

const SLUG = "projeto-eventos";
fs.mkdirSync(path.join(TMP_ROOT, "projects", SLUG), { recursive: true });

const {
  apiProjectEvents,
  apiProjectProjections,
  apiProjectEventPublish,
  apiProjectEventStream,
} = require("../ui/server/controllers/central-events.controller");
const { centralEventRoutes } = require("../ui/server/routes/central-events.routes");
const { closeStore } = require("../ui/server/services/events/event-store");

test.after(() => {
  closeStore(SLUG);
  removeDir(TMP_ROOT);
});

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
    write(chunk) {
      this.chunks.push(String(chunk));
      return true;
    },
    end(body) {
      if (body) this.body = body;
      this.writableEnded = true;
    },
    on() {},
  };
}

function fakeReq({ local = true, body = null, url = "/api/project/x/events" } = {}) {
  const req = Readable.from(body == null ? [] : [typeof body === "string" ? body : JSON.stringify(body)]);
  // @ts-ignore
  req.socket = { remoteAddress: local ? "127.0.0.1" : "192.168.1.50" };
  // @ts-ignore
  req.headers = {};
  // @ts-ignore
  req.url = url;
  return req;
}

test("API de eventos - publica, lê por cursor e devolve o resumo do log", async () => {
  const publish = fakeRes();
  await apiProjectEventPublish({
    req: fakeReq({ body: { type: "session.discovered", sessionId: "s1", payload: { provider: "claude" } } }),
    res: publish,
    params: [SLUG],
  });
  assert.equal(publish.status, 201);
  const published = JSON.parse(publish.body);
  assert.equal(published.duplicated, false);
  assert.ok(published.cursor);

  const again = fakeRes();
  await apiProjectEventPublish({
    req: fakeReq({ body: { id: published.event.id, type: "session.discovered", sessionId: "s1" } }),
    res: again,
    params: [SLUG],
  });
  assert.equal(JSON.parse(again.body).duplicated, true);

  const list = fakeRes();
  await apiProjectEvents({ req: fakeReq({ url: "/api/project/x/events" }), res: list, params: [SLUG] });
  assert.equal(list.status, 200);
  const payload = JSON.parse(list.body);
  assert.equal(payload.events.length, 1);
  assert.equal(payload.stats.total, 1);
  assert.equal(payload.stats.byType["session.discovered"], 1);
});

test("API de eventos - as projeções vêm do log, sem segunda fonte de verdade", async () => {
  await apiProjectEventPublish({
    req: fakeReq({ body: { type: "workflow.blocked", sessionId: "s1", executionId: "e1" } }),
    res: fakeRes(),
    params: [SLUG],
  });

  const res = fakeRes();
  await apiProjectProjections({ req: fakeReq(), res, params: [SLUG] });
  assert.equal(res.status, 200);
  const payload = JSON.parse(res.body);
  assert.equal(payload.sessions.length, 1);
  assert.equal(payload.sessions[0].workflowStatus, "blocked");
  assert.equal(payload.workflows.length, 1);
});

test("API de eventos - publicação e stream são restritos ao loopback", async () => {
  const publishRemoto = fakeRes();
  await apiProjectEventPublish({
    req: fakeReq({ local: false, body: { type: "session.updated" } }),
    res: publishRemoto,
    params: [SLUG],
  });
  assert.equal(publishRemoto.status, 403);

  const streamRemoto = fakeRes();
  await apiProjectEventStream({ req: fakeReq({ local: false }), res: streamRemoto, params: [SLUG] });
  assert.equal(streamRemoto.status, 403);
});

test("API de eventos - projeto inexistente e slug inválido devolvem erro claro", async () => {
  const inexistente = fakeRes();
  await apiProjectEvents({ req: fakeReq(), res: inexistente, params: ["nao-existe"] });
  assert.equal(inexistente.status, 404);

  const invalido = fakeRes();
  await apiProjectEvents({ req: fakeReq(), res: invalido, params: ["../etc"] });
  assert.equal(invalido.status, 400);
});

test("API de eventos - o stream abre com cabeçalho de SSE e envia o histórico", async () => {
  const res = fakeRes();
  const stream = await apiProjectEventStream({ req: fakeReq({ url: "/api/project/x/sessions/stream" }), res, params: [SLUG] });
  assert.equal(res.status, 200);
  assert.match(String(res.headers["Content-Type"]), /text\/event-stream/);
  assert.ok(res.chunks.length > 0);
  assert.match(res.chunks.join(""), /stream aberto/);
  stream.close();
});

test("API de eventos - as rotas seguem o padrão do repositório", () => {
  assert.equal(centralEventRoutes.length, 8);
  for (const route of centralEventRoutes) {
    assert.ok(route.method && route.path instanceof RegExp && route.handler);
  }
  const source = fs.readFileSync(path.join(__dirname, "..", "ui", "server", "routes", "central-events.routes.js"), "utf8");
  assert.doesNotMatch(source, /[\u{1F300}-\u{1F9FF}]/u);
  assert.ok(source.split("\n").length < 300);
});

test("API de eventos - o store fecha sem quebrar a suite", () => {
  closeStore(SLUG);
  assert.ok(true);
});

test("API de eventos - POST rejeita tipo desconhecido e trust declared com erro claro", async () => {
  const unknown = fakeRes();
  await apiProjectEventPublish({ req: fakeReq({ body: { type: "made.up" } }), res: unknown, params: [SLUG] });
  assert.equal(unknown.status, 422);
  assert.equal(JSON.parse(unknown.body).code, "unknown_type");

  const declared = fakeRes();
  await apiProjectEventPublish({ req: fakeReq({ body: { type: "run.started", trust: "declared" } }), res: declared, params: [SLUG] });
  assert.equal(declared.status, 422);
  assert.equal(JSON.parse(declared.body).code, "trust_declared_forbidden");

  const ok = fakeRes();
  await apiProjectEventPublish({ req: fakeReq({ body: { type: "usage.observed", idempotencyKey: "k1", payload: { apiKey: "x" } } }), res: ok, params: [SLUG] });
  assert.equal(ok.status, 201);
  assert.equal(JSON.parse(ok.body).event.payload.apiKey, "[redacted]");
  closeStore(SLUG);
});
