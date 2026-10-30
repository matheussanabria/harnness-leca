// The map is MAPA.md (entry point and index) plus the per-area files in docs/mapa/. This returns all of it as one text.
const fs = require("fs");
const path = require("path");

const DEFAULT_ROOT = path.resolve(__dirname, "..", "..");

function walkMd(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walkMd(full) : e.name.endsWith(".md") ? [full] : [];
  });
}

/** @param {string} [root] repository root (defaults to this repository) */
function readMapaText(root = DEFAULT_ROOT) {
  const files = [path.join(root, "MAPA.md")];
  try {
    const dir = path.join(root, "docs", "mapa");
    for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".md")).sort()) files.push(path.join(dir, name));
  } catch { /* no split map: MAPA.md alone */ }
  return files.filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, "utf8")).join("\n");
}

module.exports = { readMapaText };
