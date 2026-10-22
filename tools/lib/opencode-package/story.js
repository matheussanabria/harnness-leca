// @ts-check
// Lê uma história do EP-14 (docs/harness-evolution/02-epics/EP-14-estado-das-telas/<id>-<slug>.md) e extrai o que o
// executor precisa: branch, título e a lista de arquivos que o agente pode tocar (seção 5).
const fs = require("fs");
const path = require("path");

const EPIC_DIR = path.join("docs", "harness-evolution", "02-epics", "EP-14-estado-das-telas");
const ID_RE = /^\d{2}\.\d{2}$/;

/** Item da lista -> padrão de caminho: tira crases e o comentário entre parênteses no fim. */
function toPattern(line) {
  return line.replace(/^-\s*/, "").replace(/`/g, "").replace(/\s*\(.*\)\s*$/, "").trim();
}

/**
 * @param {string} root raiz do repositório
 * @param {string} id ex.: "14.01"
 * @returns {{ id: string, file: string, slug: string, branch: string, title: string, allowed: string[], body: string, deps: string[] }}
 */
function parseStory(root, id) {
  if (!ID_RE.test(id)) throw new Error(`Id de história inválido: "${id}" (use o formato 14.01).`);
  const dir = path.join(root, EPIC_DIR);
  const name = fs.readdirSync(dir).find((f) => f.startsWith(`${id}-`) && f.endsWith(".md"));
  if (!name) throw new Error(`História ${id} não encontrada em ${EPIC_DIR}.`);
  const file = path.join(dir, name);
  const body = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const slug = name.slice(id.length + 1, -3);
  const title = (body.match(/^titulo:\s*(.+)$/m) || [])[1] || name;
  const deps = ((body.match(/^dependencias:\s*\[(.*)\]/m) || [])[1] || "").split(",").map((d) => d.trim()).filter(Boolean);
  const section = body.split(/^## 5\./m)[1] || "";
  const allowed = section
    .split(/^## /m)[0]
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .map(toPattern)
    .filter(Boolean);
  if (!allowed.length) throw new Error(`História ${id} sem lista de arquivos permitidos (seção 5).`);
  return { id, file, slug, branch: `ep14/${id}-${slug}`, title, allowed, body, deps };
}

module.exports = { parseStory, toPattern, EPIC_DIR };
