// @ts-check
// Descobre os alvos (repo raiz, sub-repos, pasta do projeto) que podem receber skills.
const fs = require("fs");
const path = require("path");
const { ROOT } = require("../root");
const { cleanBOM } = require("./frontmatter");

const PROJECTS = path.join(ROOT, "projects");

/**
 * Encontra todos os alvos de repositório/subprojetos associados a um projeto do harness.
 * @param {string} slug
 * @returns {Array<{ id: string, label: string, path: string, type: string, hasAgents: boolean }>}
 */
function findProjectTargets(slug) {
  const targets = [];
  const projectDir = path.join(PROJECTS, slug);
  if (!fs.existsSync(projectDir)) return targets;

  let baseRepo = null;
  const mcpJson = path.join(projectDir, "mcp.json");
  if (fs.existsSync(mcpJson)) {
    try {
      const parsed = JSON.parse(cleanBOM(fs.readFileSync(mcpJson, "utf8")));
      if (parsed && parsed.repo) baseRepo = path.resolve(String(parsed.repo));
    } catch {}
  }

  if (baseRepo && fs.existsSync(baseRepo)) {
    const baseName = path.basename(baseRepo);
    const rootHasAgents = fs.existsSync(path.join(baseRepo, ".agents", "skills"));
    targets.push({
      id: "repo-root",
      label: `${baseName} (Raiz)`,
      path: baseRepo,
      type: "root",
      hasAgents: rootHasAgents,
    });

    // Varre subdiretórios em busca de sub-repos (ex.: dispensacao-web, dispensacao-api, 57multimarcas-web, 57multimarcas-api)
    function scanSubdirs(dir, depth = 1) {
      if (depth > 3) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const ent of entries) {
          if (!ent.isDirectory()) continue;
          if (["node_modules", ".git", "dist", "target", ".angular", ".claude", ".vscode", ".idea", "build", "tools", ".tmp_swc"].includes(ent.name) || ent.name.endsWith("-mcp")) continue;
          const fullPath = path.join(dir, ent.name);
          const hasAgentsDir = fs.existsSync(path.join(fullPath, ".agents"));
          const hasPackageJson = fs.existsSync(path.join(fullPath, "package.json"));
          const hasPom = fs.existsSync(path.join(fullPath, "pom.xml")) || fs.existsSync(path.join(fullPath, "build.gradle"));

          if (hasAgentsDir || hasPackageJson || hasPom) {
            let type = "other";
            const lowerName = ent.name.toLowerCase();
            if (lowerName.includes("web") || lowerName.includes("front") || lowerName.includes("ui")) type = "web";
            else if (lowerName.includes("api") || lowerName.includes("back") || lowerName.includes("server")) type = "api";
            else if (hasPom) type = "api";
            else if (hasPackageJson) type = "web";

            targets.push({
              id: ent.name,
              label: ent.name,
              path: fullPath,
              type,
              hasAgents: hasAgentsDir && fs.existsSync(path.join(fullPath, ".agents", "skills")),
            });
          }
          scanSubdirs(fullPath, depth + 1);
        }
      } catch {}
    }

    scanSubdirs(baseRepo, 1);
  }

  // Também inclui o diretório do próprio projeto no harness
  const projectHasAgents = fs.existsSync(path.join(projectDir, ".agents", "skills")) || fs.existsSync(path.join(projectDir, "skills"));
  targets.push({
    id: "project-harness",
    label: `${slug} (Harness)`,
    path: projectDir,
    type: "project",
    hasAgents: projectHasAgents,
  });

  // Remove duplicados de caminho preservando IDs mais específicos
  const unique = [];
  const seenPaths = new Set();
  for (const t of targets) {
    if (!seenPaths.has(t.path)) {
      seenPaths.add(t.path);
      unique.push(t);
    }
  }

  return unique;
}

module.exports = { findProjectTargets, PROJECTS };
