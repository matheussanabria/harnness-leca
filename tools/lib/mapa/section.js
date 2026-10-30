// @ts-check
// On-demand map slice for agents: the migrated map files that best match a query (path or keywords), frontmatter removed.
"use strict";
const fs = require("fs");
const path = require("path");
const { scanMapa } = require("./scan");
const { findMapa } = require("./query");
const { parseFrontmatter } = require("./frontmatter");

const MAX_FILES = 3;

/**
 * @param {string} root repository root (folder holding docs/mapa)
 * @param {string | number} query
 * @returns {{ sectionTitle: string, content: string } | null}
 */
function mapaSection(root, query) {
  const hits = findMapa(scanMapa(root), String(query)).slice(0, MAX_FILES);
  if (!hits.length) return null;
  const parts = hits.map((e) => `### ${e.meta.domain} / ${e.meta.module} / ${e.meta.feature || path.basename(e.file, ".md")}\n${parseFrontmatter(fs.readFileSync(path.join(root, e.file), "utf8")).body.trim()}`);
  return { sectionTitle: hits.map((e) => `${e.meta.domain}/${e.meta.module}`).join(", "), content: parts.join("\n\n") };
}

module.exports = { mapaSection };
