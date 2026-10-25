// @ts-check
const os = require("os");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { removeDir } = require("./helpers/temp-dir");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-deploy-timeline-"));
process.env.HARNESS_ROOT = TMP_ROOT;
test.after(() => removeDir(TMP_ROOT));

const GLOBAL = path.join(TMP_ROOT, "global");

function writeGlobal(name, content) {
  fs.mkdirSync(GLOBAL, { recursive: true });
  fs.writeFileSync(path.join(GLOBAL, name), content, "utf8");
}

writeGlobal("deploy-history.json", JSON.stringify([
  {
    id: "w1",
    timestamp: "2026-10-21T10:00:00.000Z",
    projectId: "web",
    projectName: "Web",
    envId: "prod",
    envName: "Producao",
    webhookMasked: "http://host/api?token=abcd...3456",
    method: "POST",
    status: 200,
    statusText: "OK",
    ok: true,
    durationMs: 120,
    snippet: "ok",
  },
]));

writeGlobal("deploy-pipeline-runs.jsonl", [
  JSON.stringify({
    id: "run-1",
    pipelineId: "web-prod",
    pipelineName: "Deploy Web",
    projectId: "web",
    envId: "prod",
    status: "failed",
    error: "Estagio 'deploy' falhou.",
    startedAt: "2026-10-21T11:00:00.000Z",
    finishedAt: "2026-10-21T11:00:05.000Z",
    stages: [
      { id: "build", name: "Build", type: "command", status: "completed", exitCode: 0, durationMs: 900, output: "build ok" },
      { id: "deploy", name: "Deploy", type: "webhook", status: "failed", httpStatus: 502, durationMs: 120, output: "falha no webhook", endpoint: "http://host/api?token=abcd...3456" },
    ],
  }),
].join("\n") + "\n");

writeGlobal("deploy-health-runs.jsonl", [
  JSON.stringify({
    checkId: "http-web",
    projectId: "web",
    envId: "prod",
    type: "http",
    state: "saudavel",
    ok: true,
    latencyMs: 42,
    detail: "HTTP 200",
    at: "2026-10-21T12:00:00.000Z",
  }),
].join("\n") + "\n");

const {
  buildTimeline,
  normalizeWebhook,
  normalizePipeline,
  normalizeHealth,
  KINDS,
} = require("../ui/server/services/deploy/deploy-timeline.service");
const { buildDeployLogs } = require("../ui/server/services/deploy/deploy-logs.service");
const { apiDeployTimeline, apiDeployLogs } = require("../ui/server/controllers/deploy-timeline.controller");

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

test("deploy-timeline: normalizacao das tres fontes", () => {
  assert.deepEqual([...KINDS], ["webhook", "pipeline", "saude", "acao"]);

  const webhook = normalizeWebhook({ projectId: "web", envId: "prod", ok: true, status: 200, durationMs: 10, webhookMasked: "http://host/api?token=abcd...3456" });
  assert.equal(webhook.kind, "webhook");
  assert.equal(webhook.status, "sucesso");
  assert.equal(webhook.detail.includes("abcd...3456"), true);

  const pipeline = normalizePipeline({ pipelineId: "p", status: "failed", stages: [{ id: "deploy", status: "failed", durationMs: 5 }] });
  assert.equal(pipeline.kind, "pipeline");
  assert.equal(pipeline.status, "falha");
  assert.match(pipeline.summary, /falha em deploy/);

  const health = normalizeHealth({ checkId: "c", ok: true, state: "saudavel", latencyMs: 7 });
  assert.equal(health.kind, "saude");
  assert.equal(health.status, "sucesso");
});

test("deploy-timeline: linha do tempo reune as fontes e ordena por instante", () => {
  const timeline = buildTimeline({});
  assert.equal(timeline.ok, true);
  assert.equal(timeline.entries.length, 3);
  assert.deepEqual(timeline.totals, { webhook: 1, pipeline: 1, saude: 1, acao: 0, total: 3, returned: 3 });
  const instantes = timeline.entries.map((entry) => entry.at);
  assert.deepEqual(instantes, [...instantes].sort().reverse());
});

test("deploy-timeline: filtros por projeto, ambiente, tipo e estado", () => {
  assert.equal(buildTimeline({ projectId: "web" }).entries.length, 3);
  assert.equal(buildTimeline({ projectId: "outro" }).entries.length, 0);
  assert.equal(buildTimeline({ envId: "prod" }).entries.length, 3);
  assert.equal(buildTimeline({ kind: "pipeline" }).entries.length, 1);
  assert.equal(buildTimeline({ status: "falha" }).entries.length, 1);
  assert.equal(buildTimeline({ limit: 2 }).entries.length, 2);
});

test("deploy-timeline: historico corrompido vira aviso e nao erro", () => {
  writeGlobal("deploy-history.json", "{quebrado");
  const timeline = buildTimeline({});
  assert.equal(timeline.ok, true);
  assert.equal(timeline.warnings.length >= 1, true);
  writeGlobal("deploy-history.json", "[]");
});

test("deploy-timeline: logs por execucao, na ordem dos estagios", () => {
  const logs = buildDeployLogs({ executionId: "run-1" });
  assert.equal(logs.ok, true);
  assert.equal(logs.executions.length, 1);
  const execution = logs.executions[0];
  assert.equal(execution.lines.length, 2);
  assert.equal(execution.lines[0].id, "build");
  assert.equal(execution.lines[0].output, "build ok");
  assert.equal(execution.lines[1].status, "failed");
  assert.equal(execution.lines[1].httpStatus, 502);

  const byProject = buildDeployLogs({ projectId: "web" });
  assert.equal(byProject.executions.length, 1);
  assert.equal(buildDeployLogs({ projectId: "outro" }).executions.length, 0);
});

test("deploy-timeline: endpoints, limite invalido e tipo desconhecido", () => {
  const timeline = fakeRes();
  apiDeployTimeline({ res: timeline, url: new URL("http://127.0.0.1/api?limit=10") });
  assert.equal(timeline.status, 200);
  assert.ok(Array.isArray(json(timeline).entries));

  const badLimit = fakeRes();
  apiDeployTimeline({ res: badLimit, url: new URL("http://127.0.0.1/api?limit=zero") });
  assert.equal(badLimit.status, 400);

  const badKind = fakeRes();
  apiDeployTimeline({ res: badKind, url: new URL("http://127.0.0.1/api?kind=inventado") });
  assert.equal(badKind.status, 400);

  const logs = fakeRes();
  apiDeployLogs({ res: logs, url: new URL("http://127.0.0.1/api?executionId=run-1") });
  assert.equal(logs.status, 200);
  assert.ok(Array.isArray(json(logs).executions));
});

test("deploy-timeline: estrutura sem emojis e dentro do teto de linhas", () => {
  const files = [
    "ui/server/services/deploy/deploy-timeline.service.js",
    "ui/server/services/deploy/deploy-logs.service.js",
    "ui/server/controllers/deploy-timeline.controller.js",
    "ui/public/js/deploy/deploy-timeline.js",
    "ui/public/css/deploy/07-historico-logs-deploy.css",
    "tests/deploy-timeline.test.js",
  ];
  for (const file of files) {
    const text = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.ok(text.split(/\r?\n/).length < 300, `${file} passou de 300 linhas`);
    assert.equal(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text), false, `${file} contém emoji`);
  }
});
