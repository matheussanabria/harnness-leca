// @ts-check
const os = require("os");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { removeDir } = require("./helpers/temp-dir");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-deploy-status-"));
process.env.HARNESS_ROOT = TMP_ROOT;
test.after(() => removeDir(TMP_ROOT));

const GLOBAL = path.join(TMP_ROOT, "global");

function seed() {
  fs.mkdirSync(GLOBAL, { recursive: true });
  fs.writeFileSync(path.join(GLOBAL, "deploy-health.json"), JSON.stringify({
    _v: 1,
    checks: [
      { id: "web-prod", projectId: "web", envId: "prod", type: "http", target: "http://127.0.0.1/health", expectedStatus: 200, timeoutMs: 5000, description: "", updatedAt: "" },
      { id: "web-hom", projectId: "web", envId: "hom", type: "http", target: "http://127.0.0.1/health", expectedStatus: 200, timeoutMs: 5000, description: "", updatedAt: "" },
    ],
  }, null, 2));

  fs.writeFileSync(path.join(GLOBAL, "deploy-health-runs.jsonl"), [
    JSON.stringify({
      checkId: "web-prod",
      projectId: "web",
      envId: "prod",
      type: "http",
      state: "saudavel",
      ok: true,
      latencyMs: 42,
      detail: "HTTP 200",
      at: "2026-10-21T17:59:00.000Z",
    }),
  ].join("\n") + "\n");

  fs.writeFileSync(path.join(GLOBAL, "deploy-pipeline-runs.jsonl"), [
    JSON.stringify({
      id: "run-9",
      pipelineId: "web-prod",
      pipelineName: "Deploy Web",
      projectId: "web",
      envId: "prod",
      status: "completed",
      startedAt: "2026-10-21T17:30:00.000Z",
      finishedAt: "2026-10-21T17:31:00.000Z",
      stages: [{ id: "build", status: "completed", durationMs: 1000, output: "" }],
    }),
  ].join("\n") + "\n");

  fs.writeFileSync(path.join(GLOBAL, "deploy-history.json"), JSON.stringify([
    {
      id: "w9",
      timestamp: "2026-10-21T17:00:00.000Z",
      projectId: "web",
      envId: "prod",
      method: "POST",
      status: 200,
      statusText: "OK",
      ok: true,
      durationMs: 90,
      webhookMasked: "http://host/api?token=abcd...3456",
    },
  ]));
}

seed();

const { buildDeployStatus } = require("../ui/server/services/deploy/deploy-status.service");
const { apiDeployStatus } = require("../ui/server/controllers/deploy-status.controller");

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

function json(res) {
  return JSON.parse(res.body);
}

test("deploy-status: resumo por ambiente com saude, deploy e pipeline", () => {
  const status = buildDeployStatus();
  assert.equal(status.ok, true);
  const prod = status.environments.find((env) => env.envId === "prod");
  assert.equal(prod.state, "saudavel");
  assert.equal(prod.latencyMs, 42);
  assert.equal(prod.lastDeployStatus, "sucesso");
  assert.equal(prod.lastPipelineStatus, "sucesso");
  assert.equal(prod.lastCheckAt, "2026-10-21T17:59:00.000Z");
  assert.equal(status.totals.healthy, 1);
});

test("deploy-status: ambiente sem medicao fica desconhecido", () => {
  const status = buildDeployStatus();
  const hom = status.environments.find((env) => env.envId === "hom");
  assert.equal(hom.state, "desconhecido");
  assert.equal(hom.lastCheckAt, "");
  assert.equal(status.totals.unknown, 1);
});

test("deploy-status: contrato da API com totais e avisos", () => {
  const res = fakeRes();
  apiDeployStatus({ res });
  assert.equal(res.status, 200);
  const body = json(res);
  assert.equal(body.ok, true);
  assert.ok(body.generatedAt);
  assert.ok(body.totals);
  assert.ok(Array.isArray(body.environments));
  assert.ok(Array.isArray(body.warnings));
});

test("deploy-status: as duas superficies consomem o mesmo contrato", () => {
  const panel = fs.readFileSync(path.join(__dirname, "..", "ui/public/js/deploy/deploy-status.js"), "utf8");
  const office = fs.readFileSync(path.join(__dirname, "..", "ui/public/js/office/office-datacenter-status.js"), "utf8");
  assert.ok(panel.includes("/api/deploy/status"));
  assert.ok(office.includes("/api/deploy/status"));

  const drawer = fs.readFileSync(path.join(__dirname, "..", "ui/public/js/office/office-drawer-views.js"), "utf8");
  assert.equal(drawer.includes("Easypanel VPS Conectado"), false, "a estacao ainda afirma estado fixo");
  assert.ok(drawer.includes("officeDatacenterStatus"));
});

test("deploy-status: estrutura sem emojis e dentro do teto de linhas", () => {
  const files = [
    "ui/server/services/deploy/deploy-status.service.js",
    "ui/server/controllers/deploy-status.controller.js",
    "ui/public/js/deploy/deploy-status.js",
    "ui/public/js/office/office-datacenter-status.js",
    "ui/public/css/deploy/09-resumo-operacional.css",
    "ui/public/css/office/18-datacenter-status.css",
    "tests/deploy-status.test.js",
  ];
  for (const file of files) {
    const text = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.ok(text.split(/\r?\n/).length < 300, `${file} passou de 300 linhas`);
    assert.equal(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text), false, `${file} contém emoji`);
  }
});
