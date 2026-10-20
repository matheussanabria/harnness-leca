// @ts-check
// Gerenciamento e inclusão de Skills (.agents/skills) nos projetos e repositórios do Harness Leca.
// Fachada: a implementação vive em ./skills/ (frontmatter, targets, reader, writer, templates, recognized).
const { parseFrontmatter } = require("./skills/frontmatter");
const { findProjectTargets } = require("./skills/targets");
const { listProjectSkills, getSkillDetail } = require("./skills/reader");
const { saveSkill, deleteSkill } = require("./skills/writer");
const { installTemplate, TEMPLATES_CATALOG } = require("./skills/templates");
const { listRecognizedSkills, importRecognizedSkill } = require("./skills/recognized");

module.exports = {
  findProjectTargets,
  listProjectSkills,
  getSkillDetail,
  saveSkill,
  deleteSkill,
  installTemplate,
  listRecognizedSkills,
  importRecognizedSkill,
  TEMPLATES_CATALOG,
  parseFrontmatter,
};
