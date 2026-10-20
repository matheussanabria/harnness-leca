// @ts-check
// Escrita de skills: criar/atualizar e remover.
const fs = require("fs");
const path = require("path");
const { findProjectTargets } = require("./targets");
const { getSkillDetail } = require("./reader");

const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,64}$/i;

/**
 * Cria ou atualiza uma skill em um alvo específico
 * @param {string} slug
 * @param {string} targetId
 * @param {string} skillName
 * @param {{ content?: string, frontmatter?: any, references?: any[] }} [options]
 */
function saveSkill(slug, targetId, skillName, options = {}) {
  const { content, frontmatter, references } = options;
  if (!NAME_RE.test(skillName)) {
    throw new Error("Nome de skill inválido. Use apenas letras, números, hífens ou underlines.");
  }

  const targets = findProjectTargets(slug);
  const target = targets.find((t) => t.id === targetId);
  if (!target) {
    throw new Error(`Alvo "${targetId}" não encontrado.`);
  }

  const skillsDir = path.join(target.path, ".agents", "skills");
  const skillFolder = path.join(skillsDir, skillName);
  fs.mkdirSync(skillFolder, { recursive: true });

  let finalContent = content || "";
  if (frontmatter && !finalContent.startsWith("---")) {
    const fmStr = [
      "---",
      `name: ${frontmatter.name || skillName}`,
      `description: >-\n  ${(frontmatter.description || "").replace(/\r?\n/g, "\n  ")}`,
      `version: ${frontmatter.version || "1.0.0"}`,
      "---",
      "",
    ].join("\n");
    finalContent = fmStr + (finalContent || `# ${frontmatter.title || skillName}\n\nDiretrizes e padrões para ${skillName}.`);
  }

  const skillMdFile = path.join(skillFolder, "SKILL.md");
  fs.writeFileSync(skillMdFile, finalContent, "utf8");

  if (Array.isArray(references)) {
    const refDir = path.join(skillFolder, "references");
    fs.mkdirSync(refDir, { recursive: true });
    for (const ref of references) {
      if (ref && ref.name && ref.content !== undefined) {
        fs.writeFileSync(path.join(refDir, ref.name), String(ref.content), "utf8");
      }
    }
  }

  return getSkillDetail(slug, targetId, skillName);
}

/**
 * Remove uma skill
 */
function deleteSkill(slug, targetId, skillName) {
  const targets = findProjectTargets(slug);
  const target = targets.find((t) => t.id === targetId);
  if (!target) throw new Error("Alvo não encontrado");

  const skillsDir = path.join(target.path, ".agents", "skills");
  const skillFolder = path.join(skillsDir, skillName);
  if (fs.existsSync(skillFolder)) {
    fs.rmSync(skillFolder, { recursive: true, force: true });
    return true;
  }
  return false;
}

module.exports = { saveSkill, deleteSkill };
