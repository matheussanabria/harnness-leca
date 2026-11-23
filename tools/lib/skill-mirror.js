// @ts-check
// Mirrors a project's skills into the folder Claude Code reads, so every engine sees the same project skills.
//   source: <target>/.agents/skills/<name>/   (or <target>/skills/<name>/ in projects/<slug>)  read by Codex and OpenCode
//   mirror: <target>/.claude/skills/<name>/   read by Claude Code
// Each mirrored folder carries a sidecar (MARK). A folder in .claude/skills WITHOUT the sidecar is the user's own and is
// never touched; a mirrored folder whose source skill disappeared is removed.
const fs = require("fs");
const path = require("path");
const { findProjectTargets, readProjectConfig } = require("./skills/targets");
const { ROOT } = require("./root");

const MARK = ".harness-managed";
const SOURCES = [[".agents", "skills"], ["skills"]];

/** @param {string} dir @returns {string[]} relative paths of regular files, without the sidecar */
function listFiles(dir, base = dir) {
  /** @type {string[]} */
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listFiles(full, base));
    else if (ent.isFile() && ent.name !== MARK) out.push(path.relative(base, full));
  }
  return out;
}

/** @param {string} targetPath */
function sourceDir(targetPath) {
  for (const parts of SOURCES) {
    const dir = path.join(targetPath, ...parts);
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}

/**
 * Mirrors one target (a repo root or projects/<slug>).
 * @param {{ targetPath: string, dryRun?: boolean }} o
 * @returns {{ created: string[], updated: string[], unchanged: string[], removed: string[], skipped: string[] }}
 */
function mirrorTarget({ targetPath, dryRun = false }) {
  const res = { created: [], updated: [], unchanged: [], removed: [], skipped: [] };
  const src = sourceDir(targetPath);
  if (!src) return res;
  const dst = path.join(targetPath, ".claude", "skills");
  const names = fs.readdirSync(src, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith(".") && fs.existsSync(path.join(src, d.name, "SKILL.md")))
    .map((d) => d.name);

  for (const name of names) {
    const from = path.join(src, name);
    const to = path.join(dst, name);
    const existed = fs.existsSync(to);
    if (existed && !fs.existsSync(path.join(to, MARK))) { res.skipped.push(name); continue; } // the user's own skill
    const files = listFiles(from);
    let changed = !existed;
    for (const rel of files) {
      const data = fs.readFileSync(path.join(from, rel));
      const dest = path.join(to, rel);
      if (fs.existsSync(dest) && data.equals(fs.readFileSync(dest))) continue;
      changed = true;
      if (!dryRun) { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, data); }
    }
    if (existed) {
      for (const rel of listFiles(to)) {
        if (files.includes(rel)) continue;
        changed = true;
        if (!dryRun) fs.rmSync(path.join(to, rel));
      }
    }
    if (changed && !dryRun) fs.writeFileSync(path.join(to, MARK), `source: ${path.relative(targetPath, from).split(path.sep).join("/")}\n`);
    (changed ? (existed ? res.updated : res.created) : res.unchanged).push(name);
  }

  if (fs.existsSync(dst)) {
    for (const d of fs.readdirSync(dst, { withFileTypes: true })) {
      if (!d.isDirectory() || names.includes(d.name) || !fs.existsSync(path.join(dst, d.name, MARK))) continue;
      res.removed.push(d.name);
      if (!dryRun) fs.rmSync(path.join(dst, d.name), { recursive: true, force: true });
    }
  }
  return res;
}

/**
 * Mirrors the skill targets of a project that the Harness owns: projects/<slug> always, and the working repositories
 * (workspace, sub-repos) ONLY when project.json says "mirrorToWorkspace": true. The Harness never writes into a user
 * repository on its own: an unmanaged .claude/ folder there shows up in that repository's git status.
 * @param {string} slug @param {{ dryRun?: boolean }} [o]
 */
function mirrorProjectSkills(slug, o = {}) {
  const total = { created: 0, updated: 0, unchanged: 0, removed: 0, skipped: 0 };
  const optedIn = readProjectConfig(path.join(ROOT, "projects", slug)).mirrorToWorkspace === true;
  for (const t of findProjectTargets(slug)) {
    if (!t.hasAgents) continue;
    if (t.type !== "project" && !optedIn) continue;
    const r = mirrorTarget({ targetPath: t.path, dryRun: o.dryRun });
    for (const k of Object.keys(total)) total[k] += r[k].length;
  }
  return total;
}

module.exports = { MARK, mirrorTarget, mirrorProjectSkills };
