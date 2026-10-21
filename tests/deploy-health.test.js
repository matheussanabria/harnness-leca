// @ts-check
const os = require("os");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { Readable } = require("stream");
const test = require("node:test");
const assert = require("node:assert/strict");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-deploy-health-"));
process.env.HARNESS_ROOT = TMP_ROOT;

function seedDeployConfig() {
  const dir = path.join(TMP_ROOT, "global");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "deployments.json"), JSON.stringify({
    easypanelHost: "",
    defaultTimeoutMs: 15000,
    projects: [
      {
        id: "web",
        name: "Web",
        description: "Projeto de teste",
        environments: [
          { id: "hom", name: "Homologacao", type: "staging", webhookUrl: "", method: "POST", requireConfirm: false },
        ],
      },
    ],
  }, null, 2));
}

seedDeployConfig();

const {
  normalizeCheck,
  classifyOutcome,
  aggregateState,
  CHECK_TYPES,
  STATES,
} = require("../ui/server/services/deploy/health-definitions");
const { readHealthChecks, writeHealthChecks, readHealthRuns } = require("../ui/server/services/deploy/health-store");
const { listHealth, runHealthCheck } = require("../ui/server/services/deploy/health-runner.service");
const {
  apiDeployHealth,
  apiDeployHealthChecksSave,
  apiDeployHealthCheckRun,
} = require("../ui/server/controllers/deploy-health.controller");

function fakeRes() {
  return {
    headersSent: false,
    writableEnded: false,
    status: 0,
    body: "",
    setHeader() {},
    writeHead(code) { this.status = code; this.headersSent = true; },
    end(body) { this.body = body; this.writableEnded = true; },
  };
}

function fakeReq({ local = true, body = null } = {}) {
  const req = Readable.from(body == null ? [] : [JSON.stringify(body)]);
  // @ts-ignore
  req.socket = { remoteAddress: local ? "127.0.0.1" : "192.168.1.50" };
  // @ts-ignore
  req.headers = {};
  return req;
}

function json(res) {
  return JSON.parse(res.body);
}

test("deploy-health: modelo, validacao e classificacao", () => {
  assert.deepEqual([...CHECK_TYPES], ["http", "command"]);
  assert.deepEqual([...STATES], ["saudavel", "degradado", "instavel", "desconhecido"]);

  const check = normalizeCheck({ id: "web-hom", projectId: "web", envId: "hom", type: "http", target: "http://127.0.0.1/health" });
  assert.equal(check.expectedStatus, 200);
  assert.equal(check.method, "GET");

  assert.throws(() => normalizeCheck({}), /sem identificador/);
  assert.throws(() => normalizeCheck({ id: "x" }), /exige projeto e ambiente/);
  assert.throws(() => normalizeCheck({ id: "x", projectId: "web", envId: "hom", type: "http" }), /exige alvo/);
  assert.throws(() => normalizeCheck({ id: "x", projectId: "web", envId: "hom", type: "http", target: "ftp://x" }), /Alvo http invalido/);
  assert.throws(() => normalizeCheck({ id: "x", projectId: "web", envId: "hom", type: "desconhecido", target: "http://x" }), /Tipo de verificacao invalido/);

  assert.equal(classifyOutcome({ ok: true }), "saudavel");
  assert.equal(classifyOutcome({ ok: true, degraded: true }), "degradado");
  assert.equal(classifyOutcome({ ok: false }), "instavel");

  assert.equal(aggregateState([]), "desconhecido");
  assert.equal(aggregateState([{ state: "saudavel" }, { state: "saudavel" }]), "saudavel");
  assert.equal(aggregateState([{ state: "saudavel" }, { state: "degradado" }]), "degradado");
  assert.equal(aggregateState([{ state: "degradado" }, { state: "instavel" }]), "instavel");
});

test("deploy-health: manifesto tolerante e medicoes recentes", () => {
  const empty = readHealthChecks();
  assert.deepEqual(empty.checks, []);
  assert.deepEqual(empty.warnings, []);

  assert.equal(writeHealthChecks([normalizeCheck({ id: "web-hom", projectId: "web", envId: "hom", type: "http", target: "http://127.0.0.1/health" })]), true);
  assert.equal(readHealthChecks().checks.length, 1);

  const file = path.join(TMP_ROOT, "global", "deploy-health.json");
  fs.writeFileSync(file, "{quebrado", "utf8");
  const invalid = readHealthChecks();
  assert.deepEqual(invalid.checks, []);
  assert.equal(invalid.warnings.length, 1);
  fs.rmSync(file);
});

test("deploy-health: verificacao http registra status e latencia reais", async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = req.url === "/ok" ? 200 : 503;
    res.end("ok");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  writeHealthChecks([
    normalizeCheck({ id: "http-ok", projectId: "web", envId: "hom", type: "http", target: `http://127.0.0.1:${port}/ok` }),
    normalizeCheck({ id: "http-fail", projectId: "web", envId: "hom", type: "http", target: `http://127.0.0.1:${port}/ruim`, expectedStatus: 200 }),
  ]);

  const ok = await runHealthCheck("http-ok");
  assert.equal(ok.state, "saudavel");
  assert.equal(ok.httpStatus, 200);
  assert.ok(ok.latencyMs >= 0);

  const degraded = await runHealthCheck("http-fail");
  assert.equal(degraded.state, "instavel");
  assert.equal(degraded.httpStatus, 503);

  const history = readHealthRuns({ limit: 10 });
  assert.equal(history.measurements.length, 2);
  server.close();
});

test("deploy-health: verificacao de comando usa o codigo de saida real", async () => {
  writeHealthChecks([
    normalizeCheck({ id: "cmd-ok", projectId: "web", envId: "hom", type: "command", target: process.execPath, args: ["-e", "process.exit(0)"] }),
    normalizeCheck({ id: "cmd-fail", projectId: "web", envId: "hom", type: "command", target: process.execPath, args: ["-e", "process.exit(2)"] }),
  ]);
  const ok = await runHealthCheck("cmd-ok");
  assert.equal(ok.state, "saudavel");
  assert.equal(ok.exitCode, 0);

  const failed = await runHealthCheck("cmd-fail");
  assert.equal(failed.state, "instavel");
  assert.equal(failed.exitCode, 2);
});

test("deploy-health: ambiente sem medicao fica desconhecido", () => {
  writeHealthChecks([
    normalizeCheck({ id: "http-nunca-medido", projectId: "web", envId: "hom", type: "http", target: "http://127.0.0.1:1/health" }),
  ]);
  const health = listHealth();
  assert.equal(health.ok, true);
  assert.equal(health.environments[0].state, "desconhecido");
  assert.equal(health.totals.measured, 0);
});

test("deploy-health: verificacao inexistente e recusada", async () => {
  await assert.rejects(() => runHealthCheck("nao-existe"), /Verificacao nao encontrada/);
});

test("deploy-health: endpoints, loopback e erros", async () => {
  const list = fakeRes();
  apiDeployHealth({ res: list });
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(json(list).checks));

  const remote = fakeRes();
  await apiDeployHealthChecksSave({ req: fakeReq({ local: false, body: { checks: [] } }), res: remote });
  assert.equal(remote.status, 403);

  const invalid = fakeRes();
  await apiDeployHealthChecksSave({
    req: fakeReq({ local: true, body: { checks: [{ id: "x", projectId: "web", envId: "hom", type: "http", target: "ftp://x" }] } }),
    res: invalid,
  });
  assert.equal(invalid.status, 400);

  const unknownEnv = fakeRes();
  await apiDeployHealthChecksSave({
    req: fakeReq({ local: true, body: { checks: [{ id: "x", projectId: "nao-existe", envId: "hom", type: "http", target: "http://127.0.0.1/health" }] } }),
    res: unknownEnv,
  });
  assert.equal(unknownEnv.status, 400);

  const saved = fakeRes();
  await apiDeployHealthChecksSave({
    req: fakeReq({ local: true, body: { checks: [{ id: "web-hom", projectId: "web", envId: "hom", type: "http", target: "http://127.0.0.1/health" }] } }),
    res: saved,
  });
  assert.equal(saved.status, 200);

  const runRemote = fakeRes();
  await apiDeployHealthCheckRun({ req: fakeReq({ local: false, body: {} }), res: runRemote, params: ["web-hom"] });
  assert.equal(runRemote.status, 403);

  const runMissing = fakeRes();
  await apiDeployHealthCheckRun({ req: fakeReq({ local: true, body: {} }), res: runMissing, params: ["nao-existe"] });
  assert.equal(runMissing.status, 404);
});

test("deploy-health: estrutura sem emojis e dentro do teto de linhas", () => {
  const files = [
    "ui/server/services/deploy/health-definitions.js",
    "ui/server/services/deploy/health-store.js",
    "ui/server/services/deploy/health-runner.service.js",
    "ui/server/controllers/deploy-health.controller.js",
    "ui/public/js/deploy/deploy-health.js",
    "ui/public/css/deploy/06-health-ambientes.css",
    "tests/deploy-health.test.js",
  ];
  for (const file of files) {
    const text = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.ok(text.split(/\r?\n/).length < 300, `${file} passou de 300 linhas`);
    assert.equal(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text), false, `${file} contém emoji`);
  }
});
