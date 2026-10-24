// @ts-check
const os = require("os");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-audit-components-"));
process.env.HARNESS_ROOT = TMP_ROOT;

const SLUG = "projeto-componentes";
const RULE_TITLE = "Validacao de dispensacao medica no historico";

function seedProject() {
  const projectDir = path.join(TMP_ROOT, "projects", SLUG);
  fs.mkdirSync(path.join(projectDir, "design"), { recursive: true });
  fs.writeFileSync(path.join(projectDir, "regras.md"), `# Regras\n\n- ${RULE_TITLE}\n`);
  fs.writeFileSync(path.join(projectDir, "design", "design.json"), JSON.stringify({
    schema: 1,
    project: SLUG,
    components: [
      {
        id: "dispensacao-historico",
        name: "DispensacaoHistoricoComponent",
        selector: ".dispensacao-historico",
        files: { target: "src/app/dispensacao-historico.component.ts" },
      },
    ],
  }, null, 2));
  return projectDir;
}

const PROJECT_DIR = seedProject();

const {
  tokens,
  componentTokens,
  ruleTokens,
  sharesToken,
  situationFor,
  buildComponentAudit,
} = require("../ui/server/services/audit/component-audit.service");
const { apiProjectAuditComponents } = require("../ui/server/controllers/audit.controller");

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

test("audit-components: tokens normalizados e comparacao minima", () => {
  assert.deepEqual(tokens("Validacao de Dispensacao Medica"), ["validacao", "dispensacao", "medica"]);
  assert.deepEqual(tokens("a b c"), []);

  const parts = componentTokens({ id: "dispensacao-historico", name: "DispensacaoHistoricoComponent", selector: ".dispensacao-historico" });
  assert.ok(parts.includes("dispensacao"));
  assert.ok(parts.includes("historico"));

  const rule = ruleTokens({ title: RULE_TITLE, screenName: "Tela de Dispensacao" });
  assert.equal(sharesToken(parts, rule), true);
  assert.equal(sharesToken(parts, tokens("Regras totalmente diferentes")), false);
});

test("audit-components: situacao deriva do pior estado das regras", () => {
  assert.equal(situationFor([]), "sem_regra");
  assert.equal(situationFor([{ state: "planned" }]), "regra_sem_evidencia");
  assert.equal(situationFor([{ state: "generated" }]), "regra_sem_evidencia");
  assert.equal(situationFor([{ state: "executed" }]), "regra_em_execucao");
  assert.equal(situationFor([{ state: "approved" }, { state: "approved" }]), "regra_aprovada");
  assert.equal(situationFor([{ state: "executed" }, { state: "approved" }]), "regra_em_execucao");
  assert.equal(situationFor([{ state: "approved" }, { state: "planned" }]), "regra_sem_evidencia");
});

test("audit-components: cruzamento expoe componentes, situacao e regras orfas", () => {
  const result = buildComponentAudit({ slug: SLUG, repoRoot: TMP_ROOT, projectDir: PROJECT_DIR });
  assert.equal(result.ok, true);
  assert.ok(result.totals.components >= 1);
  const component = result.components[0];
  assert.ok(component.id);
  assert.ok(component.stage);
  assert.equal(component.audit.total >= 1, true);
  assert.equal(component.audit.rules[0].ruleTitle, RULE_TITLE);
  assert.equal(typeof component.situation, "string");
  assert.ok(Array.isArray(result.rulesWithoutComponent));
});

test("audit-components: endpoint devolve o cruzamento e 404 para projeto inexistente", () => {
  const res = fakeRes();
  apiProjectAuditComponents({ res, params: [SLUG] });
  assert.equal(res.status, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.ok, true);
  assert.ok(body.totals);

  const missing = fakeRes();
  apiProjectAuditComponents({ res: missing, params: ["nao-existe"] });
  assert.equal(missing.status, 404);
});

test("audit-components: modulos de interface carregam e exportam o esperado", async () => {
  const { pathToFileURL } = require("node:url");
  const evidence = await import(pathToFileURL(path.join(__dirname, "..", "ui/public/js/modules/design-audit-evidence.js")).href);
  assert.equal(typeof evidence.renderEvidenceSection, "function");
  const components = await import(pathToFileURL(path.join(__dirname, "..", "ui/public/js/modules/design-audit-components.js")).href);
  assert.equal(typeof components.renderComponentSection, "function");
  assert.equal(typeof components.fetchComponentAudit, "function");
});

test("audit-components: estrutura sem emojis e dentro do teto de linhas", () => {
  const files = [
    "ui/server/services/audit/component-audit.service.js",
    "ui/public/js/modules/design-audit-components.js",
    "ui/public/js/modules/design-audit-workspace.js",
    "ui/public/css/design/22-auditoria-evidencias.css",
    "tests/audit-components.test.js",
    "ui/server/routes/audit.routes.js",
  ];
  for (const file of files) {
    const text = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.ok(text.split(/\r?\n/).length < 300, `${file} passou de 300 linhas`);
    assert.equal(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text), false, `${file} contém emoji`);
  }
});
