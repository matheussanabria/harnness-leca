// @ts-check
// Manifestos de pipelines e execucoes de deploy (EP-10.01).
const fs = require("fs");
const path = require("path");
const { ROOT } = require("../../../../tools/lib/root");

const PIPELINES_REL = path.join("global", "deploy-pipelines.json");
const RUNS_REL = path.join("global", "deploy-pipeline-runs.jsonl");
const PIPELINES_VERSION = 1;
const MAX_BYTES = 512 * 1024;
const MAX_LINES = 2000;
const MAX_LINE = 8000;

function absolute(rel) {
  return path.join(ROOT, rel);
}

/**
 * Le o manifesto de definicoes de pipelines, tolerando arquivo invalido.
 * @returns {{ pipelines: Object[], warnings: string[], version: number }}
 */
function readPipelines() {
  const file = absolute(PIPELINES_REL);
  try {
    if (!fs.existsSync(file)) return { pipelines: [], warnings: [], version: PIPELINES_VERSION };
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      return { pipelines: [], warnings: ["Manifesto de pipelines invalido."], version: PIPELINES_VERSION };
    }
    if (stat.size > MAX_BYTES) {
      return { pipelines: [], warnings: ["Manifesto de pipelines acima do limite."], version: PIPELINES_VERSION };
    }
    const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    const pipelines = Array.isArray(parsed?.pipelines) ? parsed.pipelines : [];
    return { pipelines, warnings: [], version: Number(parsed?._v) || PIPELINES_VERSION };
  } catch {
    return { pipelines: [], warnings: ["Manifesto de pipelines invalido."], version: PIPELINES_VERSION };
  }
}

/**
 * Grava o manifesto de definicoes de pipelines de forma atomica.
 * @param {Object[]} pipelines
 * @returns {boolean}
 */
function writePipelines(pipelines = []) {
  try {
    const file = absolute(PIPELINES_REL);
    const payload = {
      _v: PIPELINES_VERSION,
      updatedAt: new Date().toISOString(),
      pipelines,
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
 * Le o historico de execucoes (JSONL).
 * @param {{ limit?: number }} [options]
 * @returns {{ runs: Object[], warnings: string[], totals: Object }}
 */
function readPipelineRuns(options = {}) {
  const file = absolute(RUNS_REL);
  const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200);
  try {
    if (!fs.existsSync(file)) return { runs: [], warnings: [], totals: { total: 0, invalid: 0 } };
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      return { runs: [], warnings: ["Historico de execucoes invalido."], totals: { total: 0, invalid: 0 } };
    }
    if (stat.size > MAX_BYTES) {
      return { runs: [], warnings: ["Historico de execucoes acima do limite."], totals: { total: 0, invalid: 0 } };
    }
    const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
    const runs = [];
    let invalid = 0;
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim() || line.length > MAX_LINE) {
        if (line.trim()) invalid += 1;
        continue;
      }
      try {
        const parsed = JSON.parse(line);
        if (parsed && typeof parsed === "object" && typeof parsed.id === "string") runs.push(parsed);
        else invalid += 1;
      } catch {
        invalid += 1;
      }
    }
    return {
      runs: runs.slice(-limit).reverse(),
      warnings: invalid ? [`${invalid} linha(s) de historico ignorada(s).`] : [],
      totals: { total: runs.length, invalid },
    };
  } catch {
    return { runs: [], warnings: ["Historico de execucoes invalido."], totals: { total: 0, invalid: 0 } };
  }
}

/**
 * Acrescenta uma execucao ao historico (JSONL), limitando o tamanho.
 * @param {Object} run
 * @returns {boolean}
 */
function appendPipelineRun(run) {
  try {
    const file = absolute(RUNS_REL);
    if (fs.existsSync(file)) {
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink() || !stat.isFile()) return false;
    }
    const line = JSON.stringify(run).slice(0, MAX_LINE);
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
  PIPELINES_REL,
  RUNS_REL,
  PIPELINES_VERSION,
  MAX_LINES,
  readPipelines,
  writePipelines,
  readPipelineRuns,
  appendPipelineRun,
};
