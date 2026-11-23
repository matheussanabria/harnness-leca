// @ts-check
// Reads and saves the text files of an item that lives on the PROJECT layer (projects/<slug>/<kind>s/<id>/).
// Only the known files of each kind are editable, with a size cap; the item must already exist (use createItem first).
const fs = require("fs");
const path = require("path");
const { itemDir } = require("./writer");

const EDITABLE = { skill: ["SKILL.md"], agent: ["AGENT.md"], workflow: ["manifest.yaml", "WORKFLOW.md"] };
const MAX_BYTES = 200 * 1024;

/** @param {string} slug @param {string} kind @param {string} id @returns {{ files: { name: string, text: string }[] }|null} */
function readItem(slug, kind, id) {
  const dir = itemDir(slug, kind, id);
  if (!fs.existsSync(dir)) return null;
  const files = EDITABLE[kind]
    .filter((name) => fs.existsSync(path.join(dir, name)))
    .map((name) => ({ name, text: fs.readFileSync(path.join(dir, name), "utf8") }));
  return { files };
}

/** @param {{ slug: string, kind: string, id: string, file: string, text: string }} o */
function saveItemFile({ slug, kind, id, file, text }) {
  const dir = itemDir(slug, kind, id);
  if (!fs.existsSync(dir)) throw new Error("Item não encontrado na camada do projeto.");
  if (!(EDITABLE[kind] || []).includes(file)) throw new Error(`Arquivo não editável: ${file}`);
  if (typeof text !== "string") throw new Error("Informe o texto.");
  if (Buffer.byteLength(text, "utf8") > MAX_BYTES) throw new Error("Arquivo grande demais (limite de 200 KB).");
  fs.writeFileSync(path.join(dir, file), text, "utf8");
  return { file, bytes: Buffer.byteLength(text, "utf8") };
}

module.exports = { EDITABLE, MAX_BYTES, readItem, saveItemFile };
