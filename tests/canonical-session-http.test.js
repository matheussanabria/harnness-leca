// @ts-check
// Testes — API do registro canônico de sessões (EP-09.01)

const os = require("os");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const test = require("node:test");
const assert = require("node:assert/strict");
const { removeDir } = require("./helpers/temp-dir");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-sessions-http-"));
process.env.HARNESS_ROOT = TMP_ROOT;
const { closeStore } = require("../ui/server/services/events/event-store");
test.after(() => {
  closeStore(SLUG);
  removeDir(TMP_ROOT);
});

const SLUG = "projeto-sessoes";
const PROJECT_DIR = path.join(TMP_ROOT, "projects", SLUG);

fs.mkdirSync(path.join(PROJECT_DIR, "chats"), { recursive: true });
fs.writeFileSync(
  path.join(PROJECT_DIR, "chats", "2026-10-21-x.md"),
  "---\ntitulo: Sessão importada\nsessao: sessao-x\ninicio: 2026-10-21T10:00:00Z\n---\n\n## Você\n\nOlá.\n",
  "utf8",
);

const {
  apiProjectSessions,
  apiProjectSessionsScan,
  apiProjectSession,
  apiProjectSessionLink,
} = require("../ui/server/controllers/canonical-session.controller");
const { canonicalSessionRoutes } = require("../ui/server/routes/canonical-sessions.routes");

function fakeRes() {
  return {
    headersSent: false,
    writableEnded: false,
    status: 0,
    body: "",
    setHeader() {},
    writeHead(code) {
      this.status = code;
      this.headersSent = true;
    },
    end(body) {
      this.body = body;
      this.writableEnded = true;
    },
  };
}

function fakeReq({ local = true, body = null, url = "/api/project/x/sessions" } = {}) {
  const req = Readable.from(body == null ? [] : [JSON.stringify(body)]);
  // @ts-ignore
  req.socket = { remoteAddress: local ? "127.0.0.1" : "192.168.1.50" };
  // @ts-ignore
  req.headers = {};
  // @ts-ignore
  req.url = url;
  return req;
}

test("API de sessões - a varredura registra as conversas e a listagem devolve o read model", async () => {
  const scanRes = fakeRes();
  await apiProjectSessionsScan({ req: fakeReq(), res: scanRes, params: [SLUG] });
  assert.equal(scanRes.status, 200);
  const scanned = JSON.parse(scanRes.body);
  assert.equal(scanned.sessions.length, 1);
  assert.equal(scanned.sessions[0].primaryProvider, "markdown");
  assert.ok(scanned.sessions[0].id);

  const listRes = fakeRes();
  await apiProjectSessions({ req: fakeReq(), res: listRes, params: [SLUG] });
  assert.equal(listRes.status, 200);
  const payload = JSON.parse(listRes.body);
  assert.equal(payload.sessions.length, 1);
  assert.equal(payload.schemaVersion, 1);
  assert.ok(payload.generatedAt);
  assert.equal(payload.totals.total, 1);
  assert.equal(payload.totals.byProvider.markdown, 1);
});

test("API de sessões - filtro por motor e busca funcionam na listagem", async () => {
  const res = fakeRes();
  await apiProjectSessions({ req: fakeReq({ url: "/api/project/x/sessions?provider=markdown" }), res, params: [SLUG] });
  assert.equal(JSON.parse(res.body).sessions.length, 1);

  const sem = fakeRes();
  await apiProjectSessions({ req: fakeReq({ url: "/api/project/x/sessions?provider=codex" }), res: sem, params: [SLUG] });
  assert.equal(JSON.parse(sem.body).sessions.length, 0);

  const busca = fakeRes();
  await apiProjectSessions({ req: fakeReq({ url: "/api/project/x/sessions?q=importada" }), res: busca, params: [SLUG] });
  assert.equal(JSON.parse(busca.body).sessions.length, 1);
});

test("API de sessões - projeto inexistente e slug inválido devolvem erro claro", async () => {
  const inexistente = fakeRes();
  await apiProjectSessions({ req: fakeReq(), res: inexistente, params: ["nao-existe"] });
  assert.equal(inexistente.status, 404);

  const invalido = fakeRes();
  await apiProjectSessions({ req: fakeReq(), res: invalido, params: ["../etc"] });
  assert.equal(invalido.status, 400);
});

test("API de sessões - varredura e vínculo são restritos ao loopback", async () => {
  const scanRemoto = fakeRes();
  await apiProjectSessionsScan({ req: fakeReq({ local: false }), res: scanRemoto, params: [SLUG] });
  assert.equal(scanRemoto.status, 403);

  const vinculoRemoto = fakeRes();
  await apiProjectSessionLink({
    req: fakeReq({ local: false, body: { projectId: SLUG, evidence: "sessao:x" } }),
    res: vinculoRemoto,
    params: [SLUG, "abc"],
  });
  assert.equal(vinculoRemoto.status, 403);
});

test("API de sessões - o vínculo exige evidência explícita", async () => {
  const semEvidencia = fakeRes();
  await apiProjectSessionLink({
    req: fakeReq({ body: { projectId: SLUG, evidence: "" } }),
    res: semEvidencia,
    params: [SLUG, "qualquer"],
  });
  assert.equal(semEvidencia.status, 400);
  assert.match(JSON.parse(semEvidencia.body).error, /evidência/i);
});

test("API de sessões - a rota de detalhe devolve 404 para sessão desconhecida", async () => {
  const res = fakeRes();
  await apiProjectSession({ req: fakeReq(), res, params: [SLUG, "nao-existe"] });
  assert.equal(res.status, 404);
});

test("API de sessões - as rotas são registradas e seguem o padrão do repositório", () => {
  assert.equal(canonicalSessionRoutes.length, 4);
  for (const route of canonicalSessionRoutes) {
    assert.ok(route.method && route.path && route.handler);
    assert.ok(route.path instanceof RegExp);
  }
  const source = fs.readFileSync(path.join(__dirname, "..", "ui", "server", "routes", "canonical-sessions.routes.js"), "utf8");
  assert.doesNotMatch(source, /[\u{1F300}-\u{1F9FF}]/u, "sem emojis");
  assert.ok(source.split("\n").length < 300, "arquivo abaixo de 300 linhas");
});
