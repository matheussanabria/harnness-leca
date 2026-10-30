// @ts-check
// Frontmatter of the per-feature map files (docs/mapa/<domain>/<module>/<feature>.md): parser and schema validation.
// Subset of YAML on purpose: `key: value` lines and inline lists `[a, b]`, so no dependency is needed.
"use strict";

const REQUIRED = ["domain", "module", "summary", "paths", "keywords", "updated"];
const LIST_FIELDS = ["paths", "keywords"];
const SUMMARY_MAX = 120;

const unquote = (s) => s.replace(/^(["'])(.*)\1$/, "$2");

function parseValue(raw) {
  const v = raw.trim();
  if (v.startsWith("[") && v.endsWith("]")) {
    return v.slice(1, -1).split(",").map((x) => unquote(x.trim())).filter(Boolean);
  }
  return unquote(v);
}

/**
 * @param {string} text file content
 * @returns {{ meta: Record<string, string | string[]> | null, body: string }} meta is null when there is no frontmatter block
 */
function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { meta: null, body: text };
  /** @type {Record<string, string | string[]>} */
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (kv) meta[kv[1]] = parseValue(kv[2]);
  }
  return { meta, body: text.slice(m[0].length) };
}

/** @returns {string[]} human readable problems; empty when the frontmatter is valid */
function validateFrontmatter(meta) {
  const problems = [];
  for (const key of REQUIRED) {
    const v = meta[key];
    if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) problems.push(`missing field "${key}"`);
  }
  for (const key of LIST_FIELDS) {
    if (meta[key] !== undefined && !Array.isArray(meta[key])) problems.push(`"${key}" must be a list like [a, b]`);
  }
  if (typeof meta.summary === "string" && meta.summary.length > SUMMARY_MAX) problems.push(`"summary" is over ${SUMMARY_MAX} characters`);
  if (typeof meta.updated === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(meta.updated)) problems.push(`"updated" must be YYYY-MM-DD`);
  return problems;
}

module.exports = { parseFrontmatter, validateFrontmatter, SUMMARY_MAX };
