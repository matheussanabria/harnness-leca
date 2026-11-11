// @ts-check
const fs = require("fs");
const path = require("path");

/** File collection helpers for the handoff bundle. Entries are `{ name, data }` with "/" separated names. */

const SKIP_DIRS = new Set(["node_modules", ".git", ".history", ".scratch", ".versions", "versions", "dist"]);
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 60 * 1024 * 1024;

/**
 * Walks `dir` and returns its files as entries under `prefix`. Skips dependency, history and hidden-state folders.
 * @param {string} dir
 * @param {string} prefix
 * @param {{ total: number }} budget  shared byte budget across calls
 * @returns {{ name: string, data: Buffer }[]}
 */
function collectDir(dir, prefix, budget) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const walk = (current, rel) => {
    for (const item of fs.readdirSync(current, { withFileTypes: true })) {
      if (item.isDirectory()) {
        if (!SKIP_DIRS.has(item.name)) walk(path.join(current, item.name), `${rel}${item.name}/`);
        continue;
      }
      if (!item.isFile() || item.name.endsWith(".tmp") || /\.tmp-\d+$/.test(item.name)) continue;
      const file = path.join(current, item.name);
      const size = fs.statSync(file).size;
      if (size > MAX_FILE_BYTES) continue;
      budget.total += size;
      if (budget.total > MAX_TOTAL_BYTES) throw new Error("O pacote excede o limite de tamanho (60 MB).");
      out.push({ name: `${prefix}/${rel}${item.name}`, data: fs.readFileSync(file) });
    }
  };
  walk(dir, "");
  return out;
}

/** @param {string} projectDir @returns {{ id: string, title: string, screens: number }[]} */
function listPrototypes(projectDir) {
  const base = path.join(projectDir, "design", "prototypes");
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(base, d.name, "proto.json")))
    .map((d) => {
      try {
        const json = JSON.parse(fs.readFileSync(path.join(base, d.name, "proto.json"), "utf8").replace(/^﻿/, ""));
        return { id: d.name, title: json.title || d.name, screens: (json.screens || []).length };
      } catch {
        return { id: d.name, title: d.name, screens: 0 };
      }
    });
}

/**
 * Directory of each MCP server declared for the project that ships its own source in the repo (`<dir>/src/server.js`).
 * @param {Record<string, any>} mcpServers  from loadProjectConfig
 * @param {string | null} repo
 * @returns {{ name: string, dir: string, entry: string, env: Record<string, string> }[]}
 */
function resolveMcpSources(mcpServers, repo) {
  const found = [];
  for (const [name, server] of Object.entries(mcpServers || {})) {
    const script = (server.args || []).find((a) => typeof a === "string" && /\.(c|m)?js$/.test(a));
    if (!script || !path.isAbsolute(script) || !fs.existsSync(script)) continue;
    const root = repo ? path.resolve(repo) : null;
    if (root && !path.resolve(script).startsWith(root + path.sep)) continue;
    const entryRel = path.relative(path.dirname(path.dirname(script)), script).replace(/\\/g, "/");
    found.push({ name, dir: path.dirname(path.dirname(script)), entry: entryRel, env: server.env || {} });
  }
  return found;
}

module.exports = { collectDir, listPrototypes, resolveMcpSources, MAX_TOTAL_BYTES };
