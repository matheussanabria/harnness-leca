// @ts-check
// Reads the map tree: MAPA.md (index) and every docs/mapa/**/*.md, with parsed frontmatter and size in bytes.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { parseFrontmatter } = require("./frontmatter");
const { toPosix } = require("./glob");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const COVERED_DIRS = ["ui/", "tools/", "scripts/"];
const COVERED_EXT = /\.(js|mjs|cjs|css|html)$/;

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : e.name.endsWith(".md") ? [full] : [];
  }).sort();
}

/**
 * @param {string} [root]
 * @returns {{ file: string, size: number, meta: Record<string, string | string[]> | null }[]} file is relative to root, POSIX style
 */
function scanMapa(root = ROOT) {
  return walk(path.join(root, "docs", "mapa")).map((full) => {
    const raw = fs.readFileSync(full);
    return { file: toPosix(path.relative(root, full)), size: raw.length, meta: parseFrontmatter(raw.toString("utf8")).meta };
  });
}

/** Source files the map must cover: tracked JS/CSS/HTML under ui/, tools/ and scripts/. */
function listCoveredFiles(root = ROOT) {
  const out = execFileSync("git", ["ls-files", "-z"], { cwd: root, maxBuffer: 64 * 1024 * 1024 }).toString("utf8");
  return out.split("\0").map(toPosix).filter((f) => COVERED_DIRS.some((d) => f.startsWith(d)) && COVERED_EXT.test(f));
}

module.exports = { scanMapa, listCoveredFiles, ROOT };
