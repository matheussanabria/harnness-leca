// @ts-check
const os = require("os");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const test = require("node:test");
const assert = require("node:assert/strict");
const { removeDir } = require("./helpers/temp-dir");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-workflow-http-"));
process.env.HARNESS_ROOT = TMP_ROOT;
const { closeStore } = require("../ui/server/services/events/event-store");
test.after(() => {
  closeStore(SLUG);
  removeDir(TMP_ROOT);
});

const SLUG = "projeto-teste";
const LANE = "em-desenvolvimento";

function seedProject() {
  const projectDir = path.join(TMP_ROOT, "projects", SLUG);
  const dir = path.join(projectDir, ".agents", "skills", "bdd-scenarios");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "SKILL.md"), `---\nname: bdd-scenarios\ndescription: Cenarios BDD\n---\n\n# bdd-scenarios\n`);
  return projectDir;
}

seedProject();

const {
  apiOrchestrationWorkflows,
  apiOrchestrationWorkflow,
  apiProjectWorkflowPlan,
  apiProjectWorkflowRun,
} = require("../ui/server/controllers/orchestration-workflows.controller");
const {
  apiOrchestrationWorkflowRuns,
  apiOrchestrationWorkflowRunDetail,
  apiOrchestrationWorkflowRunAdvance,
  apiOrchestrationWorkflowRunCancel,
} = require("../ui/server/controllers/orchestration-workflow-runs.controller");
const { orchestrationRoutes } = require("../ui/server/routes/orchestration.routes");

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

function fakeReqRaw(text) {
  const req = Readable.from([text]);
  // @ts-ignore
  req.socket = { remoteAddress: "127.0.0.1" };
  // @ts-ignore
  req.headers = {};
  return req;
}

function json(res) {
  return JSON.parse(res.body);
}

test("workflow-http: catálogo, plano e erros de entrada", () => {
  const list = fakeRes();
  apiOrchestrationWorkflows({ res: list });
  assert.equal(list.status, 200);
  assert.equal(json(list).workflows.length, 2);

  const detail = fakeRes();
  apiOrchestrationWorkflow({ res: detail, params: ["nao-existe"] });
  assert.equal(detail.status, 404);

  const planRes = fakeRes();
  apiProjectWorkflowPlan({ res: planRes, params: [SLUG, "feature-delivery"], url: new URL(`http://127.0.0.1/api?laneId=${LANE}`) });
  assert.equal(planRes.status, 200);
  assert.equal(json(planRes).laneId, LANE);

  const badProject = fakeRes();
  apiProjectWorkflowPlan({ res: badProject, params: ["nao-existe", "feature-delivery"], url: new URL("http://127.0.0.1/api") });
  assert.equal(badProject.status, 404);

  const badLane = fakeRes();
  apiProjectWorkflowPlan({ res: badLane, params: [SLUG, "feature-delivery"], url: new URL("http://127.0.0.1/api?laneId=nada") });
  assert.equal(badLane.status, 400);

  const missing = fakeRes();
  apiOrchestrationWorkflowRunDetail({ res: missing, params: ["wf-inexistente"] });
  assert.equal(missing.status, 404);
});

test("workflow-http: início, avanço e cancelamento só no loopback", async () => {
  const remote = fakeRes();
  await apiProjectWorkflowRun({ req: fakeReq({ local: false, body: {} }), res: remote, params: [SLUG, "hotfix"] });
  assert.equal(remote.status, 403);

  const badJson = fakeRes();
  await apiProjectWorkflowRun({ req: fakeReqRaw("{nao-e-json"), res: badJson, params: [SLUG, "hotfix"] });
  assert.equal(badJson.status, 400);

  const badProjectRun = fakeRes();
  await apiProjectWorkflowRun({ req: fakeReq({ local: true, body: {} }), res: badProjectRun, params: ["nao-existe", "hotfix"] });
  assert.equal(badProjectRun.status, 404);

  const dryRes = fakeRes();
  await apiProjectWorkflowRun({ req: fakeReq({ local: true, body: { dryRun: true } }), res: dryRes, params: [SLUG, "hotfix"] });
  assert.equal(dryRes.status, 200);
  assert.equal(json(dryRes).dryRun, true);

  const startRes = fakeRes();
  await apiProjectWorkflowRun({ req: fakeReq({ local: true, body: { actor: "http" } }), res: startRes, params: [SLUG, "hotfix"] });
  assert.equal(startRes.status, 200);
  const executionId = json(startRes).run.executionId;

  const runsRes = fakeRes();
  apiOrchestrationWorkflowRuns({ res: runsRes, url: new URL(`http://127.0.0.1/api?slug=${SLUG}`) });
  assert.equal(runsRes.status, 200);
  assert.equal(json(runsRes).runs.some((run) => run.executionId === executionId), true);

  const detailRes = fakeRes();
  apiOrchestrationWorkflowRunDetail({ res: detailRes, params: [executionId] });
  assert.equal(detailRes.status, 200);

  const remoteAdvance = fakeRes();
  await apiOrchestrationWorkflowRunAdvance({ req: fakeReq({ local: false, body: {} }), res: remoteAdvance, params: [executionId] });
  assert.equal(remoteAdvance.status, 403);

  const advanceRes = fakeRes();
  await apiOrchestrationWorkflowRunAdvance({ req: fakeReq({ local: true, body: { status: "completed" } }), res: advanceRes, params: [executionId] });
  assert.equal(advanceRes.status, 200);
  assert.equal(json(advanceRes).run.totals.completed, 1);

  const remoteCancel = fakeRes();
  await apiOrchestrationWorkflowRunCancel({ req: fakeReq({ local: false, body: {} }), res: remoteCancel, params: [executionId] });
  assert.equal(remoteCancel.status, 403);

  const cancelRes = fakeRes();
  await apiOrchestrationWorkflowRunCancel({ req: fakeReq({ local: true, body: { reason: "teste" } }), res: cancelRes, params: [executionId] });
  assert.equal(cancelRes.status, 200);
  assert.equal(json(cancelRes).run.status, "cancelled");

  const advanceMissing = fakeRes();
  await apiOrchestrationWorkflowRunAdvance({ req: fakeReq({ local: true, body: {} }), res: advanceMissing, params: ["wf-inexistente"] });
  assert.equal(advanceMissing.status, 404);
});

test("workflow-routes: rotas registradas, sem emojis e abaixo de 300 linhas", () => {
  const matches = (route, path) => (typeof route.path === "string" ? route.path === path : route.path.test(path));
  const find = (method, path) => orchestrationRoutes.find((route) => route.method === method && matches(route, path));
  assert.equal(find("GET", "/api/orchestration/workflows")?.handler?.name, "apiOrchestrationWorkflows");
  assert.equal(find("GET", "/api/orchestration/workflows/hotfix")?.handler?.name, "apiOrchestrationWorkflow");
  assert.equal(find("GET", "/api/orchestration/workflow-runs")?.handler?.name, "apiOrchestrationWorkflowRuns");
  assert.equal(find("GET", "/api/orchestration/workflow-runs/wf-1")?.handler?.name, "apiOrchestrationWorkflowRunDetail");
  assert.equal(find("POST", "/api/orchestration/workflow-runs/wf-1/advance")?.handler?.name, "apiOrchestrationWorkflowRunAdvance");
  assert.equal(find("POST", "/api/orchestration/workflow-runs/wf-1/cancel")?.handler?.name, "apiOrchestrationWorkflowRunCancel");
  assert.equal(find("GET", "/api/project/demo/workflow-plan/hotfix")?.handler?.name, "apiProjectWorkflowPlan");
  assert.equal(find("POST", "/api/project/demo/workflows/hotfix/runs")?.handler?.name, "apiProjectWorkflowRun");

  const router = fs.readFileSync(path.join(__dirname, "..", "ui/server/routes/index.js"), "utf8");
  assert.match(router, /orchestrationRoutes/);

  const files = [
    "ui/server/services/orchestration/workflow-definitions.js",
    "ui/server/services/orchestration/workflow-plan.service.js",
    "ui/server/services/orchestration/workflow-runner.service.js",
    "ui/server/controllers/orchestration-workflows.controller.js",
    "ui/server/controllers/orchestration-workflow-runs.controller.js",
    "ui/server/routes/orchestration.routes.js",
    "tests/workflow-runner.test.js",
    "tests/workflow-http.test.js",
    "ui/server/router.js",
  ];
  for (const file of files) {
    const text = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.ok(text.split(/\r?\n/).length < 300, `${file} passou de 300 linhas`);
    assert.equal(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text), false, `${file} contém emoji`);
  }
});
