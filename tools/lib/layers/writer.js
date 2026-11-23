// @ts-check
// Creates and removes items of the PROJECT layer: projects/<slug>/{skills,agents,workflows}/<id>/.
// Inherited layers (DAI, global) are never written here. Creation never overwrites; removal is confined to the folder
// of the item inside the project and only for ids that pass the same check the scanner uses.
const fs = require("fs");
const path = require("path");
const { ROOT } = require("../root");
const { KINDS } = require("./scan");

const PLURAL = { skill: "skills", agent: "agents", workflow: "workflows" };
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const oneLine = (s) => String(s || "").replace(/\s+/g, " ").trim().slice(0, 300);
const title = (id) => id.replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** @returns {{ dir: string, files: Record<string,string> }} */
function scaffold(kind, id, description) {
  const d = oneLine(description) || `TODO: describe when to use ${id}.`;
  if (kind === "skill") {
    return { dir: "", files: { "SKILL.md": `---\nname: ${id}\ndescription: ${JSON.stringify(d)}\nversion: "1.0.0"\n---\n\n# ${title(id)}\n\nWhen to use, steps and limits of this skill.\n` } };
  }
  if (kind === "agent") {
    return { dir: "", files: { "AGENT.md": `# ${title(id)}\n\n> ${d}\n\n## Role\nWhat this agent does and does not do.\n\n## Inputs\n- What it needs before acting.\n\n## Output\n- What it delivers.\n` } };
  }
  return {
    dir: "",
    files: {
      "manifest.yaml": `id: ${id}\nversion: "1.0.0"\ndescription: ${JSON.stringify(d)}\nstates: []\n`,
      "WORKFLOW.md": `# ${title(id)}\n\n${d}\n\n## States\nList each state, its owner, its inputs and outputs, and the gate to leave it.\n`,
    },
  };
}

/** @param {string} slug @param {string} kind @param {string} id */
function itemDir(slug, kind, id) {
  if (!KINDS.includes(kind)) throw new Error(`Tipo inválido: ${kind}`);
  if (!ID_RE.test(id)) throw new Error("Id inválido. Use letras, números, hífen, underline ou ponto (até 64).");
  const projectDir = path.join(ROOT, "projects", slug);
  if (!fs.existsSync(projectDir)) throw new Error("Projeto não encontrado.");
  const base = path.join(projectDir, PLURAL[kind]);
  const dir = path.join(base, id);
  if (path.relative(base, dir).startsWith("..")) throw new Error("Caminho inválido.");
  return dir;
}

/** @param {{ slug: string, kind: string, id: string, description?: string }} o @returns {{ dir: string, files: string[] }} */
function createItem({ slug, kind, id, description }) {
  const dir = itemDir(slug, kind, id);
  if (fs.existsSync(dir)) throw new Error(`Já existe: ${kind} ${id} neste projeto.`);
  const { files } = scaffold(kind, id, description || "");
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text, "utf8");
  return { dir: dir.split(path.sep).join("/"), files: Object.keys(files) };
}

/** @returns {boolean} false when there was nothing to remove */
function deleteItem({ slug, kind, id }) {
  const dir = itemDir(slug, kind, id);
  if (!fs.existsSync(dir)) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

module.exports = { createItem, deleteItem, scaffold };
