// @ts-check
// Read-only file browsing for one catalog item: a skill is a folder, an agent is a single .md file.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { defaultSources } = require("./catalog-reader");

const MAX_ENTRIES = 600;
const MAX_DEPTH = 6;
const MAX_BYTES = 256 * 1024;
const SKIP = new Set(["node_modules", "__pycache__", ".git"]);
const TEXT_EXT = new Set([".md", ".markdown", ".txt", ".yaml", ".yml", ".json", ".xml", ".xsd", ".py", ".js", ".ts", ".sh", ".ps1", ".html", ".css", ".csv", ".toml", ".ini", ".sql", ".java", ".feature", ""]);
const NAME = /^[\w.\- ]{1,120}$/;

/** Finds the on-disk entry of an item. Names come from the URL, so they are validated first. */
function resolveItem(kind, source, ref, sources = defaultSources()) {
  if (!NAME.test(String(ref || "")) || ref === "." || ref === "..") return null;
  const list = kind === "agent" ? sources.agents : kind === "skill" ? sources.skills : null;
  const src = list && list.find((s) => s.id === source);
  if (!src) return null;
  const full = path.join(src.dir, ref);
  if (!fs.existsSync(full)) return null;
  const real = fs.realpathSync(full);
  const realRoot = fs.realpathSync(src.dir);
  if (real !== realRoot && !real.startsWith(realRoot + path.sep)) return null;
  return { kind, root: real, isDir: fs.statSync(real).isDirectory() };
}

/** Sorts folders first, then names; hides dot-entries. */
function listDir(dir, rel, depth, budget) {
  if (depth > MAX_DEPTH) return [];
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => !e.name.startsWith(".") && !SKIP.has(e.name) && !e.isSymbolicLink())
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
  for (const e of entries) {
    if (budget.left <= 0) break;
    budget.left -= 1;
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push({ type: "dir", name: e.name, path: childRel, children: listDir(path.join(dir, e.name), childRel, depth + 1, budget) });
    else out.push({ type: "file", name: e.name, path: childRel, size: fs.statSync(path.join(dir, e.name)).size });
  }
  return out;
}

/** File tree of an item; an agent has one file. */
function listTree(kind, source, ref, sources) {
  const item = resolveItem(kind, source, ref, sources);
  if (!item) return null;
  if (!item.isDir) return { truncated: false, tree: [{ type: "file", name: path.basename(item.root), path: path.basename(item.root), size: fs.statSync(item.root).size }] };
  const budget = { left: MAX_ENTRIES };
  const tree = listDir(item.root, "", 1, budget);
  return { truncated: budget.left <= 0, tree };
}

/** Resolves a relative path inside an item to a real file. Returns { real } or { status, error }. */
function resolveFile(kind, source, ref, rel, sources) {
  const item = resolveItem(kind, source, ref, sources);
  if (!item) return { status: 404, error: "Item not found." };
  const parts = String(rel || "").split("/").filter(Boolean);
  if (parts.some((p) => p === ".." || p === "." || p.includes("\\") || p.startsWith("."))) return { status: 400, error: "Invalid path." };
  const target = item.isDir ? path.join(item.root, ...parts) : item.root;
  if (!item.isDir && parts.join("/") !== path.basename(item.root)) return { status: 404, error: "File not found." };
  if (!fs.existsSync(target)) return { status: 404, error: "File not found." };
  const real = fs.realpathSync(target);
  if (real !== item.root && !real.startsWith(item.root + path.sep)) return { status: 400, error: "Invalid path." };
  const stat = fs.statSync(real);
  if (!stat.isFile()) return { status: 400, error: "Not a file." };
  return { real, stat };
}

/** Content revision: a hash of the bytes, so any change (even by another editor) is detected. */
const revisionOf = (buf) => crypto.createHash("sha1").update(buf).digest("hex");

/** Text content of one file inside the item. Returns { error } when it cannot be shown. */
function readItemFile(kind, source, ref, rel, sources) {
  const found = resolveFile(kind, source, ref, rel, sources);
  if (!found.real) return found;
  const { real, stat } = found;
  const ext = path.extname(real).toLowerCase();
  if (!TEXT_EXT.has(ext)) return { status: 200, name: path.basename(real), size: stat.size, binary: true, content: "" };
  const fd = fs.openSync(real, "r");
  try {
    const buf = Buffer.alloc(Math.min(stat.size, MAX_BYTES));
    fs.readSync(fd, buf, 0, buf.length, 0);
    if (buf.includes(0)) return { status: 200, name: path.basename(real), size: stat.size, binary: true, content: "" };
    return { status: 200, name: path.basename(real), size: stat.size, binary: false, truncated: stat.size > MAX_BYTES, revision: stat.size > MAX_BYTES ? "" : revisionOf(buf), content: buf.toString("utf8").replace(/^﻿/, "") };
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = { listTree, readItemFile, resolveItem, resolveFile, revisionOf, TEXT_EXT, MAX_BYTES };
