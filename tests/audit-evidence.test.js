// @ts-check
const os = require("os");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { removeDir } = require("./helpers/temp-dir");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-audit-"));
process.env.HARNESS_ROOT = TMP_ROOT;
test.after(() => removeDir(TMP_ROOT));

const SLUG = "projeto-auditoria";
const RULE_TITLE = "Validacao de dispensacao medica no historico";
const OTHER_RULE = "Bloqueio de prescricao sem assinatura";

function seedProject() {
  const projectDir = path.join(TMP_ROOT, "projects", SLUG);
  fs.mkdirSync(path.join(projectDir, "doc", "auditoria"), { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, "regras.md"),
    `# Regras\n\n- ${RULE_TITLE}\n- ${OTHER_RULE}\n`,
  );
  fs.writeFileSync(
    path.join(projectDir, "doc", "auditoria", "dispensacao.feature"),
    `Funcionalidade: Dispensacao\n\n  Cenario: Validacao de dispensacao medica registrada no historico do paciente\n    Dado que a dispensacao foi registrada\n    Quando o historico do paciente e consultado\n    Entao a dispensacao aparece no historico\n`,
  );
  return projectDir;
}

const PROJECT_DIR = seedProject();

const {
  STATES,
  STATE_RANK,
  effectiveState,
  assertTransition,
  summarizeByState,
  evidenceKey,
} = require("../ui/server/services/audit/evidence-model");
const { readEvidenceManifest, writeEvidenceManifest } = require("../ui/server/services/audit/evidence-store");
const { recordEvidence, listEvidence } = require("../ui/server/services/audit/evidence-recorder.service");
const { detectTestArtifacts } = require("../ui/server/services/audit/evidence-detection");
const { buildAuditMatrix } = require("../ui/server/services/audit/audit-matrix.service");

test("audit-evidence: quatro estados ordenados e estado efetivo limitado pela evidencia", () => {
  assert.deepEqual([...STATES], ["planned", "generated", "executed", "approved"]);
  assert.ok(STATE_RANK.planned < STATE_RANK.generated);
  assert.ok(STATE_RANK.generated < STATE_RANK.executed);
  assert.ok(STATE_RANK.executed < STATE_RANK.approved);

  assert.equal(effectiveState("approved", {}), "planned");
  assert.equal(effectiveState("approved", { hasArtifact: true }), "generated");
  assert.equal(effectiveState("approved", { hasArtifact: true, hasExecution: true }), "executed");
  assert.equal(effectiveState("approved", { hasArtifact: true, hasExecution: true, hasApproval: true }), "approved");
  assert.equal(effectiveState("planned", { hasArtifact: true }), "generated");
});

test("audit-evidence: transicoes invalidas e evidencia incompleta sao recusadas", () => {
  assert.throws(() => assertTransition("executed", "planned"), /Transicao invalida/);
  assert.throws(() => assertTransition("planned", "inexistente"), /Estado de evidencia invalido/);
  assert.throws(() => assertTransition("planned", "executed", { file: "", command: "" }), /exige o arquivo/);
  assert.throws(() => assertTransition("planned", "executed", { file: "a.feature", command: "" }), /exige o comando/);
  assert.throws(() => assertTransition("planned", "approved", { file: "a.feature", command: "npm test" }), /exige o responsavel/);
  assert.doesNotThrow(() => assertTransition("planned", "approved", { file: "a.feature", command: "npm test", actor: "qa" }));
});

test("audit-evidence: manifesto tolerante e escrita atomica", () => {
  const empty = readEvidenceManifest(PROJECT_DIR);
  assert.deepEqual(empty.records, []);
  assert.deepEqual(empty.warnings, []);

  const written = writeEvidenceManifest(PROJECT_DIR, [{ id: "abc", screenId: "s1", ruleTitle: "x", state: "planned" }]);
  assert.equal(written, true);
  const parsed = readEvidenceManifest(PROJECT_DIR);
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].id, "abc");

  fs.writeFileSync(path.join(PROJECT_DIR, "audit-evidence.json"), "{quebrado", "utf8");
  const invalid = readEvidenceManifest(PROJECT_DIR);
  assert.deepEqual(invalid.records, []);
  assert.equal(invalid.warnings.length, 1);
  fs.rmSync(path.join(PROJECT_DIR, "audit-evidence.json"));
});

test("audit-evidence: registro de evidencia respeita a ordem dos estados", () => {
  const record = recordEvidence({
    projectDir: PROJECT_DIR,
    screenId: "s1",
    ruleTitle: OTHER_RULE,
    state: "generated",
    kind: "bdd",
    evidence: { file: "doc/auditoria/outro.feature", command: "npm test", actor: "qa" },
  });
  assert.equal(record.state, "generated");
  assert.equal(record.history.length, 1);

  assert.throws(() => recordEvidence({
    projectDir: PROJECT_DIR,
    screenId: "s1",
    ruleTitle: OTHER_RULE,
    state: "planned",
  }), /Transicao invalida/);

  const listed = listEvidence(PROJECT_DIR);
  assert.equal(listed.records.length, 1);
});

test("audit-evidence: deteccao encontra artefatos reais do projeto", () => {
  const rules = [{ screenId: "s1", screenName: "1 · Visao Geral", title: RULE_TITLE }];
  const detection = detectTestArtifacts(PROJECT_DIR, rules);
  assert.ok(detection.scanned >= 1);
  const found = detection.byRule.get(`s1|${RULE_TITLE}`);
  assert.ok(found);
  assert.match(found.file, /dispensacao\.feature/);
  assert.equal(found.hash.length, 16);
  assert.ok(found.at);
});

test("audit-evidence: matriz distingue planejada, gerada, executada e aprovada", () => {
  const matrix = buildAuditMatrix({ slug: SLUG, repoRoot: TMP_ROOT, projectDir: PROJECT_DIR });
  assert.equal(matrix.ok, true);
  assert.ok(matrix.matrix.length >= 2);
  assert.equal(matrix.summary.counts.planned + matrix.summary.counts.generated
    + matrix.summary.counts.executed + matrix.summary.counts.approved, matrix.matrix.length);

  const withArtifact = matrix.matrix.find((row) => row.title === RULE_TITLE);
  assert.equal(withArtifact.state, "generated");
  assert.match(withArtifact.evidence.file, /dispensacao\.feature/);

  const withoutArtifact = matrix.matrix.find((row) => row.title === OTHER_RULE);
  assert.ok(withoutArtifact);
  assert.equal(withoutArtifact.state, "planned");
  assert.equal(withoutArtifact.evidence.file, "");
});

test("audit-evidence: gerado nunca vira aprovado sem arquivo, comando e responsavel", () => {
  recordEvidence({
    projectDir: PROJECT_DIR,
    screenId: "s1",
    ruleTitle: OTHER_RULE,
    state: "approved",
    kind: "bdd",
    evidence: { file: "doc/auditoria/inexistente.feature", command: "npm test", actor: "qa" },
  });
  const matrix = buildAuditMatrix({ slug: SLUG, repoRoot: TMP_ROOT, projectDir: PROJECT_DIR });
  const row = matrix.matrix.find((item) => item.title === OTHER_RULE);
  assert.equal(row.declaredState, "approved");
  assert.notEqual(row.state, "approved");
});

test("audit-evidence: filtro por estado e por busca na matriz", () => {
  const matrix = buildAuditMatrix({ slug: SLUG, repoRoot: TMP_ROOT, projectDir: PROJECT_DIR });
  const planned = buildAuditMatrix({ slug: SLUG, repoRoot: TMP_ROOT, projectDir: PROJECT_DIR, state: "planned" });
  assert.ok(planned.matrix.every((row) => row.state === "planned"));

  const search = buildAuditMatrix({ slug: SLUG, repoRoot: TMP_ROOT, projectDir: PROJECT_DIR, query: "dispensacao" });
  assert.ok(search.matrix.length >= 1);
  assert.ok(search.matrix.length <= matrix.matrix.length);
});

test("audit-evidence: metricas nao somam estados diferentes", () => {
  const summary = summarizeByState([
    { state: "approved" },
    { state: "executed" },
    { state: "generated" },
    { state: "planned" },
  ]);
  assert.equal(summary.counts.approved, 1);
  assert.equal(summary.counts.executed, 1);
  assert.equal(summary.approvedPercent, 25);
  assert.equal(summary.executedPercent, 50);
  assert.equal(summary.artifactPercent, 75);
  assert.equal(evidenceKey("s1", "Regra"), evidenceKey("s1", "Regra"));
  assert.notEqual(evidenceKey("s1", "Regra"), evidenceKey("s2", "Regra"));
});
