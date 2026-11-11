// @ts-check
// Reads the parts of the DAI repository the playbook shows: the feature-delivery stages with who runs
// and who supports each one, and the squad's agents. Read-only. The DAI path is always a parameter.
const fs = require("fs");
const path = require("path");

const unquote = (v) => v.trim().replace(/^["']|["']$/g, "");
const indentOf = (line) => line.match(/^ */)[0].length;

/**
 * Narrow reader for the workflow manifest: only `states` (phase, activity) and `activities` (executor, support).
 * @param {string} text
 * @returns {Array<{ id: string, phase: string, executor: string, kind: string, support: string[], trigger: boolean }>}
 */
function parseWorkflowManifest(text) {
  const states = new Map();
  const activities = new Map();
  let section = "";
  let current = null;
  let list = "";
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const ind = indentOf(raw);
    const line = raw.trim();
    if (ind === 2 && /^[a-z_]+:/.test(line)) { section = line.split(":")[0]; current = null; list = ""; continue; }
    if (section !== "states" && section !== "activities") continue;
    if (ind === 4 && line.endsWith(":")) {
      current = { id: unquote(line.slice(0, -1)) };
      (section === "states" ? states : activities).set(current.id, current);
      list = "";
      continue;
    }
    if (!current || ind < 6) continue;
    if (ind === 6) {
      const m = line.match(/^([a-z_]+):\s*(.*)$/);
      if (!m) continue;
      list = m[2] === "" ? m[1] : "";
      if (m[2] !== "") current[m[1]] = unquote(m[2]);
      else if (m[1] === "support") current.support = [];
    } else if (ind === 8 && list === "support" && line.startsWith("- ")) {
      current.support.push(unquote(line.slice(2)));
    }
  }
  return [...states.values()]
    .filter((s) => s.activity)
    .map((s) => {
      const act = activities.get(s.activity) || {};
      const raw = String(act.executor || "session");
      const kind = raw.includes(":") ? raw.split(":")[0] : raw;
      return { id: s.id, phase: s.phase || "", executor: raw.replace(/^(agent|builtin):/, ""), kind, support: act.support || [], trigger: Boolean(s.trigger) };
    });
}

/** Agent heading without emoji, and a one-line summary. */
function describeAgent(dir, id) {
  const file = path.join(dir, id, "AGENT.md");
  let title = id;
  let summary = "";
  try {
    const lines = fs.readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const heading = lines.find((l) => l.startsWith("#"));
    if (heading) title = heading.replace(/^#+\s*/, "").replace(/[^\p{L}\p{N}\s&/.()-]/gu, "").trim() || id;
    const body = lines.find((l) => !l.startsWith("#") && !l.startsWith("---") && !l.startsWith("|"));
    if (body) summary = body.replace(/^>\s*/, "").replace(/[*`_]/g, "").slice(0, 150);
  } catch { /* an agent without AGENT.md still gets a card with its id */ }
  return { id, title, summary };
}

/**
 * @param {string} daiRoot
 * @returns {{ stages: ReturnType<typeof parseWorkflowManifest>, agents: Array<any>, missingAgents: string[], matrix: { stages: string[], rows: Array<any> } }}
 */
function readDai(daiRoot) {
  const manifest = path.join(daiRoot, "workflows", "feature-delivery", "manifest.yaml");
  if (!fs.existsSync(manifest)) throw new Error(`DAI feature-delivery manifest not found at ${manifest}`);
  const stages = parseWorkflowManifest(fs.readFileSync(manifest, "utf8"));
  const agentsDir = path.join(daiRoot, ".agents");
  const ids = fs.existsSync(agentsDir)
    ? fs.readdirSync(agentsDir, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith("00-") && !e.name.startsWith(".")).map((e) => e.name).sort()
    : [];

  const roleOf = (agent) => stages.reduce((acc, s) => {
    if (s.executor === agent) acc.push({ id: s.id, role: "executor" });
    else if (s.support.includes(agent)) acc.push({ id: s.id, role: "support" });
    return acc;
  }, []);

  const agents = ids.map((id) => ({ ...describeAgent(agentsDir, id), path: `.agents/${id}/`, stages: roleOf(id) }));
  const referenced = stages.flatMap((s) => [s.kind === "session" ? "" : s.executor, ...s.support]).filter(Boolean);
  const rows = [...new Set([...ids, ...referenced])].map((agent) => {
    const cells = {};
    for (const s of roleOf(agent)) cells[s.id] = s.role;
    return { agent, cells };
  }).filter((r) => Object.keys(r.cells).length > 0);
  // Agents a stage names that have no folder in .agents/ (built-in executors such as code-review are expected).
  const missingAgents = [...new Set(stages.flatMap((s) => [s.kind === "agent" ? s.executor : "", ...s.support]).filter((a) => a && !ids.includes(a)))];
  return { stages, agents, missingAgents, matrix: { stages: stages.map((s) => s.id), rows } };
}

module.exports = { parseWorkflowManifest, readDai };
