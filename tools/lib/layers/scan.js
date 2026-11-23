// @ts-check
// Scans one root for items of one kind. Formats follow the DAI:
//   skill:    <id>/SKILL.md      (may be nested under a domain folder, up to 3 levels)
//   agent:    <id>/AGENT.md
//   workflow: <id>/manifest.yaml (or WORKFLOW.md)
// Folders starting with "00-" hold architecture docs, not items, and are skipped.
const fs = require("fs");
const path = require("path");
const { parseFrontmatter, cleanBOM } = require("../skills/frontmatter");

const KINDS = ["skill", "agent", "workflow"];
const MARKERS = { skill: ["SKILL.md"], agent: ["AGENT.md"], workflow: ["manifest.yaml", "WORKFLOW.md"] };
const MAX_DEPTH = 3;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

const read = (file) => { try { return cleanBOM(fs.readFileSync(file, "utf8")); } catch { return ""; } };
const oneLine = (s) => String(s || "").replace(/\s+/g, " ").trim().slice(0, 200);

/** @param {"skill"|"agent"|"workflow"} kind @param {string} file */
function describe(kind, file) {
  const text = read(file);
  if (kind === "skill") return oneLine(parseFrontmatter(text).attributes.description);
  if (kind === "workflow") {
    const m = text.match(/^description:\s*(?:>-?\s*)?(.+)$/m);
    return m ? oneLine(m[1].replace(/^["']|["']$/g, "")) : "";
  }
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const body = lines.find((l, i) => i > 0 && !l.startsWith("#") && !l.startsWith("---"));
  return oneLine((body || "").replace(/^>\s*/, ""));
}

/**
 * @param {"skill"|"agent"|"workflow"} kind
 * @param {string} root
 * @returns {{ id: string, kind: string, dir: string, file: string, description: string }[]}
 */
function scanKind(kind, root) {
  /** @type {any[]} */
  const out = [];
  const walk = (dir, depth) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      if (!ent.isDirectory() || ent.name.startsWith(".") || ent.name.startsWith("00-")) continue;
      const full = path.join(dir, ent.name);
      const marker = MARKERS[kind].map((m) => path.join(full, m)).find((f) => fs.existsSync(f));
      if (marker && ID_RE.test(ent.name)) {
        out.push({ id: ent.name, kind, dir: full, file: marker, description: describe(kind, marker) });
      } else if (kind === "skill" && depth < MAX_DEPTH) {
        walk(full, depth + 1); // DAI nests skills under a domain folder
      }
    }
  };
  walk(root, 1);
  return out;
}

module.exports = { KINDS, scanKind };
