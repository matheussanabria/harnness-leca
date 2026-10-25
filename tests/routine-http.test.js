// @ts-check
const os = require("os");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const test = require("node:test");
const assert = require("node:assert/strict");
const { removeDir } = require("./helpers/temp-dir");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-routine-http-"));
process.env.HARNESS_ROOT = TMP_ROOT;
const { closeStore } = require("../ui/server/services/events/event-store");
test.after(() => {
  closeStore(SLUG);
  removeDir(TMP_ROOT);
});

const SLUG = "projeto-teste";

function seedProject() {
  const projectDir = path.join(TMP_ROOT, "projects", SLUG);
  const dir = path.join(projectDir, ".agents", "skills", "bdd-scenarios");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "SKILL.md"), `---\nname: bdd-scenarios\ndescription: Cenarios BDD\n---\n\n# bdd-scenarios\n`);
  return projectDir;
}

seedProject();

const {
  apiOrchestrationRoutines,
  apiProjectRoutines,
  apiProjectRoutineRun,
  apiProjectWorkflowHistory,
} = require("../ui/server/controllers/orchestration-routines.controller");
const {
  apiOrchestrationApprovals,
  apiOrchestrationWorkflowRunApprove,
} = require("../ui/server/controllers/orchestration-approvals.controller");
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

test("routine-http: catálogo e listagem por projeto", () => {
  const list = fakeRes();
  apiOrchestrationRoutines({ res: list });
  assert.equal(list.status, 200);
  assert.equal(json(list).routines.length, 3);

  const project = fakeRes();
  apiProjectRoutines({ res: project, params: [SLUG], url: new URL("http://127.0.0.1/api") });
  assert.equal(project.status, 200);
  assert.equal(json(project).totals.total, 3);

  const missing = fakeRes();
  apiProjectRoutines({ res: missing, params: ["nao-existe"], url: new URL("http://127.0.0.1/api") });
  assert.equal(missing.status, 404);
});

test("routine-http: execução de rotina só no loopback, com idempotência", async () => {
  const remote = fakeRes();
  await apiProjectRoutineRun({ req: fakeReq({ local: false, body: {} }), res: remote, params: [SLUG, "rotina-hotfix"] });
  assert.equal(remote.status, 403);

  const badJson = fakeRes();
  await apiProjectRoutineRun({ req: fakeReqRaw("{nao-e-json"), res: badJson, params: [SLUG, "rotina-hotfix"] });
  assert.equal(badJson.status, 400);

  const badProject = fakeRes();
  await apiProjectRoutineRun({ req: fakeReq({ local: true, body: {} }), res: badProject, params: ["nao-existe", "rotina-hotfix"] });
  assert.equal(badProject.status, 404);

  const badRoutine = fakeRes();
  await apiProjectRoutineRun({ req: fakeReq({ local: true, body: {} }), res: badRoutine, params: [SLUG, "rotina-inexistente"] });
  assert.equal(badRoutine.status, 404);

  const first = fakeRes();
  await apiProjectRoutineRun({ req: fakeReq({ local: true, body: { actor: "http" } }), res: first, params: [SLUG, "rotina-feature-delivery"] });
  assert.equal(first.status, 200);
  const executionId = json(first).run.executionId;

  const second = fakeRes();
  await apiProjectRoutineRun({ req: fakeReq({ local: true, body: { actor: "http" } }), res: second, params: [SLUG, "rotina-feature-delivery"] });
  assert.equal(second.status, 200);
  assert.equal(json(second).idempotent, true);
  assert.equal(json(second).run.executionId, executionId);
});

test("routine-http: fila de aprovações e decisão", async () => {
  const queue = fakeRes();
  apiOrchestrationApprovals({ res: queue, url: new URL(`http://127.0.0.1/api?slug=${SLUG}`) });
  assert.equal(queue.status, 200);
  assert.ok(Array.isArray(json(queue).approvals));

  const remote = fakeRes();
  await apiOrchestrationWorkflowRunApprove({ req: fakeReq({ local: false, body: { decision: "approved" } }), res: remote, params: ["wf-1"] });
  assert.equal(remote.status, 403);

  const badJson = fakeRes();
  await apiOrchestrationWorkflowRunApprove({ req: fakeReqRaw("{quebrado"), res: badJson, params: ["wf-1"] });
  assert.equal(badJson.status, 400);

  const missing = fakeRes();
  await apiOrchestrationWorkflowRunApprove({ req: fakeReq({ local: true, body: { decision: "approved" } }), res: missing, params: ["wf-inexistente"] });
  assert.equal(missing.status, 404);
});

test("routine-http: histórico do projeto", () => {
  const history = fakeRes();
  apiProjectWorkflowHistory({ res: history, params: [SLUG], url: new URL("http://127.0.0.1/api?limit=10") });
  assert.equal(history.status, 200);
  assert.ok(Array.isArray(json(history).entries));

  const missing = fakeRes();
  apiProjectWorkflowHistory({ res: missing, params: ["nao-existe"], url: new URL("http://127.0.0.1/api") });
  assert.equal(missing.status, 404);
});

test("routine-routes: rotas registradas, sem emojis e abaixo de 300 linhas", () => {
  const matches = (route, target) => (typeof route.path === "string" ? route.path === target : route.path.test(target));
  const find = (method, target) => orchestrationRoutes.find((route) => route.method === method && matches(route, target));
  assert.equal(find("GET", "/api/orchestration/routines")?.handler?.name, "apiOrchestrationRoutines");
  assert.equal(find("GET", "/api/project/demo/routines")?.handler?.name, "apiProjectRoutines");
  assert.equal(find("POST", "/api/project/demo/routines/rotina-hotfix/run")?.handler?.name, "apiProjectRoutineRun");
  assert.equal(find("GET", "/api/project/demo/workflow-history")?.handler?.name, "apiProjectWorkflowHistory");
  assert.equal(find("GET", "/api/orchestration/approvals")?.handler?.name, "apiOrchestrationApprovals");
  assert.equal(find("POST", "/api/orchestration/workflow-runs/wf-1/approve")?.handler?.name, "apiOrchestrationWorkflowRunApprove");

  const files = [
    "ui/server/services/orchestration/routine-definitions.js",
    "ui/server/services/orchestration/routine-runner.service.js",
    "ui/server/services/orchestration/workflow-approval.service.js",
    "ui/server/services/orchestration/workflow-history.service.js",
    "ui/server/services/orchestration/workflow-runner.service.js",
    "ui/server/services/orchestration/workflow-run-store.js",
    "ui/server/controllers/orchestration-routines.controller.js",
    "ui/server/controllers/orchestration-approvals.controller.js",
    "ui/server/routes/orchestration.routes.js",
    "tests/routine-runner.test.js",
    "tests/routine-http.test.js",
    "ui/server/router.js",
  ];
  for (const file of files) {
    const text = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.ok(text.split(/\r?\n/).length < 300, `${file} passou de 300 linhas`);
    assert.equal(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text), false, `${file} contém emoji`);
  }
});
