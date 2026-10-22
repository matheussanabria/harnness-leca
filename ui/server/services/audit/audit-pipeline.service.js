// @ts-check
// Pipeline de estados de teste: gerar, executar e aprovar (EP-11.02).
const fs = require("fs");
const path = require("path");
const { getProjectAudit } = require("../project-audit.service");
const { readEvidenceManifest } = require("./evidence-store");
const { recordEvidence } = require("./evidence-recorder.service");
const { generateTestArtifact } = require("./test-generation.service");
const { runGeneratedTest } = require("./test-execution.service");
const { effectiveState } = require("./evidence-model");

const ACTIONS = Object.freeze(["generate", "execute", "approve"]);

function fail(status, message) {
  const error = new Error(message);
  // @ts-ignore
  error.status = status;
  return error;
}

/**
 * Localiza a regra na matriz de auditoria do projeto.
 * @param {{ slug: string, repoRoot: string, projectDir: string, screenId: string, ruleTitle: string }} params
 * @returns {Object}
 */
function findRule({ slug, repoRoot, projectDir, screenId, ruleTitle }) {
  const audit = getProjectAudit(slug, repoRoot, projectDir);
  const rule = (audit.rulesMatrix || []).find((item) => item.telaId === screenId && item.title === ruleTitle);
  if (!rule) throw fail(400, "Regra nao encontrada na auditoria do projeto.");
  return rule;
}

/**
 * Registro da evidencia de uma regra no manifesto.
 * @param {string} projectDir
 * @param {string} screenId
 * @param {string} ruleTitle
 * @returns {Object | null}
 */
function findRecord(projectDir, screenId, ruleTitle) {
  const manifest = readEvidenceManifest(projectDir);
  return manifest.records.find((item) => item.screenId === screenId && item.ruleTitle === ruleTitle) || null;
}

/**
 * Estado efetivo da regra, combinando manifesto e artefato em disco.
 * @param {string} projectDir
 * @param {Object | null} record
 * @returns {string}
 */
function currentState(projectDir, record) {
  const declared = record?.state || "planned";
  const file = record?.evidence?.file || "";
  const hasArtifact = Boolean(file) && fs.existsSync(path.join(projectDir, file));
  return effectiveState(declared, {
    hasArtifact,
    hasExecution: declared === "executed" && Boolean(record?.evidence?.command),
    hasApproval: declared === "approved" && Boolean(record?.evidence?.actor),
  });
}

/**
 * Acoes disponiveis para a regra, com motivo quando bloqueada.
 * @param {string} state
 * @param {{ hasArtifact: boolean, hasExecution: boolean }} facts
 * @returns {Object[]}
 */
function availableActions(state, facts) {
  const actions = [];
  if (state === "planned" || (state === "generated" && !facts.hasArtifact)) {
    actions.push({ id: "generate", enabled: true, reason: "" });
  } else {
    actions.push({ id: "generate", enabled: false, reason: "O teste ja foi gerado." });
  }
  if (state === "generated" && facts.hasArtifact) {
    actions.push({ id: "execute", enabled: true, reason: "" });
  } else {
    actions.push({ id: "execute", enabled: false, reason: state === "planned" ? "Gere o teste antes de executar." : "O teste ja foi executado." });
  }
  if (state === "executed" && facts.hasExecution) {
    actions.push({ id: "approve", enabled: true, reason: "" });
  } else {
    actions.push({ id: "approve", enabled: false, reason: "Aprovacao exige execucao bem-sucedida." });
  }
  return actions;
}

/**
 * Gera o artefato de teste da regra e registra o estado `generated`.
 * @param {{ slug: string, repoRoot: string, projectDir: string, screenId: string, ruleTitle: string, kind?: string, actor?: string }} params
 * @returns {Object}
 */
function generateTest({ slug, repoRoot, projectDir, screenId, ruleTitle, kind = "bdd", actor = "" }) {
  const rule = findRule({ slug, repoRoot, projectDir, screenId, ruleTitle });
  const record = findRecord(projectDir, screenId, ruleTitle);
  const state = currentState(projectDir, record);
  if (state === "executed" || state === "approved") {
    throw fail(409, "O teste ja foi executado ou aprovado; a geracao nao se aplica.");
  }
  const artifact = generateTestArtifact({
    projectDir,
    screenId,
    screenName: rule.telaNome,
    ruleTitle,
    detail: rule.t || "",
    kind,
  });
  const saved = recordEvidence({
    projectDir,
    screenId,
    screenName: rule.telaNome,
    ruleTitle,
    state: "generated",
    kind,
    evidence: { file: artifact.file, command: "", actor },
    note: artifact.created ? "Artefato de teste gerado." : "Artefato de teste ja existente.",
  });
  return { ok: true, action: "generate", artifact, record: saved, state: "generated" };
}

/**
 * Executa o teste gerado e registra o estado `executed` quando o comando termina bem.
 * @param {{ slug: string, repoRoot: string, projectDir: string, screenId: string, ruleTitle: string, actor?: string }} params
 * @returns {Object}
 */
function executeTest({ slug, repoRoot, projectDir, screenId, ruleTitle, actor = "" }) {
  const rule = findRule({ slug, repoRoot, projectDir, screenId, ruleTitle });
  const record = findRecord(projectDir, screenId, ruleTitle);
  if (!record || record.state !== "generated" || !record.evidence?.file) {
    throw fail(409, "Gere o teste antes de executar.");
  }
  const kind = record.kind || "bdd";
  const run = runGeneratedTest({ projectDir, repoRoot, file: record.evidence.file, kind });
  if (!run.success) {
    recordEvidence({
      projectDir,
      screenId,
      screenName: rule.telaNome,
      ruleTitle,
      state: "generated",
      kind,
      evidence: { file: record.evidence.file, command: run.command, actor },
      note: `Execucao falhou (codigo ${run.exitCode}).`,
    });
    throw fail(409, `Execucao falhou com codigo ${run.exitCode}: ${run.output.slice(0, 200)}`);
  }
  const saved = recordEvidence({
    projectDir,
    screenId,
    screenName: rule.telaNome,
    ruleTitle,
    state: "executed",
    kind,
    evidence: { file: record.evidence.file, command: run.command, actor },
    note: `Execucao concluida em ${run.durationMs}ms.`,
  });
  return { ok: true, action: "execute", run, record: saved, state: "executed" };
}

/**
 * Aprova a evidencia apos execucao bem-sucedida.
 * @param {{ slug: string, repoRoot: string, projectDir: string, screenId: string, ruleTitle: string, actor?: string, note?: string }} params
 * @returns {Object}
 */
function approveTest({ slug, repoRoot, projectDir, screenId, ruleTitle, actor = "", note = "" }) {
  const rule = findRule({ slug, repoRoot, projectDir, screenId, ruleTitle });
  const record = findRecord(projectDir, screenId, ruleTitle);
  if (!record || record.state !== "executed" || !record.evidence?.command || !record.evidence?.file) {
    throw fail(409, "Aprovacao exige execucao bem-sucedida registrada.");
  }
  if (!String(actor || "").trim()) throw fail(400, "Aprovacao exige o responsavel.");
  const saved = recordEvidence({
    projectDir,
    screenId,
    screenName: rule.telaNome,
    ruleTitle,
    state: "approved",
    kind: record.kind || "bdd",
    evidence: { file: record.evidence.file, command: record.evidence.command, actor },
    note,
  });
  return { ok: true, action: "approve", record: saved, state: "approved" };
}

/**
 * Lista as acoes disponiveis por regra do projeto.
 * @param {{ slug: string, repoRoot: string, projectDir: string }} params
 * @returns {Object}
 */
function listPipeline({ slug, repoRoot, projectDir }) {
  const audit = getProjectAudit(slug, repoRoot, projectDir);
  const items = (audit.rulesMatrix || []).map((rule) => {
    const record = findRecord(projectDir, rule.telaId, rule.title);
    const state = currentState(projectDir, record);
    const file = record?.evidence?.file || "";
    const hasArtifact = Boolean(file) && fs.existsSync(path.join(projectDir, file));
    return {
      screenId: rule.telaId,
      screenName: rule.telaNome,
      ruleTitle: rule.title,
      state,
      file,
      actions: availableActions(state, {
        hasArtifact,
        hasExecution: state === "executed" && Boolean(record?.evidence?.command),
      }),
    };
  });
  return { ok: true, slug, items, actions: ACTIONS };
}

module.exports = {
  ACTIONS,
  findRule,
  findRecord,
  currentState,
  availableActions,
  generateTest,
  executeTest,
  approveTest,
  listPipeline,
};
