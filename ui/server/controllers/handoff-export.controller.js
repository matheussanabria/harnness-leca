// @ts-check
const path = require("path");
const { getProjects, send } = require("../config");
const { getProjectRepoInfo } = require("./inspect.controller");
const { getProjectDesignContext } = require("../services/project-design-context.service");
const { buildHandoffBundle } = require("../services/handoff-bundle.service");

/**
 * GET /api/project/:slug/design/export/handoff?protos=<id,id|all>&ds=1&mcp=1
 * Downloads a ZIP another person can open with Claude (or another engine) to keep prototyping with the same patterns.
 */
async function apiHandoffExport({ req, res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  const query = new URL(req.url, "http://localhost").searchParams;
  const protosParam = (query.get("protos") || "").trim();
  const prototypeIds = protosParam === "all" ? "all" : protosParam.split(",").map((s) => s.trim()).filter(Boolean);
  const flag = (name, fallback) => (query.has(name) ? query.get(name) !== "0" : fallback);

  try {
    const { loadProjectConfig } = require("../../../tools/lib/project-mcp");
    const config = loadProjectConfig(projectDir);
    const { repo } = getProjectRepoInfo(slug);
    const context = getProjectDesignContext(slug, projectDir, repo || projectDir);
    const { compileSingleHtmlPrototype } = require("../services/prototype-exporter.service");
    const { zip, fileName } = buildHandoffBundle({
      slug,
      projectDir,
      repo: config.repo,
      mcpServers: config.mcpServers,
      prototypeIds,
      includeDs: flag("ds", true),
      includeMcp: flag("mcp", true),
      compileStandalone: (protoId) => compileSingleHtmlPrototype(projectDir, repo || projectDir, protoId, context),
    });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", String(zip.length));
    res.writeHead(200);
    return res.end(zip);
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

module.exports = { apiHandoffExport };
