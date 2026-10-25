// @ts-check
const os = require("os");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const test = require("node:test");
const assert = require("node:assert/strict");
const { removeDir } = require("./helpers/temp-dir");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-deploy-actions-"));
process.env.HARNESS_ROOT = TMP_ROOT;
test.after(() => removeDir(TMP_ROOT));

const GLOBAL = path.join(TMP_ROOT, "global");

function seedDeployConfig() {
  fs.mkdirSync(GLOBAL, { recursive: true });
  fs.writeFileSync(path.join(GLOBAL, "deployments.json"), JSON.stringify({
    easypanelHost: "",
    defaultTimeoutMs: 15000,
    projects: [
      {
        id: "57multimarcas-web",
        name: "Web",
        description: "Projeto de teste",
        environments: [
          { id: "hom", name: "Homologacao", type: "staging", webhookUrl: "", method: "POST", requireConfirm: false },
          { id: "prod", name: "Producao", type: "production", webhookUrl: "http://127.0.0.1:9/deploy?token=abcdef123456", method: "POST", requireConfirm: true },
        ],
      },
      {
        id: "57multimarcas-api",
        name: "Backend",
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
  listActions,
  getAction,
  requiresConfirmation,
  RISKS,
} = require("../ui/server/services/deploy/action-policy.service");
const {
  issueAuthorization,
  readAuthorizations,
  assertUsableAuthorization,
  TTL_MINUTES,
} = require("../ui/server/services/deploy/authorization.service");
const { describeAction, executeAction } = require("../ui/server/services/deploy/deploy-actions.service");
const {
  apiDeployActions,
  apiDeployActionAuthorize,
  apiDeployActionExecute,
} = require("../ui/server/controllers/deploy-actions.controller");
const { buildTimeline } = require("../ui/server/services/deploy/deploy-timeline.service");

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

test("deploy-actions: catalogo, risco e exigencia de confirmacao", () => {
  const actions = listActions();
  assert.equal(actions.length >= 4, true);
  assert.ok(RISKS.includes("critico"));
  const prod = getAction("deploy-prod");
  assert.equal(prod.risk, "critico");
  assert.equal(requiresConfirmation(prod), true);
  assert.equal(requiresConfirmation(getAction("deploy-hom")), false);
  assert.equal(getAction("nao-existe"), null);
});

test("deploy-actions: autorizacao tem ator, prazo e uso unico", () => {
  const authorization = issueAuthorization({ actionId: "deploy-hom", actor: "operador" });
  assert.ok(authorization.id.startsWith("auth-"));
  assert.equal(authorization.actor, "operador");
  assert.equal(Date.parse(authorization.expiresAt) > Date.now(), true);
  assert.equal(TTL_MINUTES, 15);

  assert.throws(() => issueAuthorization({ actionId: "deploy-hom", actor: "" }), /responsavel/);
  assert.throws(() => assertUsableAuthorization("auth-inexistente", "deploy-hom"), /inexistente/);
});

test("deploy-actions: autorizacao expirada e de outra acao sao recusadas", () => {
  const authorization = issueAuthorization({ actionId: "deploy-hom", actor: "operador", ttlMinutes: -1 });
  assert.throws(() => assertUsableAuthorization(authorization.id, "deploy-hom"), /expirada/);
  const other = issueAuthorization({ actionId: "deploy-hom", actor: "operador" });
  assert.throws(() => assertUsableAuthorization(other.id, "deploy-prod"), /outra acao/);
});

test("deploy-actions: manifesto de autorizacoes tolerante", () => {
  assert.ok(Array.isArray(readAuthorizations().records));
  const file = path.join(GLOBAL, "deploy-authorizations.json");
  fs.writeFileSync(file, "{quebrado", "utf8");
  const invalid = readAuthorizations();
  assert.deepEqual(invalid.records, []);
  assert.equal(invalid.warnings.length, 1);
  fs.rmSync(file);
});

test("deploy-actions: plano da acao e dry run nao executam nada", async () => {
  const described = describeAction("deploy-prod");
  assert.equal(described.requiresConfirmation, true);
  assert.match(described.plan.webhook, /token=abcd\.\.\.3456/);

  const dry = await executeAction({
    actionId: "deploy-prod",
    authorizationId: "",
    confirm: true,
    dryRun: true,
  });
  assert.equal(dry.dryRun, true);
  assert.ok(dry.plan);
});

test("deploy-actions: acao critica exige confirmacao e autorizacao valida", async () => {
  await assert.rejects(() => executeAction({
    actionId: "deploy-prod",
    authorizationId: "auth-inexistente",
    confirm: false,
  }), /confirmacao/);

  const authorization = issueAuthorization({ actionId: "deploy-prod", actor: "coordenador" });
  await assert.rejects(() => executeAction({
    actionId: "deploy-prod",
    authorizationId: authorization.id,
    confirm: false,
  }), /confirmacao/);

  const result = await executeAction({
    actionId: "deploy-prod",
    authorizationId: authorization.id,
    confirm: true,
    actor: "coordenador",
  });
  assert.equal(result.action.risk, "critico");
  assert.equal(result.action.actor, "coordenador");
  assert.equal(result.action.authorizationId, authorization.id);

  const timeline = buildTimeline({ kind: "acao" });
  assert.equal(timeline.entries.length, 1);
  assert.equal(timeline.entries[0].kind, "acao");

  await assert.rejects(() => executeAction({
    actionId: "deploy-prod",
    authorizationId: authorization.id,
    confirm: true,
  }), /ja utilizada/);
});

test("deploy-actions: endpoints, loopback e erros", async () => {
  const list = fakeRes();
  apiDeployActions({ res: list });
  assert.equal(list.status, 200);
  assert.ok(json(list).actions.length >= 4);

  const remote = fakeRes();
  await apiDeployActionAuthorize({ req: fakeReq({ local: false, body: { actor: "x" } }), res: remote, params: ["deploy-hom"] });
  assert.equal(remote.status, 403);

  const noActor = fakeRes();
  await apiDeployActionAuthorize({ req: fakeReq({ local: true, body: {} }), res: noActor, params: ["deploy-hom"] });
  assert.equal(noActor.status, 400);

  const issued = fakeRes();
  await apiDeployActionAuthorize({ req: fakeReq({ local: true, body: { actor: "operador" } }), res: issued, params: ["deploy-hom"] });
  assert.equal(issued.status, 200);
  const authorizationId = json(issued).authorization.id;

  const executeRemote = fakeRes();
  await apiDeployActionExecute({ req: fakeReq({ local: false, body: { authorizationId } }), res: executeRemote, params: ["deploy-hom"] });
  assert.equal(executeRemote.status, 403);

  const unknown = fakeRes();
  await apiDeployActionExecute({ req: fakeReq({ local: true, body: { authorizationId } }), res: unknown, params: ["nao-existe"] });
  assert.equal(unknown.status, 404);
});

test("deploy-actions: estrutura sem emojis e dentro do teto de linhas", () => {
  const files = [
    "ui/server/services/deploy/action-policy.service.js",
    "ui/server/services/deploy/authorization.service.js",
    "ui/server/services/deploy/deploy-actions.service.js",
    "ui/server/controllers/deploy-actions.controller.js",
    "ui/public/js/deploy/deploy-actions.js",
    "ui/public/css/deploy/08-acoes-autorizadas.css",
    "tests/deploy-actions.test.js",
  ];
  for (const file of files) {
    const text = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.ok(text.split(/\r?\n/).length < 300, `${file} passou de 300 linhas`);
    assert.equal(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text), false, `${file} contém emoji`);
  }
});
