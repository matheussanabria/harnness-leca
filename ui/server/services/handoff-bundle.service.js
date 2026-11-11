// @ts-check
const fs = require("fs");
const path = require("path");
const { buildZip } = require("./zip-writer.service");
const { loadDsConfig } = require("../../../tools/lib/ds-config");
const { collectDir, listPrototypes, resolveMcpSources } = require("./handoff-collect.service");
const { buildReadme, buildAgents, buildMapa, buildMcpJson, buildPackageJson } = require("./handoff-docs.service");

const ID_RE = /^[\w-]+$/;

/**
 * Builds the handoff ZIP: prototypes, design system, MCP server source and guidance files.
 * @param {{
 *   slug: string, projectDir: string, repo: string | null, mcpServers: Record<string, any>,
 *   prototypeIds: string[] | "all", includeDs: boolean, includeMcp: boolean,
 *   compileStandalone?: (protoId: string) => string
 * }} opts
 * @returns {{ zip: Buffer, fileName: string, manifest: any }}
 */
function buildHandoffBundle(opts) {
  const available = listPrototypes(opts.projectDir);
  const wanted = opts.prototypeIds === "all" ? available.map((p) => p.id) : opts.prototypeIds;
  const prototypes = [];
  for (const id of wanted) {
    if (!ID_RE.test(id)) throw new Error(`Identificador de protótipo inválido: ${id}`);
    const found = available.find((p) => p.id === id);
    if (!found) throw new Error(`Protótipo '${id}' não encontrado.`);
    prototypes.push(found);
  }

  const dsDir = path.join(opts.projectDir, "design", "ds");
  const hasDs = opts.includeDs && fs.existsSync(dsDir);
  // The design system travels with its browsable showcase prototype (ds-config.json "vitrine"), so it can be opened in the preview.
  if (hasDs) {
    let vitrine = "";
    try { vitrine = loadDsConfig(opts.projectDir).vitrine; } catch { /* invalid config: ship the files without the showcase */ }
    const showcase = vitrine && available.find((p) => p.id === vitrine);
    if (showcase && !prototypes.some((p) => p.id === showcase.id)) prototypes.push(showcase);
  }
  if (!prototypes.length && !hasDs) throw new Error("Nada para exportar: selecione um protótipo ou o design system.");

  const budget = { total: 0 };
  /** @type {{ name: string, data: Buffer | string }[]} */
  const entries = [];

  for (const p of prototypes) {
    entries.push(...collectDir(path.join(opts.projectDir, "design", "prototypes", p.id), `prototypes/${p.id}`, budget));
    if (opts.compileStandalone) {
      try { entries.push({ name: `standalone/${p.id}.html`, data: opts.compileStandalone(p.id) }); } catch { /* preview is optional */ }
    }
  }
  if (hasDs) entries.push(...collectDir(dsDir, "design-system", budget));
  for (const file of ["design.json", "profile.json"]) {
    const full = path.join(opts.projectDir, "design", file);
    if (fs.existsSync(full)) entries.push({ name: `project/${file}`, data: fs.readFileSync(full) });
  }

  const mcp = opts.includeMcp ? resolveMcpSources(opts.mcpServers, opts.repo) : [];
  for (const server of mcp) entries.push(...collectDir(server.dir, `mcp/${server.name}`, budget));

  const generatedAt = new Date().toISOString().slice(0, 10);
  const model = { slug: opts.slug, prototypes, hasDs, mcp, generatedAt, files: entries.map((e) => e.name) };
  const manifest = {
    schema: 1,
    project: opts.slug,
    generatedAt,
    prototypes: prototypes.map((p) => p.id),
    designSystem: hasDs,
    mcpServers: mcp.map((s) => s.name),
    files: entries.length,
  };
  entries.push(
    { name: "README.md", data: buildReadme(model) },
    { name: "AGENTS.md", data: buildAgents(model) },
    { name: "CLAUDE.md", data: "See @AGENTS.md. Read MAPA.md first.\n" },
    { name: "MAPA.md", data: buildMapa(model) },
    { name: "manifest.json", data: JSON.stringify(manifest, null, 2) + "\n" },
  );
  if (mcp.length) entries.push({ name: ".mcp.json", data: buildMcpJson(mcp) });
  entries.push(
    { name: "package.json", data: buildPackageJson(opts.slug, mcp) },
    { name: "tools/preview-server.js", data: fs.readFileSync(path.join(__dirname, "..", "templates", "handoff-preview-server.js")) },
  );

  const scope = prototypes.length === 1 && !hasDs ? prototypes[0].id : hasDs && !prototypes.length ? "design-system" : "handoff";
  return { zip: buildZip(entries), fileName: `${opts.slug}-${scope}-${generatedAt}.zip`, manifest };
}

module.exports = { buildHandoffBundle };
