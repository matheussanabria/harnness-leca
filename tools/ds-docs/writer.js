// @ts-check
"use strict";
const fs = require("fs");
const path = require("path");

/** Grava arquivos `{rel, content}` sob `root`; em `dryRun` só lista. Retorna os caminhos. */
function writeFiles(root, files, dryRun = false) {
  const written = [];
  for (const file of files) {
    const target = path.join(root, file.rel);
    if (!dryRun) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.content, "utf8");
    }
    written.push(file.rel);
  }
  return written;
}

function dataUri(file, mime = "image/png") {
  return `data:${mime};base64,${fs.readFileSync(file).toString("base64")}`;
}

/** Acrescenta protótipos ao `design.json` (índice do projeto) sem duplicar ids. */
function updateDesignIndex(designDir, entries, dryRun = false) {
  const file = path.join(designDir, "design.json");
  const data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { schema: 1, prototypes: [], components: [], features: [] };
  data.prototypes = data.prototypes || [];
  const added = [];
  for (const entry of entries) {
    if (data.prototypes.some((p) => p.id === entry.id)) continue;
    data.prototypes.push(entry);
    added.push(entry.id);
  }
  if (added.length && !dryRun) fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return added;
}

module.exports = { writeFiles, dataUri, updateDesignIndex };
