// @ts-check
// Histórico persistido das execuções de workflow por projeto (EP-08.05).
// Arquivo: projects/<slug>/workflow-runs.jsonl (uma linha JSON por evento).
const fs = require("fs");
const path = require("path");

const HISTORY_REL = "workflow-runs.jsonl";
const MAX_BYTES = 512 * 1024;
const MAX_ENTRIES = 300;
const MAX_LINE = 4000;

function historyPath(projectDir) {
  return path.join(projectDir, HISTORY_REL);
}

function readLines(projectDir) {
  const abs = historyPath(projectDir);
  try {
    if (!fs.existsSync(abs)) return { lines: [], warnings: [] };
    const stat = fs.lstatSync(abs);
    if (stat.isSymbolicLink() || !stat.isFile()) return { lines: [], warnings: ["Arquivo de histórico inválido."] };
    if (stat.size > MAX_BYTES) return { lines: [], warnings: ["Arquivo de histórico acima do limite."] };
    const raw = fs.readFileSync(abs, "utf8").replace(/^\uFEFF/, "");
    const lines = raw.split(/\r?\n/).filter((line) => line.trim() && line.length <= MAX_LINE);
    return { lines, warnings: [] };
  } catch {
    return { lines: [], warnings: ["Arquivo de histórico inválido."] };
  }
}

function readWorkflowHistory(projectDir, { limit = 50 } = {}) {
  const { lines, warnings } = readLines(projectDir);
  const entries = [];
  let invalid = 0;
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === "object" && typeof parsed.type === "string") entries.push(parsed);
      else invalid += 1;
    } catch {
      invalid += 1;
    }
  }
  const size = Math.min(Math.max(Number(limit) || 50, 1), 200);
  return {
    entries: entries.slice(-size),
    totals: { total: entries.length, invalid },
    warnings: invalid ? [...warnings, `${invalid} linha(s) de histórico ignorada(s).`] : warnings,
  };
}

function recordWorkflowEvent(projectDir, entry) {
  try {
    const abs = historyPath(projectDir);
    if (fs.existsSync(abs)) {
      const stat = fs.lstatSync(abs);
      if (stat.isSymbolicLink() || !stat.isFile()) return "";
    }
    const record = {
      at: new Date().toISOString(),
      type: String(entry?.type || "workflow.event").slice(0, 60),
      executionId: String(entry?.executionId || "").slice(0, 80),
      slug: String(entry?.slug || "").slice(0, 80),
      workflowId: String(entry?.workflowId || "").slice(0, 80),
      status: String(entry?.status || "").slice(0, 40),
      stageId: String(entry?.stageId || "").slice(0, 60),
      decision: String(entry?.decision || "").slice(0, 20),
      actor: String(entry?.actor || "").slice(0, 80),
      note: String(entry?.note || "").slice(0, 500),
    };
    const line = JSON.stringify(record).slice(0, MAX_LINE);
    if (fs.existsSync(abs) && fs.statSync(abs).size + line.length > MAX_BYTES) {
      const kept = readLines(projectDir).lines.slice(-MAX_ENTRIES);
      fs.writeFileSync(abs, kept.length ? `${kept.join("\n")}\n` : "", { encoding: "utf8", mode: 0o600 });
    }
    fs.appendFileSync(abs, `${line}\n`, { encoding: "utf8", mode: 0o600 });
    return record.at;
  } catch {
    return "";
  }
}

module.exports = { HISTORY_REL, MAX_ENTRIES, readWorkflowHistory, recordWorkflowEvent };
