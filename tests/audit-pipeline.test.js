// @ts-check
const os = require("os");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const test = require("node:test");
const assert = require("node:assert/strict");
const { removeDir } = require("./helpers/temp-dir");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-audit-pipeline-"));
process.env.HARNESS_ROOT = TMP_ROOT;
test.after(() => removeDir(TMP_ROOT));

const SLUG = "projeto-pipeline";
const RULE_TITLE = "Validacao de dispensacao medica no historico";

function seedProject() {
  const projectDir = path.join(TMP_ROOT, "projects", SLUG);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, "regras.md"), `# Regras\n\n- ${RULE_TITLE}\n`);
  return projectDir;
}

const PROJECT_DIR = seedProject();

const {
  generateTestArtifact,
  testFileName,
  renderTestContent,
} = require("../ui/server/services/audit/test-generation.service");
const { resolveCommand, runGeneratedTest } = require("../ui/server/services/audit/test-execution.service");
const {
  listPipeline,
  generateTest,
  executeTest,
  approveTest,
  availableActions,
} = require("../ui/server/services/audit/audit-pipeline.service");
const { readEvidenceManifest } = require("../ui/server/services/audit/evidence-store");
const {
  apiProjectAuditPipeline,
  apiProjectAuditEvidenceGenerate,
  apiProjectAuditEvidenceExecute,
  apiProjectAuditEvidenceApprove,
} = require("../ui/server/controllers/audit-pipeline.controller");

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

test("audit-pipeline: geracao cria o artefato, com hash e sem sobrescrita", () => {
  const first = generateTestArtifact({
    projectDir: PROJECT_DIR,
    screenId: "s1",
    screenName: "1 · Visao Geral",
    ruleTitle: RULE_TITLE,
    detail: "Detalhe da regra",
    kind: "unit",
  });
  assert.equal(first.created, true);
  assert.match(first.file, /doc\/auditoria\/.+\.test\.js/);
  assert.equal(first.hash.length, 16);
  assert.ok(fs.existsSync(path.join(PROJECT_DIR, first.file)));

  const second = generateTestArtifact({
    projectDir: PROJECT_DIR,
    screenId: "s1",
    ruleTitle: RULE_TITLE,
    kind: "unit",
  });
  assert.equal(second.created, false);
  assert.equal(second.hash, first.hash);

  assert.match(testFileName("s1", RULE_TITLE, "bdd"), /\.feature$/);
  assert.match(renderTestContent({ screenName: "T", ruleTitle: RULE_TITLE, detail: "d", kind: "bdd" }), /Cenario:/);
});

test("audit-pipeline: allowlist de comandos recusa tipos desconhecidos", () => {
  assert.deepEqual(resolveCommand("unit", "a.test.js").args, ["--test", "a.test.js"]);
  assert.equal(resolveCommand("bdd").command, "npm");
  assert.throws(() => resolveCommand("e2e"), /nao autorizado/);
});

test("audit-pipeline: ciclo gerar, executar e aprovar grava os estados", () => {
  const generated = generateTest({
    slug: SLUG,
    repoRoot: TMP_ROOT,
    projectDir: PROJECT_DIR,
    screenId: "s1",
    ruleTitle: RULE_TITLE,
    kind: "unit",
    actor: "qa",
  });
  assert.equal(generated.state, "generated");
  assert.equal(generated.record.evidence.file, generated.artifact.file);

  const generatedFile = path.join(PROJECT_DIR, generated.artifact.file);
  const placeholder = runGeneratedTest({
    projectDir: PROJECT_DIR,
    repoRoot: TMP_ROOT,
    file: generated.artifact.file,
    kind: "unit",
  });
  assert.equal(placeholder.success, false, "teste gerado nao preenchido nao pode passar");
  fs.writeFileSync(generatedFile, 'require("node:test")("regra", () => {});', "utf8");

  const executed = executeTest({
    slug: SLUG,
    repoRoot: TMP_ROOT,
    projectDir: PROJECT_DIR,
    screenId: "s1",
    ruleTitle: RULE_TITLE,
    actor: "qa",
  });
  assert.equal(executed.state, "executed");
  assert.equal(executed.run.success, true);
  assert.match(executed.run.command, /node --test/);

  const approved = approveTest({
    slug: SLUG,
    repoRoot: TMP_ROOT,
    projectDir: PROJECT_DIR,
    screenId: "s1",
    ruleTitle: RULE_TITLE,
    actor: "coordenador",
    note: "aprovado",
  });
  assert.equal(approved.state, "approved");
  assert.equal(approved.record.evidence.actor, "coordenador");

  const manifest = readEvidenceManifest(PROJECT_DIR);
  const record = manifest.records.find((item) => item.ruleTitle === RULE_TITLE);
  assert.equal(record.state, "approved");
  assert.ok(record.history.length >= 3);
  assert.deepEqual(record.history.map((item) => item.state), ["generated", "executed", "approved"]);
});

test("audit-pipeline: execucao com falha nao promove o estado", () => {
  const ruleTitle = "Bloqueio de prescricao sem assinatura";
  fs.writeFileSync(path.join(PROJECT_DIR, "regras.md"), `# Regras\n\n- ${RULE_TITLE}\n- ${ruleTitle}\n`);
  generateTest({
    slug: SLUG,
    repoRoot: TMP_ROOT,
    projectDir: PROJECT_DIR,
    screenId: "s1",
    ruleTitle,
    kind: "unit",
    actor: "qa",
  });
  const record = readEvidenceManifest(PROJECT_DIR).records.find((item) => item.ruleTitle === ruleTitle);
  fs.writeFileSync(path.join(PROJECT_DIR, record.evidence.file), 'const test = require("node:test");\ntest("falha", () => { throw new Error("boom"); });\n', "utf8");

  assert.throws(() => executeTest({
    slug: SLUG,
    repoRoot: TMP_ROOT,
    projectDir: PROJECT_DIR,
    screenId: "s1",
    ruleTitle,
    actor: "qa",
  }), /Execucao falhou/);

  const after = readEvidenceManifest(PROJECT_DIR).records.find((item) => item.ruleTitle === ruleTitle);
  assert.equal(after.state, "generated");
  assert.throws(() => approveTest({
    slug: SLUG,
    repoRoot: TMP_ROOT,
    projectDir: PROJECT_DIR,
    screenId: "s1",
    ruleTitle,
    actor: "coordenador",
  }), /execucao bem-sucedida/);
});

test("audit-pipeline: acoes disponiveis seguem o estado atual", () => {
  const planned = availableActions("planned", { hasArtifact: false, hasExecution: false });
  assert.equal(planned.find((item) => item.id === "generate").enabled, true);
  assert.equal(planned.find((item) => item.id === "execute").enabled, false);
  assert.match(planned.find((item) => item.id === "execute").reason, /Gere o teste/);

  const executed = availableActions("executed", { hasArtifact: true, hasExecution: true });
  assert.equal(executed.find((item) => item.id === "approve").enabled, true);
  assert.equal(executed.find((item) => item.id === "generate").enabled, false);

  const approved = availableActions("approved", { hasArtifact: true, hasExecution: true });
  assert.ok(approved.every((item) => !item.enabled));
});

test("audit-pipeline: listagem do pipeline expoe as acoes por regra", () => {
  const pipeline = listPipeline({ slug: SLUG, repoRoot: TMP_ROOT, projectDir: PROJECT_DIR });
  assert.equal(pipeline.ok, true);
  const item = pipeline.items.find((row) => row.ruleTitle === RULE_TITLE);
  assert.ok(item);
  assert.equal(item.state, "approved");
  assert.equal(item.actions.length, 3);
});

test("audit-pipeline: endpoints do pipeline, loopback e erros", async () => {
  const list = fakeRes();
  apiProjectAuditPipeline({ res: list, params: [SLUG] });
  assert.equal(list.status, 200);
  assert.ok(json(list).items.length >= 1);

  const remote = fakeRes();
  await apiProjectAuditEvidenceGenerate({
    req: fakeReq({ local: false, body: { screenId: "s1", ruleTitle: RULE_TITLE } }),
    res: remote,
    params: [SLUG],
  });
  assert.equal(remote.status, 403);

  const invalid = fakeRes();
  await apiProjectAuditEvidenceGenerate({
    req: fakeReq({ local: true, body: { screenId: "s1" } }),
    res: invalid,
    params: [SLUG],
  });
  assert.equal(invalid.status, 400);

  const missingProject = fakeRes();
  await apiProjectAuditEvidenceGenerate({
    req: fakeReq({ local: true, body: { screenId: "s1", ruleTitle: RULE_TITLE } }),
    res: missingProject,
    params: ["nao-existe"],
  });
  assert.equal(missingProject.status, 404);

  const unknownRule = fakeRes();
  await apiProjectAuditEvidenceGenerate({
    req: fakeReq({ local: true, body: { screenId: "s1", ruleTitle: "regra inexistente" } }),
    res: unknownRule,
    params: [SLUG],
  });
  assert.equal(unknownRule.status, 400);

  const executeWithoutTest = fakeRes();
  await apiProjectAuditEvidenceExecute({
    req: fakeReq({ local: true, body: { screenId: "s1", ruleTitle: "regra inexistente" } }),
    res: executeWithoutTest,
    params: [SLUG],
  });
  assert.equal(executeWithoutTest.status, 400);

  const approveWithoutActor = fakeRes();
  await apiProjectAuditEvidenceApprove({
    req: fakeReq({ local: true, body: { screenId: "s1", ruleTitle: RULE_TITLE } }),
    res: approveWithoutActor,
    params: [SLUG],
  });
  assert.equal(approveWithoutActor.status, 409);
});

test("audit-pipeline: execucao fora do projeto e recusada", () => {
  assert.throws(() => runGeneratedTest({
    projectDir: PROJECT_DIR,
    repoRoot: TMP_ROOT,
    file: "../fora.js",
    kind: "unit",
  }), /fora do projeto/);
  assert.throws(() => runGeneratedTest({
    projectDir: PROJECT_DIR,
    repoRoot: TMP_ROOT,
    file: "doc/auditoria/inexistente.test.js",
    kind: "unit",
  }), /nao encontrado/);
});
