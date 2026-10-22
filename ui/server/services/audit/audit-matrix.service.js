// @ts-check
// Matriz de auditoria com evidencias por regra (EP-11.01).
const { getProjectAudit } = require("../project-audit.service");
const { readEvidenceManifest } = require("./evidence-store");
const { detectTestArtifacts } = require("./evidence-detection");
const {
  evidenceKey,
  effectiveState,
  summarizeByState,
  isState,
} = require("./evidence-model");

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Resumo da comparacao com o legado por tela.
 * @param {Object[]} legacyItems
 * @returns {Map<string, Object>}
 */
function legacyByScreen(legacyItems = []) {
  const map = new Map();
  for (const item of legacyItems) {
    const id = String(item.telaId || "");
    const entry = map.get(id) || { total: 0, igual: 0, dif: 0, falta: 0, fora: 0, pendingDecision: 0 };
    entry.total += 1;
    const par = String(item.par || "igual");
    if (entry[par] !== undefined) entry[par] += 1;
    if (item.pm) entry.pendingDecision += 1;
    map.set(id, entry);
  }
  return map;
}

/**
 * Monta a matriz de auditoria com evidencia real por regra.
 * @param {{ slug: string, repoRoot: string, projectDir: string, state?: string, screenId?: string, query?: string }} params
 * @returns {Object}
 */
function buildAuditMatrix({ slug, repoRoot, projectDir, state = "", screenId = "", query = "" }) {
  const audit = getProjectAudit(slug, repoRoot, projectDir);
  const manifest = readEvidenceManifest(projectDir);
  const rules = (audit.rulesMatrix || []).map((rule) => ({
    screenId: rule.telaId,
    screenName: rule.telaNome,
    title: rule.title,
  }));

  const detection = detectTestArtifacts(projectDir, rules);
  const records = new Map();
  for (const record of manifest.records) {
    const key = record.id || evidenceKey(record.screenId, record.ruleTitle);
    records.set(`${record.screenId}|${record.ruleTitle}`, { ...record, id: key });
  }
  const legacy = legacyByScreen(audit.legacyAudit?.items || []);

  const allRows = (audit.rulesMatrix || []).map((rule) => {
    const key = `${rule.telaId}|${rule.title}`;
    const record = records.get(key) || null;
    const detected = detection.byRule.get(key) || null;
    const facts = {
      hasArtifact: Boolean(detected),
      hasExecution: Boolean(
        record
        && record.state === "executed"
        && record.evidence?.file
        && record.evidence?.command,
      ),
      hasApproval: Boolean(
        record
        && record.state === "approved"
        && record.evidence?.file
        && record.evidence?.command
        && record.evidence?.actor,
      ),
    };
    const effective = effectiveState(record?.state || "planned", facts);
    return {
      id: evidenceKey(rule.telaId, rule.title),
      screenId: rule.telaId,
      screenName: rule.telaNome,
      title: rule.title,
      detail: rule.t || "",
      source: rule.src || "",
      refs: rule.refs || [],
      scenarioStatus: rule.testStatus,
      scenarioLocation: rule.testLocation || "",
      state: effective,
      declaredState: record?.state || "planned",
      kind: record?.kind || "",
      evidence: {
        file: detected?.file || "",
        hash: detected?.hash || "",
        at: detected?.at || record?.evidence?.at || "",
        command: record?.evidence?.command || "",
        actor: record?.evidence?.actor || "",
        detected: Boolean(detected),
        declaredFile: detected ? "" : record?.evidence?.file || "",
      },
      legacy: legacy.get(rule.telaId) || { total: 0, igual: 0, dif: 0, falta: 0, fora: 0, pendingDecision: 0 },
      updatedAt: record?.updatedAt || "",
    };
  });

  const wantedState = String(state || "").trim();
  const wantedScreen = String(screenId || "").trim();
  const needle = normalize(query);

  const filtered = allRows.filter((row) => {
    if (wantedState && isState(wantedState) && row.state !== wantedState) return false;
    if (wantedScreen && row.screenId !== wantedScreen) return false;
    if (needle) {
      const haystack = normalize([row.title, row.screenName, row.evidence.file, row.detail].join(" "));
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  return {
    ok: true,
    slug,
    matrix: filtered,
    totals: {
      rules: allRows.length,
      filtered: filtered.length,
      screens: new Set(allRows.map((row) => row.screenId)).size,
      artifactsDetected: detection.byRule.size,
    },
    summary: summarizeByState(allRows),
    legacy: audit.legacyAudit?.counts || {},
    warnings: [...manifest.warnings, ...detection.warnings],
  };
}

module.exports = { buildAuditMatrix, legacyByScreen };
