// @ts-check
const os = require("os");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const test = require("node:test");
const assert = require("node:assert/strict");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-audit-http-"));
process.env.HARNESS_ROOT = TMP_ROOT;

const SLUG = "projeto-auditoria";
const RULE_TITLE = "Validacao de dispensacao medica no historico";

function seedProject() {
  const projectDir = path.join(TMP_ROOT, "projects", SLUG);
  fs.mkdirSync(path.join(projectDir, "doc", "auditoria"), { recursive: true });
  fs.writeFileSync(path.join(projectDir, "regras.md"), `# Regras\n\n- ${RULE_TITLE}\n`);
  fs.writeFileSync(
    path.join(projectDir, "doc", "auditoria", "dispensacao.feature"),
    `Cenario: ${RULE_TITLE}\n`,
  );
  return projectDir;
}

const PROJECT_DIR = seedProject();

const {
  apiProjectAuditMatrix,
  apiProjectAuditEvidence,
  apiProjectAuditSummary,
  apiProjectAuditEvidenceSave,
} = require("../ui/server/controllers/audit.controller");
const { auditRoutes } = require("../ui/server/routes/audit.routes");

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

test("audit-http: matriz, evidencia e resumo do projeto", () => {
  const matrix = fakeRes();
  apiProjectAuditMatrix({ res: matrix, params: [SLUG], url: new URL("http://127.0.0.1/api") });
  assert.equal(matrix.status, 200);
  const body = json(matrix);
  assert.equal(body.ok, true);
  assert.ok(body.matrix.length >= 1);
  assert.ok(body.summary.counts);
  assert.equal(body.matrix[0].state, "generated");

  const filtered = fakeRes();
  apiProjectAuditMatrix({ res: filtered, params: [SLUG], url: new URL("http://127.0.0.1/api?state=planned") });
  assert.equal(filtered.status, 200);
  assert.ok(json(filtered).matrix.every((row) => row.state === "planned"));

  const evidence = fakeRes();
  apiProjectAuditEvidence({ res: evidence, params: [SLUG] });
  assert.equal(evidence.status, 200);
  assert.ok(Array.isArray(json(evidence).records));

  const summary = fakeRes();
  apiProjectAuditSummary({ res: summary, params: [SLUG] });
  assert.equal(summary.status, 200);
  assert.ok(json(summary).summary.counts);

  const missing = fakeRes();
  apiProjectAuditMatrix({ res: missing, params: ["nao-existe"], url: new URL("http://127.0.0.1/api") });
  assert.equal(missing.status, 404);
});

test("audit-http: registro de evidencia apenas no loopback", async () => {
  const remote = fakeRes();
  await apiProjectAuditEvidenceSave({
    req: fakeReq({ local: false, body: { screenId: "s1", ruleTitle: RULE_TITLE, state: "executed" } }),
    res: remote,
    params: [SLUG],
  });
  assert.equal(remote.status, 403);

  const badJson = fakeRes();
  await apiProjectAuditEvidenceSave({ req: fakeReqRaw("{quebrado"), res: badJson, params: [SLUG] });
  assert.equal(badJson.status, 400);

  const incomplete = fakeRes();
  await apiProjectAuditEvidenceSave({
    req: fakeReq({ local: true, body: { screenId: "s1", ruleTitle: RULE_TITLE, state: "executed" } }),
    res: incomplete,
    params: [SLUG],
  });
  assert.equal(incomplete.status, 400);

  const badProject = fakeRes();
  await apiProjectAuditEvidenceSave({
    req: fakeReq({ local: true, body: { screenId: "s1", ruleTitle: RULE_TITLE, state: "generated" } }),
    res: badProject,
    params: ["nao-existe"],
  });
  assert.equal(badProject.status, 404);

  const ok = fakeRes();
  await apiProjectAuditEvidenceSave({
    req: fakeReq({
      local: true,
      body: {
        screenId: "s1",
        ruleTitle: RULE_TITLE,
        state: "generated",
        kind: "bdd",
        evidence: { file: "doc/auditoria/dispensacao.feature", command: "npm test", actor: "qa" },
      },
    }),
    res: ok,
    params: [SLUG],
  });
  assert.equal(ok.status, 200);
  assert.equal(json(ok).record.state, "generated");

  const rollback = fakeRes();
  await apiProjectAuditEvidenceSave({
    req: fakeReq({ local: true, body: { screenId: "s1", ruleTitle: RULE_TITLE, state: "planned" } }),
    res: rollback,
    params: [SLUG],
  });
  assert.equal(rollback.status, 409);
});

test("audit-routes: rotas registradas, sem emojis e abaixo de 300 linhas", () => {
  const matches = (route, target) => (typeof route.path === "string" ? route.path === target : route.path.test(target));
  const find = (method, target) => auditRoutes.find((route) => route.method === method && matches(route, target));
  assert.equal(find("GET", "/api/project/demo/audit/matrix")?.handler?.name, "apiProjectAuditMatrix");
  assert.equal(find("GET", "/api/project/demo/audit/evidence")?.handler?.name, "apiProjectAuditEvidence");
  assert.equal(find("GET", "/api/project/demo/audit/summary")?.handler?.name, "apiProjectAuditSummary");
  assert.equal(find("POST", "/api/project/demo/audit/evidence")?.handler?.name, "apiProjectAuditEvidenceSave");

  const router = fs.readFileSync(path.join(__dirname, "..", "ui/server/router.js"), "utf8");
  assert.match(router, /auditRoutes/);
  assert.ok(router.split(/\r?\n/).length < 300, "router.js passou de 300 linhas.");

  const files = [
    "ui/server/services/audit/evidence-model.js",
    "ui/server/services/audit/evidence-store.js",
    "ui/server/services/audit/evidence-detection.js",
    "ui/server/services/audit/evidence-recorder.service.js",
    "ui/server/services/audit/audit-matrix.service.js",
    "ui/server/services/audit/test-generation.service.js",
    "ui/server/services/audit/test-execution.service.js",
    "ui/server/services/audit/audit-pipeline.service.js",
    "ui/server/services/audit/component-audit.service.js",
    "ui/server/controllers/audit.controller.js",
    "ui/server/controllers/audit-pipeline.controller.js",
    "ui/server/routes/audit.routes.js",
    "ui/server/routes/design.routes.js",
    "ui/server/routes/inspect.routes.js",
    "ui/public/js/modules/design-audit-evidence.js",
    "ui/public/js/modules/design-audit-evidence-api.js",
    "ui/public/js/modules/design-audit-components.js",
    "ui/public/js/modules/design-audit-matrix.js",
    "ui/public/js/modules/design-audit-legacy.js",
    "ui/server/services/project-audit.service.js",
    "ui/public/css/design/22-auditoria-evidencias.css",
    "tests/audit-evidence.test.js",
    "tests/audit-http.test.js",
    "tests/audit-pipeline.test.js",
    "tests/audit-components.test.js",
  ];
  for (const file of files) {
    const text = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.ok(text.split(/\r?\n/).length < 300, `${file} passou de 300 linhas`);
    assert.equal(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text), false, `${file} contém emoji`);
  }
});
