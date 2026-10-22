// @ts-check
// Registro de evidencias de teste por projeto (EP-11.01).
const { readEvidenceManifest, writeEvidenceManifest } = require("./evidence-store");
const {
  evidenceKey,
  normalizeEvidence,
  assertTransition,
  fail,
} = require("./evidence-model");

const MAX_HISTORY = 20;

/**
 * Lista as evidencias registradas no manifesto do projeto.
 * @param {string} projectDir
 * @returns {{ records: Object[], warnings: string[] }}
 */
function listEvidence(projectDir) {
  const manifest = readEvidenceManifest(projectDir);
  const records = manifest.records.map((record) => normalizeEvidence(record));
  return { records, warnings: manifest.warnings };
}

/**
 * Registra a evidencia de uma regra, respeitando a ordem dos estados.
 * @param {{ projectDir: string, screenId: string, ruleTitle: string, screenName?: string, state: string, kind?: string, evidence?: Object, note?: string }} params
 * @returns {Object}
 */
function recordEvidence({ projectDir, screenId, ruleTitle, screenName = "", state, kind = "", evidence = {}, note = "" }) {
  const manifest = readEvidenceManifest(projectDir);
  const key = `${String(screenId || "").trim()}|${String(ruleTitle || "").trim()}`;
  const existing = manifest.records.find((record) => `${record.screenId}|${record.ruleTitle}` === key) || null;

  const at = new Date().toISOString();
  const payload = {
    file: String(evidence.file || existing?.evidence?.file || "").trim(),
    command: String(evidence.command || existing?.evidence?.command || "").trim(),
    actor: String(evidence.actor || existing?.evidence?.actor || "").trim(),
    at,
  };

  assertTransition(existing?.state || "planned", state, payload);

  const record = normalizeEvidence({
    id: evidenceKey(screenId, ruleTitle),
    screenId,
    screenName: screenName || existing?.screenName || "",
    ruleTitle,
    kind: kind || existing?.kind || "unit",
    state,
    evidence: payload,
    history: [
      ...(existing?.history || []),
      { state, at, actor: payload.actor, note: String(note || "").slice(0, 300) },
    ].slice(-MAX_HISTORY),
    updatedAt: at,
  });

  const records = [...manifest.records.filter((item) => `${item.screenId}|${item.ruleTitle}` !== key), record];
  if (!writeEvidenceManifest(projectDir, records)) {
    throw fail(500, "Nao foi possivel gravar o manifesto de evidencias.");
  }
  return record;
}

module.exports = { listEvidence, recordEvidence };
