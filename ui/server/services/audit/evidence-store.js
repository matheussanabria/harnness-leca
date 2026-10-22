// @ts-check
// Manifesto de evidencias de teste por projeto (EP-11.01).
// Arquivo: projects/<slug>/audit-evidence.json
const fs = require("fs");
const path = require("path");

const MANIFEST_REL = "audit-evidence.json";
const MANIFEST_VERSION = 1;
const MAX_BYTES = 256 * 1024;
const MAX_RECORDS = 2000;

function manifestPath(projectDir) {
  return path.join(projectDir, MANIFEST_REL);
}

/**
 * Le o manifesto de evidencias, tolerando arquivo ausente ou invalido.
 * @param {string} projectDir
 * @returns {{ records: Object[], warnings: string[], version: number }}
 */
function readEvidenceManifest(projectDir) {
  const abs = manifestPath(projectDir);
  try {
    if (!fs.existsSync(abs)) return { records: [], warnings: [], version: MANIFEST_VERSION };
    const stat = fs.lstatSync(abs);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      return { records: [], warnings: ["Manifesto de evidencias invalido."], version: MANIFEST_VERSION };
    }
    if (stat.size > MAX_BYTES) {
      return { records: [], warnings: ["Manifesto de evidencias acima do limite."], version: MANIFEST_VERSION };
    }
    const raw = fs.readFileSync(abs, "utf8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    const records = Array.isArray(parsed?.records) ? parsed.records : [];
    return { records, warnings: [], version: Number(parsed?._v) || MANIFEST_VERSION };
  } catch {
    return { records: [], warnings: ["Manifesto de evidencias invalido."], version: MANIFEST_VERSION };
  }
}

/**
 * Grava o manifesto de evidencias de forma atomica.
 * @param {string} projectDir
 * @param {Object[]} records
 * @returns {boolean}
 */
function writeEvidenceManifest(projectDir, records = []) {
  try {
    const abs = manifestPath(projectDir);
    if (fs.existsSync(abs)) {
      const stat = fs.lstatSync(abs);
      if (stat.isSymbolicLink() || !stat.isFile()) return false;
    }
    const payload = {
      _v: MANIFEST_VERSION,
      updatedAt: new Date().toISOString(),
      records: records.slice(-MAX_RECORDS),
    };
    const tmp = `${abs}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(tmp, abs);
    return true;
  } catch {
    return false;
  }
}

module.exports = { MANIFEST_REL, MANIFEST_VERSION, MAX_RECORDS, manifestPath, readEvidenceManifest, writeEvidenceManifest };
