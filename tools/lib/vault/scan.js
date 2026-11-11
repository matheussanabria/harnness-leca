// @ts-check
// Read-only scan of an Obsidian vault: walks the markdown notes and extracts a light record for each one.
"use strict";
const fs = require("fs");
const path = require("path");

const SKIP_DIRS = new Set([".git", ".obsidian", ".trash", "node_modules", "06 - Skills", "16 - Clientes", "Bancos de dados", "Excalidraw"]);
const STUB_BODY_CHARS = 200;

function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { meta: {}, tags: [], body: text };
  const meta = {};
  const tags = [];
  let inTags = false;
  for (const line of m[1].split(/\r?\n/)) {
    const item = /^\s+-\s+(.+)$/.exec(line);
    if (item && inTags) { tags.push(clean(item[1])); continue; }
    const kv = /^\s*([\w-]+):\s*(.*)$/.exec(line);
    if (!kv) { inTags = false; continue; }
    inTags = kv[1] === "tags";
    const val = kv[2].trim();
    if (kv[1] === "tags" && val.startsWith("[")) tags.push(...val.slice(1, -1).split(",").map(clean).filter(Boolean));
    else if (val) meta[kv[1]] = clean(val);
  }
  return { meta, tags, body: text.slice(m[0].length) };
}

function clean(s) {
  return s.trim().replace(/^["']|["']$/g, "");
}

// Counts real prose: headings, links, fenced examples, empty "- **Label:**" template fields and paste placeholders do not count.
function bodyChars(body) {
  return body
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#.*$/gm, "")
    .replace(/^.*(Cole aqui|\bCTA\b).*$/gim, "")
    .replace(/^\s*[-*]\s*\*\*[^*\n]*\*\*\s*$/gm, "")
    .replace(/\[\[[^\]]*\]\]/g, "")
    .replace(/[-*>\s|]/g, "").length;
}

/** Walks `root` (optionally limited to `sub` folders) and returns one record per markdown note. */
function scanVault(root, subs = ["Conhecimento"]) {
  const notes = [];
  const skipped = [];
  const seen = new Set();
  // Obsidian vaults often link folders through symlinks or OneDrive reparse points; follow them once.
  const isDir = (ent, full) => ent.isDirectory() || (ent.isSymbolicLink() && fs.statSync(full, { throwIfNoEntry: false })?.isDirectory());
  const walk = (dir) => {
    const real = fs.realpathSync(dir);
    if (seen.has(real)) return;
    seen.add(real);
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (isDir(ent, path.join(dir, ent.name))) { if (!SKIP_DIRS.has(ent.name)) walk(path.join(dir, ent.name)); continue; }
      if (!ent.name.endsWith(".md")) continue;
      const file = path.join(dir, ent.name);
      let text;
      try { text = fs.readFileSync(file, "utf8"); } catch (err) { skipped.push({ rel: path.relative(root, file).split(path.sep).join("/"), code: err.code }); continue; }
      const { meta, tags, body } = parseFrontmatter(text);
      const h1 = /^#\s+(.+)$/m.exec(body);
      notes.push({
        rel: path.relative(root, file).split(path.sep).join("/"),
        title: meta.nome || (h1 ? h1[1].replace(/^[^\p{L}\p{N}]+/u, "").trim() : ent.name.replace(/\.md$/, "")),
        meta, tags, bytes: Buffer.byteLength(text), stub: bodyChars(body) < STUB_BODY_CHARS,
      });
    }
  };
  for (const sub of subs) { const d = path.join(root, sub); if (fs.existsSync(d)) walk(d); }
  notes.skipped = skipped; // unreadable files, typically OneDrive online-only placeholders
  return notes;
}

module.exports = { scanVault, parseFrontmatter, SKIP_DIRS };
