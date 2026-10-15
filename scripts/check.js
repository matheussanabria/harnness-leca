#!/usr/bin/env node
// Checagem rápida, sem dependências: sintaxe de todos os .js (com o Node que estiver rodando) e validade dos .json
// do repositório. Não olha dados locais (projects/, bridge/) nem pastas geradas.
//   npm run check
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SKIP_DIRS = new Set(["node_modules", ".git", "projects", "bridge", "golden"]);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function check(root = ROOT) {
  const problems = [];
  let js = 0, json = 0;
  for (const file of walk(root)) {
    const rel = path.relative(root, file);
    if (file.endsWith(".js")) {
      js++;
      const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
      if (r.status !== 0) problems.push(`${rel}: ${(r.stderr || "").trim().split("\n").slice(0, 4).join(" | ")}`);
    } else if (file.endsWith(".json")) {
      json++;
      try { JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, "")); } catch (e) { problems.push(`${rel}: JSON inválido (${e.message})`); }
    }
  }
  return { js, json, problems };
}

module.exports = { check };

if (require.main === module) {
  const { js, json, problems } = check();
  if (problems.length) {
    console.error(`✖ ${problems.length} problema(s):\n` + problems.map((p) => `  - ${p}`).join("\n"));
    process.exit(1);
  }
  console.log(`✔ ${js} arquivos .js e ${json} .json sem erro (Node ${process.version})`);
}
