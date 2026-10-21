// @ts-check
// Manifesto de verificacoes e medicoes de saude de ambientes (EP-10.02).
const fs = require("fs");
const path = require("path");
const { ROOT } = require("../../../../tools/lib/root");

const CHECKS_REL = path.join("global", "deploy-health.json");
const RUNS_REL = path.join("global", "deploy-health-runs.jsonl");
const CHECKS_VERSION = 1;
const MAX_BYTES = 256 * 1024;
const MAX_LINES = 1000;
const MAX_LINE = 4000;

function absolute(rel) {
  return path.join(ROOT, rel);
}

/**
 * Le as verificacoes de saude, tolerando arquivo invalido.
 * @returns {{ checks: Object[], warnings: string[] }}
 */
function readHealthChecks() {
  const file = absolute(CHECKS_REL);
  try {
    if (!fs.existsSync(file)) return { checks: [], warnings: [] };
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      return { checks: [], warnings: ["Manifesto de saude invalido."] };
    }
    if (stat.size > MAX_BYTES) return { checks: [], warnings: ["Manifesto de saude acima do limite."] };
    const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    const checks = Array.isArray(parsed?.checks) ? parsed.checks : [];
    return { checks, warnings: [] };
  } catch {
    return { checks: [], warnings: ["Manifesto de saude invalido."] };
  }
}

/**
 * Grava as verificacoes de saude de forma atomica.
 * @param {Object[]} checks
 * @returns {boolean}
 */
function writeHealthChecks(checks = []) {
  try {
    const file = absolute(CHECKS_REL);
    const payload = {
      _v: CHECKS_VERSION,
      updatedAt: new Date().toISOString(),
      checks,
    };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(tmp, file);
    return true;
  } catch {
    return false;
  }
}

/**
 * Le as medicoes recentes de saude.
 * @param {{ limit?: number }} [options]
 * @returns {{ measurements: Object[], warnings: string[], totals: Object }}
 */
function readHealthRuns(options = {}) {
  const file = absolute(RUNS_REL);
  const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200);
  try {
    if (!fs.existsSync(file)) return { measurements: [], warnings: [], totals: { total: 0, invalid: 0 } };
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      return { measurements: [], warnings: ["Historico de medicoes invalido."], totals: { total: 0, invalid: 0 } };
    }
    if (stat.size > MAX_BYTES) {
      return { measurements: [], warnings: ["Historico de medicoes acima do limite."], totals: { total: 0, invalid: 0 } };
    }
    const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
    const measurements = [];
    let invalid = 0;
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      if (line.length > MAX_LINE) {
        invalid += 1;
        continue;
      }
      try {
        const parsed = JSON.parse(line);
        if (parsed && typeof parsed === "object" && typeof parsed.checkId === "string") measurements.push(parsed);
        else invalid += 1;
      } catch {
        invalid += 1;
      }
    }
    return {
      measurements: measurements.slice(-limit).reverse(),
      warnings: invalid ? [`${invalid} linha(s) de historico ignorada(s).`] : [],
      totals: { total: measurements.length, invalid },
    };
  } catch {
    return { measurements: [], warnings: ["Historico de medicoes invalido."], totals: { total: 0, invalid: 0 } };
  }
}

/**
 * Acrescenta uma medicao ao historico.
 * @param {Object} measurement
 * @returns {boolean}
 */
function appendHealthRun(measurement) {
  try {
    const file = absolute(RUNS_REL);
    if (fs.existsSync(file)) {
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink() || !stat.isFile()) return false;
    }
    const line = JSON.stringify(measurement).slice(0, MAX_LINE);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file) && fs.statSync(file).size + line.length > MAX_BYTES) {
      const kept = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).slice(-MAX_LINES);
      fs.writeFileSync(file, `${kept.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
    }
    fs.appendFileSync(file, `${line}\n`, { encoding: "utf8", mode: 0o600 });
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  CHECKS_REL,
  RUNS_REL,
  CHECKS_VERSION,
  MAX_LINES,
  readHealthChecks,
  writeHealthChecks,
  readHealthRuns,
  appendHealthRun,
};
