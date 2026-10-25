// @ts-check
const os = require("os");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const test = require("node:test");
const assert = require("node:assert/strict");
const { removeDir } = require("./helpers/temp-dir");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-deploy-pipeline-"));
process.env.HARNESS_ROOT = TMP_ROOT;
test.after(() => removeDir(TMP_ROOT));

const {
  normalizePipeline,
  normalizeStage,
  pipelineWarnings,
  PROVIDERS,
  STAGE_TYPES,
} = require("../ui/server/services/deploy/pipeline-definitions");
const { readPipelines, writePipelines, readPipelineRuns } = require("../ui/server/services/deploy/pipeline-store");
const { listPipelines, runPipeline } = require("../ui/server/services/deploy/pipeline-runner.service");
const {
  apiDeployPipelines,
  apiDeployPipelinesSave,
  apiDeployPipelineRun,
  apiDeployPipelineRuns,
} = require("../ui/server/controllers/deploy-pipeline.controller");

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

function seedDeployConfig() {
  const dir = path.join(TMP_ROOT, "global");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "deployments.json"), JSON.stringify({
    easypanelHost: "http://127.0.0.1:9",
    defaultTimeoutMs: 15000,
    projects: [
      {
        id: "web",
        name: "Web",
        description: "Projeto de teste",
        environments: [
          { id: "hom", name: "Homologacao", type: "staging", webhookUrl: "http://127.0.0.1:9/deploy?token=abcdef123456", method: "POST", requireConfirm: false },
          { id: "prod", name: "Producao", type: "production", webhookUrl: "", method: "POST", requireConfirm: true },
        ],
      },
    ],
  }, null, 2));
}

seedDeployConfig();

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

const PIPELINE = {
  id: "web-hom",
  name: "Deploy Web Homologacao",
  slug: "saude-dispensacao",
  projectId: "web",
  envId: "hom",
  provider: "script",
  branch: "main",
  requireConfirm: false,
  stages: [
    { id: "build", name: "Build", type: "command", command: process.execPath, args: ["-e", "process.exit(0)"] },
    { id: "deploy", name: "Deploy", type: "webhook", timeoutMs: 1500 },
  ],
};

test("deploy-pipeline: definicao canonica e validacao", () => {
  assert.ok(PROVIDERS.includes("easypanel"));
  assert.ok(STAGE_TYPES.includes("command"));
  const pipeline = normalizePipeline(PIPELINE);
  assert.equal(pipeline.id, "web-hom");
  assert.equal(pipeline.stages.length, 2);
  assert.equal(pipeline.stages[0].type, "command");
  assert.equal(pipeline.requireConfirm, false);

  assert.throws(() => normalizePipeline({}), /sem identificador/);
  assert.throws(() => normalizePipeline({ id: "x", provider: "desconhecido" }), /Provedor de pipeline invalido/);
  assert.throws(() => normalizePipeline({ id: "x", stages: [{ id: "s", type: "command" }] }), /exige o comando/);
  assert.throws(() => normalizeStage({ type: "desconhecido" }), /Tipo de estagio invalido/);

  const warnings = pipelineWarnings(normalizePipeline({
    id: "y",
    stages: [{ id: "s", name: "S", type: "webhook" }],
  }));
  assert.ok(warnings.length >= 1);
});

test("deploy-pipeline: manifesto tolerante e escrita atomica", () => {
  const empty = readPipelines();
  assert.deepEqual(empty.pipelines, []);
  assert.deepEqual(empty.warnings, []);

  assert.equal(writePipelines([normalizePipeline(PIPELINE)]), true);
  const stored = readPipelines();
  assert.equal(stored.pipelines.length, 1);
  assert.equal(stored.pipelines[0].id, "web-hom");

  const file = path.join(TMP_ROOT, "global", "deploy-pipelines.json");
  fs.writeFileSync(file, "{quebrado", "utf8");
  const invalid = readPipelines();
  assert.deepEqual(invalid.pipelines, []);
  assert.equal(invalid.warnings.length, 1);
  fs.rmSync(file);
});

test("deploy-pipeline: execucao registra resultado real por estagio", async () => {
  writePipelines([normalizePipeline(PIPELINE)]);
  const result = await runPipeline({ pipelineId: "web-hom", actor: "teste" });
  assert.equal(result.run.stages.length, 2);
  assert.equal(result.run.stages[0].id, "build");
  assert.equal(result.run.stages[0].exitCode, 0);
  assert.equal(result.run.stages[0].status, "completed");
  assert.equal(result.run.stages[1].id, "deploy");
  assert.equal(result.run.stages[1].status, "failed");
  assert.equal(result.run.status, "failed");
  assert.match(result.run.stages[1].endpoint, /token=abcd\.\.\.3456/);
  assert.equal(result.run.stages[1].endpoint.includes("abcdef123456"), false);

  const history = readPipelineRuns({ limit: 10 });
  assert.equal(history.runs.length, 1);
  assert.equal(history.runs[0].pipelineId, "web-hom");
});

test("deploy-pipeline: comando com falha interrompe o pipeline", async () => {
  writePipelines([normalizePipeline({
    ...PIPELINE,
    id: "falha",
    stages: [
      { id: "build", name: "Build", type: "command", command: process.execPath, args: ["-e", "process.exit(3)"] },
    { id: "deploy", name: "Deploy", type: "webhook", timeoutMs: 1500 },
    ],
  })]);
  const result = await runPipeline({ pipelineId: "falha" });
  assert.equal(result.run.status, "failed");
  assert.equal(result.run.stages.length, 1);
  assert.equal(result.run.stages[0].exitCode, 3);
});

test("deploy-pipeline: pipeline protegido exige confirmacao", async () => {
  writePipelines([normalizePipeline({ ...PIPELINE, id: "prod", requireConfirm: true })]);
  await assert.rejects(() => runPipeline({ pipelineId: "prod" }), /exige confirmacao/);
  const confirmed = await runPipeline({ pipelineId: "prod", confirm: true });
  assert.ok(confirmed.run.id);
});

test("deploy-pipeline: pipeline inexistente e recusado", async () => {
  await assert.rejects(() => runPipeline({ pipelineId: "nao-existe" }), /Pipeline nao encontrado/);
});

test("deploy-pipeline: listagem inclui avisos e ultimo estado", () => {
  writePipelines([normalizePipeline({ ...PIPELINE, id: "listagem" })]);
  const listed = listPipelines({});
  assert.equal(listed.ok, true);
  const item = listed.pipelines.find((pipeline) => pipeline.id === "listagem");
  assert.ok(item);
  assert.ok(Array.isArray(item.warnings));
});

test("deploy-pipeline: endpoints, loopback e erros", async () => {
  const list = fakeRes();
  apiDeployPipelines({ res: list, url: new URL("http://127.0.0.1/api") });
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(json(list).pipelines));

  const remote = fakeRes();
  await apiDeployPipelinesSave({ req: fakeReq({ local: false, body: { pipelines: [PIPELINE] } }), res: remote });
  assert.equal(remote.status, 403);

  const invalid = fakeRes();
  await apiDeployPipelinesSave({ req: fakeReq({ local: true, body: { pipelines: [{ id: "" }] } }), res: invalid });
  assert.equal(invalid.status, 400);

  const saved = fakeRes();
  await apiDeployPipelinesSave({ req: fakeReq({ local: true, body: { pipelines: [PIPELINE] } }), res: saved });
  assert.equal(saved.status, 200);
  assert.equal(json(saved).pipelines.length >= 1, true);

  const runRemote = fakeRes();
  await apiDeployPipelineRun({ req: fakeReq({ local: false, body: {} }), res: runRemote, params: ["web-hom"] });
  assert.equal(runRemote.status, 403);

  const runMissing = fakeRes();
  await apiDeployPipelineRun({ req: fakeReq({ local: true, body: {} }), res: runMissing, params: ["nao-existe"] });
  assert.equal(runMissing.status, 404);

  const runs = fakeRes();
  apiDeployPipelineRuns({ res: runs, url: new URL("http://127.0.0.1/api?pipelineId=web-hom") });
  assert.equal(runs.status, 200);
  assert.ok(Array.isArray(json(runs).runs));
});

test("deploy-pipeline: configuracao compartilhada de deploy", () => {
  const { loadDeployConfig, saveDeployConfig, maskWebhook, findEnvironment } = require("../ui/server/services/deploy/deploy-config.service");
  const config = loadDeployConfig();
  assert.ok(Array.isArray(config.projects));
  assert.equal(findEnvironment(config, "web", "hom").env.method, "POST");
  assert.equal(findEnvironment(config, "web", "inexistente"), null);
  assert.equal(maskWebhook("http://host/api?token=abcdef123456"), "http://host/api?token=abcd...3456");
  assert.equal(maskWebhook(""), "");
  const copy = JSON.parse(JSON.stringify(config));
  copy.easypanelHost = "http://exemplo";
  assert.equal(saveDeployConfig(copy), true);
  assert.equal(loadDeployConfig().easypanelHost, "http://exemplo");
  saveDeployConfig(config);
});

test("deploy-pipeline: estrutura sem emojis e dentro do teto de linhas", () => {
  const files = [
    "ui/server/services/deploy/pipeline-definitions.js",
    "ui/server/services/deploy/pipeline-store.js",
    "ui/server/services/deploy/pipeline-runner.service.js",
    "ui/server/services/deploy/deploy-config.service.js",
    "ui/server/controllers/deploy-pipeline.controller.js",
    "ui/server/controllers/deploy.controller.js",
    "ui/public/js/deploy/deploy-pipelines.js",
    "ui/public/css/deploy/05-pipelines-deploy.css",
    "tests/deploy-pipeline.test.js",
  ];
  for (const file of files) {
    const text = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.ok(text.split(/\r?\n/).length < 300, `${file} passou de 300 linhas`);
    assert.equal(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text), false, `${file} contém emoji`);
  }
});
