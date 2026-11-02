// @ts-check
// Read-only aggregation of the routing outcomes in the HIA telemetry log: per-combo ok/failed counts and
// fallbacks per source route. Reads the log tail only (bounded) and keeps an allow-list of keys.
const fs = require("fs");
const path = require("path");

const TAIL_BYTES = 4 * 1024 * 1024;

/** @returns {string} */
function defaultLogFile() {
  const { ROOT } = require("../../../../tools/lib/root");
  return path.join(ROOT, "logs", "telemetry", "hia-executions.jsonl");
}

/** @param {string} v @returns {string} combo name without the 9router/ model prefix */
const bare = (v) => String(v || "").replace(/^9router\//, "");

/** @param {{ file?: string }} [opts] */
function readRoutingOutcomes(opts = {}) {
  const file = opts.file || defaultLogFile();
  /** @type {Map<string, { combo: string, ok: number, failed: number, lastAt: string, lastError: string }>} */
  const combos = new Map();
  /** @type {Record<string, number>} */
  const fallbacks = {};
  const warnings = [];
  let text = "";
  try {
    const fd = fs.openSync(file, "r");
    try {
      const size = fs.fstatSync(fd).size;
      const start = Math.max(0, size - TAIL_BYTES);
      const buf = Buffer.alloc(size - start);
      fs.readSync(fd, buf, 0, buf.length, start);
      text = buf.toString("utf8");
      if (start > 0) text = text.slice(text.indexOf("\n") + 1);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return { combos: [], fallbacks, warnings: ["routing telemetry log not found"] };
  }
  for (const line of text.split("\n")) {
    if (!line.startsWith("{")) continue;
    let r;
    try { r = JSON.parse(line); } catch { continue; }
    if (r.executorType === "combo" && (r.status === "succeeded" || r.status === "failed")) {
      const name = bare(r.appliedCombo || r.executorId);
      if (!name) continue;
      const c = combos.get(name) || { combo: name, ok: 0, failed: 0, lastAt: "", lastError: "" };
      if (r.status === "succeeded") c.ok += 1; else { c.failed += 1; c.lastError = String(r.error || "").slice(0, 40); }
      const at = typeof r.recordedAt === "string" ? r.recordedAt : "";
      if (at > c.lastAt) c.lastAt = at;
      combos.set(name, c);
    } else if (r.status === "fallback" && (r.executorType === "script" || r.executorType === "local_llm")) {
      fallbacks[r.executorType] = (fallbacks[r.executorType] || 0) + 1;
    }
  }
  return { combos: [...combos.values()], fallbacks, warnings };
}

module.exports = { readRoutingOutcomes };
