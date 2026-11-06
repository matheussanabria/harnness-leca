// @ts-check
// Registry of the places the catalog reads skills and agents from.
//
// A source is { id, label, scope, dir }. The id is used in URLs and in the page, so it only has
// [A-Za-z0-9._-]. Precedence when the same name exists in several sources (first one wins):
//   1. user     ~/.claude                      (skills/ and agents/)
//   2. harness  <harness root>/.agents/skills
//   3. project  every repo target of every project (.agents/skills, skills/, .claude/agents)
const fs = require("fs");
const os = require("os");
const path = require("path");
const { ROOT } = require("../../../../tools/lib/root");
const { findProjectTargets } = require("../../../../tools/lib/skills/targets");

const SAFE = /[^A-Za-z0-9._-]+/g;
const safeId = (...parts) => parts.join("-").replace(SAFE, "-").replace(/^-+|-+$/g, "");
const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

/** Project folders under <root>/projects (templates and dot folders are skipped). */
function listProjectSlugs(root) {
  const dir = path.join(root, "projects");
  if (!isDir(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("."))
    .map((e) => e.name);
}

/** Skills dir of a project target: .agents/skills first, then skills/. */
function targetSkillsDir(target) {
  const a = path.join(target.path, ".agents", "skills");
  if (isDir(a)) return a;
  const b = path.join(target.path, "skills");
  return isDir(b) ? b : "";
}

/**
 * @param {{ home?: string, root?: string, projectTargets?: (slug: string) => Array<any> }} [opts]
 * @returns {{ skills: Array<{id:string,label:string,scope:string,dir:string}>, agents: Array<{id:string,label:string,scope:string,dir:string}> }}
 */
function listSources(opts = {}) {
  const claude = path.join(opts.home || os.homedir(), ".claude");
  const root = opts.root || ROOT;
  const targetsOf = opts.projectTargets || findProjectTargets;
  const skills = [
    { id: "user", label: "Usuário (~/.claude)", scope: "user", dir: path.join(claude, "skills") },
    { id: "harness", label: "Harness (.agents)", scope: "harness", dir: path.join(root, ".agents", "skills") },
  ];
  const agents = [{ id: "user", label: "Usuário (~/.claude)", scope: "user", dir: path.join(claude, "agents") }];
  const seenDirs = new Set(skills.map((s) => path.resolve(s.dir)));

  for (const slug of listProjectSlugs(root)) {
    for (const target of targetsOf(slug)) {
      const label = `${slug} / ${target.label || target.id}`;
      const sdir = targetSkillsDir(target);
      // The "project-harness" target is the project's own folder, which can overlap another target: skip repeats.
      if (sdir && !seenDirs.has(path.resolve(sdir))) {
        seenDirs.add(path.resolve(sdir));
        skills.push({ id: safeId("p", slug, target.id), label, scope: "project", dir: sdir });
      }
      const adir = path.join(target.path, ".claude", "agents");
      if (isDir(adir) && !seenDirs.has(path.resolve(adir))) {
        seenDirs.add(path.resolve(adir));
        agents.push({ id: safeId("p", slug, target.id), label, scope: "project", dir: adir });
      }
    }
  }
  return { skills, agents };
}

module.exports = { listSources, listProjectSlugs, safeId };
