// @ts-check
// Filtered tree of doc/: folders and the files the reader may open. Symbolic links and junctions are never
// followed (they are left out), dot folders such as .obsidian are skipped, and oversized files are omitted.
const fs = require("node:fs");
const path = require("node:path");
const { MAX_BYTES } = require("./confine");

const MAX_FILES = 5000;
const MAX_DEPTH = 12;

/**
 * @typedef {{ name: string, path: string, kind: "dir", children: TreeNode[] } | { name: string, path: string, kind: "file", size: number }} TreeNode
 * @typedef {{ path: string, size: number, mtime: number }} FileEntry
 */

/**
 * @param {{ docRoot: string, realDocRoot: string, isListable: (rel: string) => boolean }} access
 * @returns {{ found: boolean, tree: TreeNode[], files: FileEntry[], signature: string, truncated: boolean }}
 */
function readDocTree(access) {
  /** @type {FileEntry[]} */
  const files = [];
  let truncated = false;
  if (!access.realDocRoot) return { found: false, tree: [], files, signature: "", truncated };

  /** @param {string} abs @param {string} rel @param {number} depth @returns {TreeNode[]} */
  function walk(abs, rel, depth) {
    if (depth > MAX_DEPTH) return [];
    let entries = [];
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return [];
    }
    entries.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
    /** @type {TreeNode[]} */
    const nodes = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      const childAbs = path.join(abs, entry.name);
      if (entry.isDirectory()) {
        if (isLink(childAbs)) continue;
        const children = walk(childAbs, childRel, depth + 1);
        if (children.length) nodes.push({ name: entry.name, path: childRel, kind: "dir", children });
      } else if (entry.isFile() && access.isListable(childRel)) {
        if (files.length >= MAX_FILES) {
          truncated = true;
          continue;
        }
        const stat = fs.statSync(childAbs);
        if (stat.size > MAX_BYTES) continue;
        files.push({ path: childRel, size: stat.size, mtime: stat.mtimeMs });
        nodes.push({ name: entry.name, path: childRel, kind: "file", size: stat.size });
      }
    }
    return nodes;
  }

  const tree = walk(access.docRoot, "", 0);
  const signature = files.map((f) => `${f.path}:${f.size}:${Math.round(f.mtime)}`).join("|");
  return { found: true, tree, files, signature, truncated };
}

/** Windows junctions report isDirectory() in readdir; lstat tells them apart. @param {string} abs */
function isLink(abs) {
  try {
    return fs.lstatSync(abs).isSymbolicLink();
  } catch {
    return true;
  }
}

module.exports = { readDocTree, MAX_FILES };
