// @ts-check
// The personal workspace: a reserved pseudo-project that holds work without a project (EP-25.02, ADR-019).
const fs = require("fs");
const path = require("path");
const { getProjects } = require("../config");
const { PERSONAL_SLUG } = require("./reserved");

const INSTRUCTIONS = "# Personal workspace\n\nWork that does not belong to any project. Only global instructions and memory apply here.\n";
const MEMORY = "# Personal workspace memory\n\nEmpty on purpose: this workspace uses global memory only.\n";

const personalDir = () => path.join(getProjects(), PERSONAL_SLUG);

/** Creates projects/_pessoal/ with the standard structure when missing. Idempotent; never overwrites. */
function ensurePersonalWorkspace() {
  const dir = personalDir();
  for (const sub of ["chats", "context", "scheduled"]) fs.mkdirSync(path.join(dir, sub), { recursive: true });
  for (const [name, text] of [["instructions.md", INSTRUCTIONS], ["memory.md", MEMORY]]) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) fs.writeFileSync(file, text, "utf8");
  }
  return dir;
}

const isPersonal = (/** @type {unknown} */ slug) => slug === PERSONAL_SLUG;

module.exports = { PERSONAL_SLUG, personalDir, ensurePersonalWorkspace, isPersonal };
